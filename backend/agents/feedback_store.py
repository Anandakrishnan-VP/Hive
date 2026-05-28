import threading
import datetime

_feedback_lock = threading.Lock()
_pending_feedback = {}

def log_debug(message: str):
    try:
        with open("backend/debug.log", "a", encoding="utf-8") as f:
            f.write(f"[{datetime.datetime.utcnow().isoformat()}] {message}\n")
    except Exception as e:
        print(f"Failed to write to debug log: {e}")

def store_feedback(run_id: str, feedback: str):
    """Stores a pending human steering instruction for a specific task run."""
    log_debug(f"store_feedback: Storing steering for run_id={run_id}: {feedback}")
    with _feedback_lock:
        _pending_feedback[run_id] = feedback

def retrieve_feedback(run_id: str) -> str:
    """Retrieves and clears the pending human steering instruction for a task run."""
    with _feedback_lock:
        feedback = _pending_feedback.pop(run_id, "")
    log_debug(f"retrieve_feedback: Retrieved steering for run_id={run_id}: {feedback}")
    return feedback

def peek_feedback(run_id: str) -> str:
    """Checks if there is a pending steering instruction for a task run without clearing it."""
    with _feedback_lock:
        feedback = _pending_feedback.get(run_id, "")
    log_debug(f"peek_feedback: Peeked steering for run_id={run_id}: {feedback}")
    return feedback
