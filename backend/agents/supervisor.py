import json
from backend.agents.state import AgentState
from backend.config import settings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

def supervisor(state: AgentState) -> dict:
    """Supervisor agent that orchestrates the flow of work, plans tasks, and routes to specialists."""
    if not settings.GOOGLE_API_KEY:
        # Fallback if key missing
        agent_outputs = dict(state.get("agent_outputs", {}))
        error_log = list(state.get("error_log", []))
        error_log.append("GOOGLE_API_KEY missing in supervisor.")
        return {
            "current_agent": "END",
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }

    # Initialize Gemini model
    llm = ChatGoogleGenerativeAI(
        model=settings.MODEL_NAME,
        google_api_key=settings.GOOGLE_API_KEY,
        temperature=0.1
    )
    
    system_prompt = (
        "You are an orchestrator (Supervisor) for a multi-agent system. Given a user task, "
        "create a step-by-step plan and decide which specialist to call next. "
        "Specialists available:\n"
        "- researcher: finds information from the web. Use this agent first to collect data.\n"
        "- coder: writes and executes Python code to solve numerical, logical or programming subtasks.\n"
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
        if agent != "supervisor_instruction":
            history_str += f"### Output from [{agent}]:\n{output[:3000]}\n\n"
            
    # Include existing plan if present
    plan_str = f"Current Plan: {state.get('task_plan', [])}\n" if state.get("task_plan") else ""
    
    prompt = (
        f"Original User Goal: {state['task']}\n\n"
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
        
        # If task_plan is empty or we are initializing, set the plan
        current_plan = list(state.get("task_plan", []))
        if not current_plan and task_plan:
            current_plan = task_plan
            
        step_count = state.get("step_count", 0) + 1
        
        return {
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
