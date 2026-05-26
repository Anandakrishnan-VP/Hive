import asyncio
import datetime
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db.models import init_db, TaskRun, SessionLocal
from backend.api.routes import router, register_run_callback
from backend.api.websocket import manager
from backend.graph.builder import graph

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables on startup
    init_db()
    print("Database tables initialized successfully.")
    yield

app = FastAPI(title="Hive Multi-Agent System API", lifespan=lifespan)

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

@app.get("/health")
def health_check():
    return {"status": "ok"}

# WebSocket Endpoint
@app.websocket("/ws/{run_id}")
async def websocket_endpoint(websocket: WebSocket, run_id: str):
    await manager.connect(run_id, websocket)
    
    # Task to keep connection alive with ping every 30s
    async def keep_alive():
        try:
            while True:
                await asyncio.sleep(30)
                await websocket.send_json({"type": "ping"})
        except Exception:
            pass

    keep_alive_task = asyncio.create_task(keep_alive())
    
    try:
        while True:
            # Keep receiving messages to detect disconnects
            data = await websocket.receive_text()
            # If clients send messages, we can process them here if needed
    except WebSocketDisconnect:
        manager.disconnect(run_id, websocket)
    finally:
        keep_alive_task.cancel()

async def run_graph_task(run_id: str, task: str):
    """Background task to run the LangGraph and stream events via WebSockets."""
    initial_state = {
        "task": task,
        "task_plan": [],
        "current_agent": "",
        "agent_outputs": {},
        "tool_calls": [],
        "step_count": 0,
        "error_log": [],
        "final_output": "",
        "run_id": run_id,
        "status": "running"
    }
    
    config = {
        "configurable": {
            "thread_id": run_id
        }
    }
    
    db = SessionLocal()
    
    try:
        # Send initial start event
        await manager.send_event(run_id, {
            "type": "agent_start",
            "agent": "supervisor",
            "data": {"message": "Supervisor is preparing execution plan..."},
            "step": 0
        })
        
        last_delta_state = initial_state
        
        # Stream from LangGraph
        async for event in graph.astream(initial_state, config):
            for node_name, state_delta in event.items():
                # Merge delta state
                last_delta_state.update(state_delta)
                step = last_delta_state.get("step_count", 0)
                
                # 1. Send agent_start event
                await manager.send_event(run_id, {
                    "type": "agent_start",
                    "agent": node_name,
                    "data": {"message": f"Agent [{node_name}] started working."},
                    "step": step
                })
                
                # 2. Extract tool calls that occurred in this step
                tool_calls = state_delta.get("tool_calls", [])
                for tc in tool_calls:
                    if tc.get("step") == step:
                        tc_data = tc.get("data", {})
                        tool_name = tc_data.get("tool", "")
                        tool_args = tc_data.get("args", {})
                        tool_result = tc_data.get("result", "")
                        
                        await manager.send_event(run_id, {
                            "type": "tool_call",
                            "agent": node_name,
                            "data": {"tool": tool_name, "args": tool_args},
                            "step": step
                        })
                        
                        await manager.send_event(run_id, {
                            "type": "tool_result",
                            "agent": node_name,
                            "data": {"tool": tool_name, "result": tool_result},
                            "step": step
                        })
                
                # 3. Send agent_end event with the output
                agent_outputs = state_delta.get("agent_outputs", {})
                agent_output = agent_outputs.get(node_name, "")
                
                await manager.send_event(run_id, {
                    "type": "agent_end",
                    "agent": node_name,
                    "data": {"output": agent_output},
                    "step": step
                })
                
        # Retrieve final draft from writer
        final_output = last_delta_state.get("agent_outputs", {}).get("writer", "")
        if not final_output:
            final_output = last_delta_state.get("agent_outputs", {}).get("researcher", "Execution finished.")

        # Update DB run
        db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
        if db_run:
            db_run.status = "complete"
            db_run.final_output = final_output
            db_run.step_count = last_delta_state.get("step_count", 0)
            db_run.completed_at = datetime.datetime.utcnow()
            # If LangSmith trace is active, save a simulated trace URL
            if settings.LANGSMITH_API_KEY:
                db_run.trace_url = f"https://smith.langchain.com/projects/p/{settings.LANGSMITH_PROJECT}"
            db.commit()
            
        # Send final complete WS event
        await manager.send_event(run_id, {
            "type": "complete",
            "agent": "supervisor",
            "data": {
                "final_output": final_output,
                "step_count": last_delta_state.get("step_count", 0)
            },
            "step": last_delta_state.get("step_count", 0)
        })
        
    except Exception as e:
        print(f"Error in background graph run {run_id}: {str(e)}")
        traceback.print_exc()
        
        # Update DB with error status
        db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
        if db_run:
            db_run.status = "error"
            db_run.completed_at = datetime.datetime.utcnow()
            db.commit()
            
        # Send error WS event
        await manager.send_event(run_id, {
            "type": "error",
            "agent": "supervisor",
            "data": {"message": f"Execution failed: {str(e)}"},
            "step": last_delta_state.get("step_count", 0) if 'last_delta_state' in locals() else 0
        })
    finally:
        db.close()

# Register the background execution task in routes
register_run_callback(run_graph_task)
