import json
from backend.agents.state import AgentState
from backend.config import settings
from backend.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage

def critic(state: AgentState) -> dict:
    """Critic agent that reviews the generated draft, gives a score, and flags quality issues."""
    
    system_prompt = (
        "You are a quality reviewer. Compare the generated draft against the original task. "
        "Review details, formatting, correctness, and coverage of instructions.\n\n"
        "Return ONLY a valid JSON object in this format:\n"
        "{\n"
        "  \"score\": 1-10,\n"
        "  \"passed\": true|false,\n"
        "  \"issues\": [\"issue1\", \"issue2\", ...],\n"
        "  \"suggestion\": \"specific improvement instruction for the writer\"\n"
        "}\n\n"
        "Rules:\n"
        "1. passed = true if score >= 7, otherwise false.\n"
        "2. If passed is false, provide a very concrete suggestion to improve the draft.\n"
        "3. Output ONLY valid JSON, do not wrap in markdown code blocks."
    )
    
    agent_outputs = state.get("agent_outputs", {})
    draft = agent_outputs.get("writer", "No draft has been written yet.")
    
    context = (
        f"Original User Goal: {state['task']}\n\n"
        f"Generated Draft:\n"
        f"-----------------------\n"
        f"{draft}\n"
        f"-----------------------\n"
    )
    
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=context)
    ]
    
    try:
        llm = get_llm(agent_name="critic", temperature=0.1)
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
        
        # Validate JSON format
        data = json.loads(text)
        
        # Force correct 'passed' boolean based on score
        score = data.get("score", 0)
        passed = score >= 7
        data["passed"] = passed
        
        updated_outputs = dict(agent_outputs)
        updated_outputs["critic"] = json.dumps(data)
        
        if not passed:
            retries = int(agent_outputs.get("critic_retries", 0)) + 1
            updated_outputs["critic_retries"] = str(retries)
        
        step_count = state.get("step_count", 0) + 1
        
        return {
            "agent_outputs": updated_outputs,
            "step_count": step_count,
            "current_agent": "critic"
        }
    except Exception as e:
        error_log = list(state.get("error_log", []))
        error_log.append(f"Critic failed to evaluate: {str(e)}")
        
        # In case of exception, pass the critic with default values
        default_critic = {
            "score": 7,
            "passed": True,
            "issues": [f"Critic failed to evaluate due to exception: {str(e)}"],
            "suggestion": ""
        }
        
        updated_outputs = dict(agent_outputs)
        updated_outputs["critic"] = json.dumps(default_critic)
        
        return {
            "agent_outputs": updated_outputs,
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }
