from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    # LangGraph message list with reducer
    messages: Annotated[list, add_messages]
    
    # Original task and execution details
    task: str
    task_plan: List[str]
    current_agent: str
    
    # Key-value storage of final results or raw outputs per agent
    # e.g., {"researcher": "...", "coder": "...", "writer": "...", "critic": "..."}
    agent_outputs: Dict[str, str]
    
    # Audit log of tool calls and results
    tool_calls: List[Dict[str, Any]]
    
    # Graph execution control and tracking
    step_count: int
    error_log: List[str]
    final_output: str
    run_id: str
    status: str  # "running" | "complete" | "error"
