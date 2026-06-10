import json
import asyncio
from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from backend.agents.state import AgentState
from backend.agents.supervisor import supervisor
from backend.agents.researcher import researcher
from backend.agents.coder import coder
from backend.agents.writer import writer
from backend.agents.critic import critic
from backend.config import settings
from langgraph.checkpoint.serde.jsonplus import JsonPlusSerializer

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

from backend.config import settings, USE_POSTGRES
from typing import Any, Sequence, Iterator, AsyncIterator
from langgraph.checkpoint.base import BaseCheckpointSaver, Checkpoint, CheckpointMetadata, CheckpointTuple, ChannelVersions

from langgraph.checkpoint.postgres import PostgresSaver

class AsyncSafePostgresSaver(PostgresSaver):
    async def aget_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:
        return await asyncio.to_thread(self.get_tuple, config)

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: ChannelVersions,
    ) -> RunnableConfig:
        return await asyncio.to_thread(self.put, config, checkpoint, metadata, new_versions)

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[tuple[str, Any]],
        task_id: str,
        task_path: str = "",
    ) -> None:
        await asyncio.to_thread(self.put_writes, config, writes, task_id, task_path)

    async def adelete_thread(self, thread_id: str) -> None:
        if hasattr(super(), "delete_thread"):
            await asyncio.to_thread(super().delete_thread, thread_id)

    async def alist(
        self,
        config: RunnableConfig | None,
        *,
        filter: dict[str, Any] | None = None,
        before: RunnableConfig | None = None,
        limit: int | None = None,
    ) -> AsyncIterator[CheckpointTuple]:
        items = await asyncio.to_thread(
            lambda: list(self.list(config, filter=filter, before=before, limit=limit))
        )
        for item in items:
            yield item

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
    
    # Configure checkpointing: Postgres (Supabase) if available, Redis as secondary fallback, MemorySaver for local dev
    if USE_POSTGRES:
        try:
            print("Using PostgreSQL (Supabase) for checkpoint saver.")
            from psycopg_pool import ConnectionPool
            from psycopg.rows import dict_row
            pool = ConnectionPool(
                conninfo=settings.DATABASE_URL,
                kwargs={"autocommit": True, "prepare_threshold": None, "row_factory": dict_row},
                open=False
            )
            pool.open()
            saver = AsyncSafePostgresSaver(conn=pool)
            saver.setup()
            return builder.compile(checkpointer=saver)
        except Exception as e:
            print(f"PostgreSQL checkpointer failed to initialize: {e}. Falling back to MemorySaver.")
            return builder.compile(checkpointer=MemorySaver())
    else:
        return builder.compile(checkpointer=MemorySaver())

graph = compile_graph()


