import datetime
import hashlib
import uuid
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from sqlalchemy.orm import Session
from backend.db.models import TaskRun, GuestQuery, get_db
from backend.graph.builder import graph
from backend.api.auth import get_current_user


router = APIRouter(prefix="/api")

class CreateRunRequest(BaseModel):
    task: str

class CreateRunResponse(BaseModel):
    run_id: str
    status: str

class InterruptRequest(BaseModel):
    instruction: str

class TaskRunSchema(BaseModel):
    id: str
    task: str
    status: str
    final_output: Optional[str] = None
    step_count: int
    token_cost_usd: Optional[float] = 0.0
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    trace_url: Optional[str] = None
    rating: Optional[str] = None

    class Config:
        from_attributes = True

# We will define the run_graph_task callback in main.py and import/reference it,
# or we can declare a registry or pass a callback.
# To avoid circular imports, main.py will register or import this router.
# We can trigger the background task by using a callback reference that main.py sets up.
_run_graph_callback = None
active_run_tasks = {}

def register_run_callback(callback_fn):
    global _run_graph_callback
    _run_graph_callback = callback_fn

def get_rate_limit_info(user_id: str, client_ip: str, db: Session):
    """
    Checks rate limits:
    - Guest user: max 2 runs per hour (tracked via hashed client IP).
    - Logged-in/other users: max 4 runs per hour (tracked via TaskRun).
    """
    now = datetime.datetime.utcnow()
    one_hour_ago = now - datetime.timedelta(hours=1)
    
    # Self-cleanup of older guest query logs (older than 24 hours)
    try:
        twenty_four_hours_ago = now - datetime.timedelta(hours=24)
        db.query(GuestQuery).filter(GuestQuery.created_at < twenty_four_hours_ago).delete()
        db.commit()
    except Exception as e:
        print(f"Error cleaning up old guest queries: {e}")
        db.rollback()

    if user_id == "guest_user":
        ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()
        recent_queries = db.query(GuestQuery).filter(
            GuestQuery.ip_hash == ip_hash,
            GuestQuery.created_at >= one_hour_ago
        ).order_by(GuestQuery.created_at.asc()).all()
        
        if len(recent_queries) >= 2:
            reset_at = recent_queries[0].created_at + datetime.timedelta(hours=1)
            return True, reset_at.isoformat() + "Z"
        return False, None
    else:
        recent_runs = db.query(TaskRun).filter(
            TaskRun.user_id == user_id,
            TaskRun.created_at >= one_hour_ago
        ).order_by(TaskRun.created_at.asc()).all()
        
        if len(recent_runs) >= 4:
            reset_at = recent_runs[0].created_at + datetime.timedelta(hours=1)
            return True, reset_at.isoformat() + "Z"
        return False, None

@router.get("/rate-limit-status")
def get_rate_limit_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    client_ip = request.client.host if request.client else "unknown"
    is_limited, reset_at = get_rate_limit_info(current_user_id, client_ip, db)
    return {
        "rate_limited": is_limited,
        "reset_at": reset_at,
        "user_id": current_user_id
    }

@router.post("/runs", response_model=CreateRunResponse)
def create_run(
    req: CreateRunRequest, 
    background_tasks: BackgroundTasks, 
    request: Request,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    # 0. Check Rate Limit
    client_ip = request.client.host if request.client else "unknown"
    is_limited, reset_at = get_rate_limit_info(current_user_id, client_ip, db)
    if is_limited:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "You are out of free messages",
                "reset_at": reset_at
            }
        )

    # 1. Log guest query if guest
    if current_user_id == "guest_user":
        ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest()
        guest_q = GuestQuery(ip_hash=ip_hash)
        db.add(guest_q)
        db.commit()

    # 2. Create TaskRun in DB
    run_id = str(uuid.uuid4())
    
    if current_user_id != "guest_user":
        db_run = TaskRun(
            id=run_id,
            task=req.task,
            status="running",
            step_count=0,
            token_cost_usd=0.0,
            user_id=current_user_id
        )
        db.add(db_run)
        db.commit()
        db.refresh(db_run)

    # 3. Launch graph execution in background task
    if _run_graph_callback:
        background_tasks.add_task(_run_graph_callback, run_id, req.task)
    else:
        print("Warning: Graph background execution callback not registered.")
        
    return CreateRunResponse(run_id=run_id, status="running")

@router.get("/runs/{run_id}", response_model=TaskRunSchema)
def get_run(
    run_id: str, 
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not db_run:
        if current_user_id == "guest_user":
            return TaskRun(
                id=run_id,
                task="Guest Task",
                status="running",
                step_count=0,
                token_cost_usd=0.0,
                user_id="guest_user",
                created_at=datetime.datetime.utcnow()
            )
        raise HTTPException(status_code=404, detail="TaskRun not found")
    if db_run.user_id and db_run.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this run")
    return db_run

@router.get("/runs", response_model=List[TaskRunSchema])
def get_runs(
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    if current_user_id == "guest_user":
        return []
    # Returns last 20 TaskRuns belonging to the user (or unowned local dev runs) ordered by created_at desc
    return db.query(TaskRun).filter(
        (TaskRun.user_id == current_user_id) | (TaskRun.user_id == None)
    ).order_by(TaskRun.created_at.desc()).limit(20).all()


@router.post("/runs/{run_id}/interrupt")
async def interrupt_run(
    run_id: str, 
    req: InterruptRequest, 
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    if current_user_id != "guest_user":
        db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
        if not db_run:
            raise HTTPException(status_code=404, detail="TaskRun not found")
        if db_run.user_id and db_run.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this run")
        
    try:
        # In LangGraph, we can inject human feedback / state updates
        # by updating the state of the thread.
        config = {"configurable": {"thread_id": run_id}}
        
        # We fetch the current state, and update it with the new user instruction
        current_state = await graph.aget_state(config)
        agent_outputs = dict(current_state.values.get("agent_outputs", {}))
        
        # Store in the out-of-band feedback store so it is picked up immediately
        from backend.agents.feedback_store import store_feedback
        store_feedback(run_id, req.instruction)

        # Inject the human feedback into a dedicated state field
        agent_outputs["human_feedback"] = req.instruction
        agent_outputs["critic_retries"] = "0"  # Reset loop count on user interruption to allow more edits
        
        # Update graph state
        await graph.aupdate_state(
            config, 
            {
                "agent_outputs": agent_outputs, 
                "current_agent": "supervisor"  # Force route back to supervisor to process feedback
            }, 
            as_node="supervisor"
        )
        
        return {"status": "interrupted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to interrupt run: {str(e)}")

@router.delete("/runs/{run_id}")
def delete_run(
    run_id: str, 
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    if current_user_id == "guest_user":
        return {"status": "deleted"}
    db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not db_run:
        raise HTTPException(status_code=404, detail="TaskRun not found")
    if db_run.user_id and db_run.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this run")
    db.delete(db_run)
    db.commit()
    return {"status": "deleted"}


class FeedbackRequest(BaseModel):
    rating: str  # "up" | "down"


@router.post("/runs/{run_id}/cancel")
async def cancel_run(
    run_id: str,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    if current_user_id != "guest_user":
        db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
        if not db_run:
            raise HTTPException(status_code=404, detail="TaskRun not found")
        if db_run.user_id and db_run.user_id != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this run")
            
    # Look up background task
    task = active_run_tasks.get(run_id)
    if not task:
        raise HTTPException(status_code=400, detail="Task is not active or already completed")
        
    task.cancel()
    
    if current_user_id != "guest_user":
        db_run.status = "cancelled"
        db.commit()
        
    return {"status": "cancelled"}


@router.post("/runs/{run_id}/feedback")
def submit_feedback(
    run_id: str,
    req: FeedbackRequest,
    db: Session = Depends(get_db),
    current_user_id: str = Depends(get_current_user)
):
    if current_user_id == "guest_user":
        raise HTTPException(status_code=403, detail="Guest users cannot submit feedback")
        
    db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not db_run:
        raise HTTPException(status_code=404, detail="TaskRun not found")
    if db_run.user_id and db_run.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this run")
        
    if req.rating not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Invalid rating. Must be 'up' or 'down'")
        
    db_run.rating = req.rating
    db.commit()
    return {"status": "success", "rating": req.rating}
