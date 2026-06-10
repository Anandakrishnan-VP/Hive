import sys
import asyncio
import os

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import datetime
import traceback
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.db.models import init_db, TaskRun, SessionLocal
from backend.api.routes import router, register_run_callback, active_run_tasks
from backend.api.websocket import manager
from backend.graph.builder import graph
from backend.api.auth import verify_token
from jose import jwt, JWTError


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables on startup
    init_db()
    print("Database tables initialized successfully.")
    yield

app = FastAPI(title="Hive Multi-Agent System API", lifespan=lifespan)

# Add CORS Middleware
# In production, ALLOWED_ORIGINS should be a comma-separated list of allowed URLs
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_str:
    allowed_origins = [origin.strip() for origin in allowed_origins_str.split(",") if origin.strip()]
else:
    # Fallback: allow all in development, restrict in production
    allowed_origins = ["*"] if settings.ENVIRONMENT != "production" else []

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

from sqlalchemy import text
from fastapi.responses import JSONResponse

@app.get("/health")
def health_check():
    health_status = {"status": "ok", "database": "unknown"}
    try:
        db = SessionLocal()
        # Execute a simple query to verify connection
        db.execute(text("SELECT 1"))
        health_status["database"] = "connected"
    except Exception as e:
        health_status["status"] = "error"
        health_status["database"] = f"unreachable: {str(e)}"
        return JSONResponse(status_code=500, content=health_status)
    finally:
        db.close()
    return health_status

# WebSocket Endpoint
@app.websocket("/ws/{run_id}")
async def websocket_endpoint(websocket: WebSocket, run_id: str):
    # 1. Authenticate WebSocket via token query parameter
    token = websocket.query_params.get("token")
    user_id = "local_dev_user"
    
    if settings.SUPABASE_URL or settings.SUPABASE_JWT_SECRET:
        if not token:
            await websocket.accept()
            await websocket.send_json({"type": "error", "data": {"message": "Unauthorized: Missing authentication token"}})
            await websocket.close(code=4003)
            return
        try:
            user_id = verify_token(token)
        except Exception as e:
            await websocket.accept()
            await websocket.send_json({"type": "error", "data": {"message": f"Unauthorized: Invalid token: {str(e)}"}})
            await websocket.close(code=4003)
            return

    # 2. Check that the run exists and belongs to this user
    db = SessionLocal()
    try:
        db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
        if db_run and db_run.user_id and db_run.user_id != user_id:
            await websocket.accept()
            await websocket.send_json({"type": "error", "data": {"message": "Forbidden: You do not own this run"}})
            await websocket.close(code=4003)
            return
    finally:
        db.close()

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
        # Register current task
        active_run_tasks[run_id] = asyncio.current_task()

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
        
    except asyncio.CancelledError:
        print(f"Task run {run_id} cancelled by operator.")
        # Update DB run
        db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
        if db_run:
            db_run.status = "cancelled"
            db_run.completed_at = datetime.datetime.utcnow()
            db.commit()
            
        # Send cancelled WS event
        await manager.send_event(run_id, {
            "type": "cancelled",
            "agent": "supervisor",
            "data": {"message": "Execution cancelled by operator"},
            "step": last_delta_state.get("step_count", 0) if 'last_delta_state' in locals() else 0
        })
        raise
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
        active_run_tasks.pop(run_id, None)
        db.close()

# Register the background execution task in routes
register_run_callback(run_graph_task)
