import datetime
from typing import Dict, List, Any
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        # Maps run_id to list of active WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, run_id: str, websocket: WebSocket):
        await websocket.accept()
        if run_id not in self.active_connections:
            self.active_connections[run_id] = []
        self.active_connections[run_id].append(websocket)
        print(f"WS client connected for run_id: {run_id}")

    def disconnect(self, run_id: str, websocket: WebSocket):
        if run_id in self.active_connections:
            self.active_connections[run_id].remove(websocket)
            if not self.active_connections[run_id]:
                del self.active_connections[run_id]
            print(f"WS client disconnected for run_id: {run_id}")

    async def send_event(self, run_id: str, event: Dict[str, Any]):
        """Pushes an agent event to all active WebSockets matching the run_id."""
        if run_id in self.active_connections:
            # Add timestamp if missing
            if "timestamp" not in event:
                event["timestamp"] = datetime.datetime.utcnow().isoformat() + "Z"
                
            connections = self.active_connections[run_id]
            # Copy list to prevent mutation errors during traversal
            for websocket in list(connections):
                try:
                    await websocket.send_json(event)
                except Exception as e:
                    print(f"Error sending WS event: {e}. Cleaning up connection.")
                    self.disconnect(run_id, websocket)

manager = ConnectionManager()
