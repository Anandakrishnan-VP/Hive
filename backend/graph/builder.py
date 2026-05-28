import json
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from backend.agents.state import AgentState
from backend.agents.supervisor import supervisor
from backend.agents.researcher import researcher
from backend.agents.coder import coder
from backend.agents.writer import writer
from backend.agents.critic import critic
from backend.config import settings, USE_REDIS

def route_next(state: AgentState) -> str:
    """Routes to the next agent based on the supervisor's decision."""
    # Safety gate: limit the maximum number of execution steps
    if state.get("step_count", 0) >= settings.MAX_STEPS:
        return END
        
    next_agent = state.get("current_agent", "END")
    if next_agent == "END":
        return END
        
    # Map next_agent string to graph nodes
    valid_agents = ["researcher", "coder", "writer", "critic"]
    if next_agent in valid_agents:
        return next_agent
        
    return END

from langchain_core.runnables import RunnableConfig

def critic_gate(state: AgentState, config: RunnableConfig = None) -> str:
    """Evaluates the critic's output and determines if we should loop or finish."""
    from backend.agents.feedback_store import log_debug
    log_debug(f"critic_gate: executing. config is: {config}")
    run_id = None
    if config:
        if hasattr(config, "get"):
            run_id = config.get("configurable", {}).get("thread_id")
        elif hasattr(config, "configurable"):
            run_id = getattr(config, "configurable", {}).get("thread_id")
            
    log_debug(f"critic_gate: resolved run_id is: {run_id}")
    if run_id:
        try:
            from backend.agents.feedback_store import peek_feedback
            feedback = peek_feedback(run_id)
            log_debug(f"critic_gate: peeked feedback is: {feedback}")
            if feedback:
                return "supervisor"
        except Exception as e:
            log_debug(f"critic_gate: error peeking feedback: {e}")

    # Safety gate
    if state.get("step_count", 0) >= settings.MAX_STEPS:
        return END
        
    try:
        critic_out = state.get("agent_outputs", {}).get("critic", "{}")
        critic_data = json.loads(critic_out)
        passed = critic_data.get("passed", False)
    except Exception:
        # Default to passed if critic output is missing/unparseable
        passed = True
        
    if passed:
        return END
        
    # Check loop retry budget (max 2 loops)
    # The counter is incremented inside the critic node
    retries = int(state.get("agent_outputs", {}).get("critic_retries", 0))
    if retries < 2:
        return "writer"
    
    return END

def compile_graph():
    """Assembles the state graph with nodes, edges, conditional routes, and checkpointers."""
    builder = StateGraph(AgentState)
    
    # Add all specialist and supervisor nodes
    builder.add_node("supervisor", supervisor)
    builder.add_node("researcher", researcher)
    builder.add_node("coder", coder)
    builder.add_node("writer", writer)
    builder.add_node("critic", critic)
    
    # Set the starting node
    builder.add_edge(START, "supervisor")
    
    # supervisor routes conditionally to worker nodes or END
    builder.add_conditional_edges(
        "supervisor",
        route_next,
        {
            "researcher": "researcher",
            "coder": "coder",
            "writer": "writer",
            "critic": "critic",
            END: END
        }
    )
    
    # Worker nodes always route back to the supervisor
    builder.add_edge("researcher", "supervisor")
    builder.add_edge("coder", "supervisor")
    builder.add_edge("writer", "supervisor")
    
    # Critic routes to critic_gate which decides whether to rewrite or finish
    builder.add_conditional_edges(
        "critic",
        critic_gate,
        {
            "writer": "writer",
            "supervisor": "supervisor",
            END: END
        }
    )
    
    # Configure checkpointing: Redis for production/Docker, MemorySaver for local dev
    if USE_REDIS:
        try:
            from langgraph.checkpoint.redis import RedisSaver
            saver = RedisSaver.from_conn_string(settings.REDIS_URL)
            return builder.compile(checkpointer=saver)
        except Exception as e:
            print(f"Redis checkpointer failed to initialize: {e}. Falling back to MemorySaver.")
            return builder.compile(checkpointer=MemorySaver())
    else:
        return builder.compile(checkpointer=MemorySaver())

graph = compile_graph()
