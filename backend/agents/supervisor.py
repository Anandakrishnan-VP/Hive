import json
from backend.agents.state import AgentState
from backend.config import settings
from backend.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.runnables import RunnableConfig

def supervisor(state: AgentState, config: RunnableConfig = None) -> dict:
    """Supervisor agent that orchestrates the flow of work, plans tasks, and routes to specialists."""
    if not settings.GROQ_API_KEY:
        # Fallback if key missing
        agent_outputs = dict(state.get("agent_outputs", {}))
        error_log = list(state.get("error_log", []))
        error_log.append("GROQ_API_KEY is missing in supervisor.")
        return {
            "current_agent": "END",
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }

    # Initialize model dynamically
    llm = get_llm(temperature=0.1)
    
    system_prompt = (
        "You are an orchestrator (Supervisor) for a multi-agent system. Given a user task, "
        "create a step-by-step plan and decide which specialist to call next. "
        "Specialists available:\n"
        "- researcher: finds information from the web. Use this agent first to collect data.\n"
        "- coder: writes and executes Python code. Use this agent ONLY if the user's prompt explicitly asks to write, debug, analyze, or run programming code, or for complex math. DO NOT use for standard informational research, comparisons, or text-only reports.\n"
        "- writer: produces structured, long-form content in markdown. Use this agent after collecting research/code outputs.\n"
        "- critic: reviews the writer's draft against the original task to ensure quality.\n\n"
        "You must return ONLY a valid JSON object in this format:\n"
        "{\n"
        "  \"next_agent\": \"researcher\" | \"coder\" | \"writer\" | \"critic\" | \"END\",\n"
        "  \"task_plan\": [\"step1\", \"step2\", ...],\n"
        "  \"instruction\": \"specific instruction for the next agent\"\n"
        "}\n\n"
        "Rules:\n"
        "1. Return 'END' as next_agent when the task is fully complete and has passed review.\n"
        "2. Keep the instruction detailed and clear for the worker.\n"
        "3. Output ONLY valid JSON, do not wrap in markdown tags like ```json."
    )
    
    # Construct context for supervisor based on previous agent outputs
    agent_outputs = state.get("agent_outputs", {})
    history_str = ""
    for agent, output in agent_outputs.items():
        if agent not in ("supervisor_instruction", "human_feedback"):
            history_str += f"### Output from [{agent}]:\n{output[:3000]}\n\n"
            
    # Load the latest human steering input
    from backend.agents.feedback_store import log_debug
    log_debug(f"supervisor: supervisor node executing. config is: {config}")
    human_feedback = ""
    run_id = None
    if config:
        if hasattr(config, "get"):
            run_id = config.get("configurable", {}).get("thread_id")
        elif hasattr(config, "configurable"):
            run_id = getattr(config, "configurable", {}).get("thread_id")
            
    log_debug(f"supervisor: resolved run_id is: {run_id}")
    if run_id:
        from backend.agents.feedback_store import retrieve_feedback
        human_feedback = retrieve_feedback(run_id)
            
    if not human_feedback:
        human_feedback = agent_outputs.get("human_feedback", "")
    log_debug(f"supervisor: resolved human_feedback is: {human_feedback}")
            
    # Permanently append steering instructions to the task description so future nodes/steps remember it
    updated_task = state.get("task", "")
    if human_feedback:
        if f"[Steering Adjustment]: {human_feedback}" not in updated_task:
            updated_task = f"{updated_task}\n[Steering Adjustment]: {human_feedback}"
            log_debug(f"supervisor: updated task description to: {updated_task}")
            
    # Include existing plan if present
    plan_str = f"Current Plan: {state.get('task_plan', [])}\n" if state.get("task_plan") else ""
    
    prompt = (
        f"Original User Goal: {updated_task}\n\n"
    )
    
    if human_feedback:
        prompt += (
            f"### IMPORTANT: USER INTERVENTION / STEERING GUIDANCE\n"
            f"The user has interrupted the process and provided this steering feedback:\n"
            f"\"{human_feedback}\"\n"
            f"You MUST adjust your plan, instructions, and next agent selection to address this guidance immediately.\n\n"
        )
        
    prompt += (
        f"{plan_str}"
        f"Here is the history of work completed so far:\n"
        f"{history_str if history_str else 'No work has been done yet.'}\n\n"
        f"Decide who should execute the next step."
    )
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=prompt)
    ]
    
    try:
        response = llm.invoke(messages)
        text = response.content.strip()
        
        # Clean up any potential markdown formatting in JSON
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        data = json.loads(text)
        next_agent = data.get("next_agent", "END")
        task_plan = data.get("task_plan", state.get("task_plan", []))
        instruction = data.get("instruction", "")
        
        # Update supervisor instruction in agent_outputs so workers can read it
        updated_outputs = dict(agent_outputs)
        updated_outputs["supervisor_instruction"] = instruction
        
        # Clear human feedback from state so it isn't processed again
        if "human_feedback" in updated_outputs:
            updated_outputs["human_feedback"] = ""
        
        # If task_plan is empty or we are initializing, set the plan
        current_plan = list(state.get("task_plan", []))
        if not current_plan and task_plan:
            current_plan = task_plan
            
        step_count = state.get("step_count", 0) + 1
        
        return {
            "task": updated_task,
            "current_agent": next_agent,
            "task_plan": current_plan,
            "agent_outputs": updated_outputs,
            "step_count": step_count
        }
        
    except Exception as e:
        error_log = list(state.get("error_log", []))
        error_log.append(f"Supervisor failed to parse decision: {str(e)}")
        # Force route to END on parsing error to prevent infinite loops
        return {
            "current_agent": "END",
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }
