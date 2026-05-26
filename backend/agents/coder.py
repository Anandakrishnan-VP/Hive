import json
from backend.agents.state import AgentState
from backend.config import settings
from backend.tools.code_exec import execute_python
from backend.llm import get_llm
from langchain_core.messages import SystemMessage, HumanMessage, ToolMessage

def coder(state: AgentState) -> dict:
    """Coder agent that writes and executes Python code inside E2B sandbox to complete the task."""
    if not settings.GROQ_API_KEY:
        agent_outputs = dict(state.get("agent_outputs", {}))
        agent_outputs["coder"] = json.dumps({
            "code": "",
            "output": "Error: Groq API key missing",
            "explanation": "Cannot run coder."
        })
        error_log = list(state.get("error_log", []))
        error_log.append("GROQ_API_KEY is missing in coder.")
        return {
            "agent_outputs": agent_outputs,
            "error_log": error_log,
            "step_count": state.get("step_count", 0) + 1
        }

    # Initialize model dynamically
    llm = get_llm(temperature=0.2)
    
    # Bind execute_python tool
    llm_with_tools = llm.bind_tools([execute_python])
    
    system_prompt = (
        "You are a software engineer. Write clean, working Python code for the given task. "
        "Always execute your code to verify it works using the execute_python tool. "
        "Once you verify the execution, return a JSON response in the following format:\n"
        "{\n"
        "  \"code\": \"python code here\",\n"
        "  \"output\": \"output of running the code\",\n"
        "  \"explanation\": \"explanation of the code and output\"\n"
        "}\n"
        "Ensure you output ONLY the valid JSON object. Do not wrap in markdown code blocks."
    )
    
    # Get instructions
    instruction = state.get("agent_outputs", {}).get("supervisor_instruction")
    if not instruction:
        instruction = state["task"]
        
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=instruction)
    ]
    
    step_tool_calls = []
    
    # Run loop (max 5 tool calls)
    for _ in range(5):
        response = llm_with_tools.invoke(messages)
        messages.append(response)
        
        if not response.tool_calls:
            break
            
        for tc in response.tool_calls:
            tool_name = tc["name"]
            tool_args = tc["args"]
            tool_id = tc["id"]
            
            # Execute python code
            if tool_name == "execute_python":
                # Ensure we pass the code argument properly.
                # E2B tool expects 'code' key
                code_to_run = tool_args.get("code") if isinstance(tool_args, dict) else tool_args
                result = execute_python.invoke({"code": code_to_run})
            else:
                result = json.dumps({"stdout": "", "stderr": f"Unknown tool: {tool_name}", "success": False})
                
            # Log the tool call
            step_tool_calls.append({
                "type": "tool_call",
                "agent": "coder",
                "data": {
                    "tool": tool_name,
                    "args": tool_args,
                    "result": result
                },
                "step": state.get("step_count", 0) + 1
            })
            
            # Append tool result
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
    agent_outputs["coder"] = cleaned_text
    
    tool_calls = list(state.get("tool_calls", []))
    tool_calls.extend(step_tool_calls)
    
    step_count = state.get("step_count", 0) + 1
    
    return {
        "agent_outputs": agent_outputs,
        "tool_calls": tool_calls,
        "step_count": step_count,
        "current_agent": "coder"
    }
