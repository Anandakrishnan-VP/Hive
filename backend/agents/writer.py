from backend.agents.state import AgentState
from backend.config import settings
from backend.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage

def writer(state: AgentState) -> dict:
    """Writer agent that compiles research and code findings into a long-form markdown blog post or report."""
    if not settings.GROQ_API_KEY:
        agent_outputs = dict(state.get("agent_outputs", {}))
        agent_outputs["writer"] = "Error: Groq API key missing. Cannot generate draft."
        error_log = list(state.get("error_log", []))
        error_log.append("GROQ_API_KEY is missing in writer.")
        return {
            "agent_outputs": agent_outputs,
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }

    # Initialize model dynamically
    llm = get_llm(temperature=0.7)
    
    system_prompt = (
        "You are a technical writer. Using the research and code provided, write "
        "high-quality, structured content. Format in clean markdown. "
        "Always include: introduction, main sections with headers, code blocks where "
        "relevant, and a conclusion. Cite sources/URLs if they are present in the research findings."
    )
    
    # Build context from previous agents
    agent_outputs = state.get("agent_outputs", {})
    researcher_data = agent_outputs.get("researcher", "")
    coder_data = agent_outputs.get("coder", "")
    instruction = agent_outputs.get("supervisor_instruction", state["task"])
    
    context = f"User Goal/Topic: {state['task']}\n"
    context += f"Writer Instruction: {instruction}\n\n"
    
    if researcher_data:
        context += f"### Research Findings (JSON format):\n{researcher_data}\n\n"
    if coder_data:
        context += f"### Coding Findings (JSON format):\n{coder_data}\n\n"
        
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=context)
    ]
    
    try:
        response = llm.invoke(messages)
        draft = response.content.strip()
        
        updated_outputs = dict(agent_outputs)
        updated_outputs["writer"] = draft
        
        step_count = state.get("step_count", 0) + 1
        
        return {
            "agent_outputs": updated_outputs,
            "step_count": step_count,
            "current_agent": "writer"
        }
    except Exception as e:
        error_log = list(state.get("error_log", []))
        error_log.append(f"Writer failed: {str(e)}")
        
        updated_outputs = dict(agent_outputs)
        updated_outputs["writer"] = f"Writer failed to generate content due to: {str(e)}"
        
        return {
            "agent_outputs": updated_outputs,
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }
