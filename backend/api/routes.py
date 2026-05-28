import datetime
from typing import List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from backend.db.models import TaskRun, get_db
from backend.graph.builder import graph

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

    class Config:
        from_attributes = True

# We will define the run_graph_task callback in main.py and import/reference it,
# or we can declare a registry or pass a callback.
# To avoid circular imports, main.py will register or import this router.
# We can trigger the background task by using a callback reference that main.py sets up.
_run_graph_callback = None

def register_run_callback(callback_fn):
    global _run_graph_callback
    _run_graph_callback = callback_fn

@router.post("/runs", response_model=CreateRunResponse)
def create_run(
    req: CreateRunRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    # 1. Create TaskRun in DB
    run_id = str(datetime.datetime.utcnow().timestamp()).replace(".", "")  # Unique numerical run ID or UUID
    # Let's use standard UUID
    import uuid
    run_id = str(uuid.uuid4())
    
    db_run = TaskRun(
        id=run_id,
        task=req.task,
        status="running",
        step_count=0,
        token_cost_usd=0.0
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)

    # 2. Launch graph execution in background task
    if _run_graph_callback:
        background_tasks.add_task(_run_graph_callback, run_id, req.task)
    else:
        print("Warning: Graph background execution callback not registered.")
        
    return CreateRunResponse(run_id=run_id, status="running")

@router.get("/runs/{run_id}", response_model=TaskRunSchema)
def get_run(run_id: str, db: Session = Depends(get_db)):
    db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not db_run:
        raise HTTPException(status_code=404, detail="TaskRun not found")
    return db_run

@router.get("/runs", response_model=List[TaskRunSchema])
def get_runs(db: Session = Depends(get_db)):
    # Returns last 20 TaskRuns ordered by created_at desc
    return db.query(TaskRun).order_by(TaskRun.created_at.desc()).limit(20).all()

@router.post("/runs/{run_id}/interrupt")
def interrupt_run(run_id: str, req: InterruptRequest, db: Session = Depends(get_db)):
    db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not db_run:
        raise HTTPException(status_code=404, detail="TaskRun not found")
        
    try:
        # In LangGraph, we can inject human feedback / state updates
        # by updating the state of the thread.
        config = {"configurable": {"thread_id": run_id}}
        
        # We fetch the current state, and update it with the new user instruction
        current_state = graph.get_state(config)
        agent_outputs = dict(current_state.values.get("agent_outputs", {}))
        
        # Store in the out-of-band feedback store so it is picked up immediately
        from backend.agents.feedback_store import store_feedback
        store_feedback(run_id, req.instruction)

        # Inject the human feedback into a dedicated state field
        agent_outputs["human_feedback"] = req.instruction
        agent_outputs["critic_retries"] = "0"  # Reset loop count on user interruption to allow more edits
        
        # Update graph state
        graph.update_state(
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
def delete_run(run_id: str, db: Session = Depends(get_db)):
    db_run = db.query(TaskRun).filter(TaskRun.id == run_id).first()
    if not db_run:
        raise HTTPException(status_code=404, detail="TaskRun not found")
    db.delete(db_run)
    db.commit()
    return {"status": "deleted"}
