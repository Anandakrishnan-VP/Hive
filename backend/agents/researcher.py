import json
from backend.agents.state import AgentState
from backend.config import settings
from backend.tools.search import web_search
from backend.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

def researcher(state: AgentState) -> dict:
    """Researcher agent that searches the web to answer research queries and updates state."""
    # Ensure API Key exists
    if not settings.GROQ_API_KEY:
        error_msg = "GROQ_API_KEY is not set. Cannot run researcher."
        agent_outputs = dict(state.get("agent_outputs", {}))
        agent_outputs["researcher"] = json.dumps({
            "findings": ["Error: Groq API key missing"],
            "sources": [],
            "confidence": 0.0
        })
        error_log = list(state.get("error_log", []))
        error_log.append(error_msg)
        return {
            "agent_outputs": agent_outputs,
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }

    # Initialize model dynamically
    llm = get_llm(temperature=0.2)
    
    # Bind the web search tool to the model
    llm_with_tools = llm.bind_tools([web_search])
    
    system_prompt = (
        "You are a research specialist. Given a task, use web_search to find accurate, "
        "up-to-date information. Return a structured JSON with:\n"
        "{\n"
        "  \"findings\": [...],\n"
        "  \"sources\": [...],\n"
        "  \"confidence\": 0.0-1.0\n"
        "}\n"
        "Ensure you output ONLY a valid JSON object. Do not include markdown code block formatting (like ```json) in your final response if possible, or make sure the text contains just the JSON object."
    )
    
    # Retrieve the instruction from state. Fall back to main task.
    instruction = state.get("agent_outputs", {}).get("supervisor_instruction")
    if not instruction:
        instruction = state["task"]
        
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=instruction)
    ]
    
    step_tool_calls = []
    
    # Run the agent loop (max 5 tool calls)
    for _ in range(5):
        response = llm_with_tools.invoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            break
            
        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            tool_id = tc["id"]
            
            # Execute search
            if tool_name == "web_search":
                result = web_search.invoke(tool_args)
            else:
                result = json.dumps({"error": f"Unknown tool: {tool_name}"})
                
            # Log the tool call
            step_tool_calls.append({
                "type": "tool_call",
                "agent": "researcher",
                "data": {
                    "tool": tool_name,
                    "args": tool_args,
                    "result": result
                },
                "step": state.get("step_count", 0) + 1
            })
            
            # Append tool response
            messages.append(ToolMessage(content=result, tool_call_id=tool_id))
            
    final_text = messages[-1].content if messages else ""
    
    # Clean up any potential markdown formatting in JSON
    cleaned_text = final_text.strip()
    if cleaned_text.startswith("```json"):
        cleaned_text = cleaned_text[7:]
    if cleaned_text.startswith("```"):
        cleaned_text = cleaned_text[3:]
    if cleaned_text.endswith("```"):
        cleaned_text = cleaned_text[:-3]
    cleaned_text = cleaned_text.strip()
    
    # Update state variables
    agent_outputs = dict(state.get("agent_outputs", {}))
    agent_outputs["researcher"] = cleaned_text
    
    tool_calls = list(state.get("tool_calls", []))
    tool_calls.extend(step_tool_calls)
    
    step_count = state.get("step_count", 0) + 1
    
    return {
        "agent_outputs": agent_outputs,
        "tool_calls": tool_calls,
        "step_count": step_count,
        "current_agent": "researcher"
    }
