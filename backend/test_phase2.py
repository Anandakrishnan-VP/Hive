import uuid
import json
from backend.config import settings
from backend.graph.builder import graph

def main():
    print("--- Phase 2: Full Multi-Agent Graph Test ---")
    print(f"Model Name: {settings.MODEL_NAME}")
    print(f"Google API Key status: {'Set' if settings.GOOGLE_API_KEY else 'Not Set'}")
    print(f"Tavily API Key status: {'Set' if settings.TAVILY_API_KEY else 'Not Set'}")
    print(f"E2B API Key status: {'Set' if settings.E2B_API_KEY else 'Not Set'}")
    
    run_id = str(uuid.uuid4())
    print(f"Run ID: {run_id}")
    
    task = (
        "Research LangGraph vs CrewAI in 2026 and write a short technical comparison "
        "with a Python code example showing a simple LangGraph graph"
    )
    
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
    
    print(f"\nTask: {task}")
    print("\nInvoking graph and streaming nodes...\n")
    
    last_state = initial_state
    try:
        # Stream the nodes execution
        for event in graph.stream(initial_state, config):
            for node_name, state_delta in event.items():
                print(f"\n================ Node: [{node_name}] Finished ================")
                last_state.update(state_delta)
                
                current_agent = state_delta.get("current_agent", "")
                if current_agent:
                    print(f"Active Agent: {current_agent}")
                    agent_outputs = state_delta.get("agent_outputs", {})
                    if current_agent in agent_outputs:
                        out_val = agent_outputs[current_agent]
                        try:
                            # format JSON for researcher/coder/critic
                            parsed = json.loads(out_val)
                            print(f"Output (JSON):\n{json.dumps(parsed, indent=2)[:600]}...")
                        except Exception:
                            # plain text/markdown for writer
                            print(f"Output:\n{out_val[:600]}...")
                            
                if "task_plan" in state_delta:
                    print(f"Task Plan: {state_delta['task_plan']}")
                if "step_count" in state_delta:
                    print(f"Total step count: {state_delta['step_count']}")
                if "error_log" in state_delta and state_delta["error_log"]:
                    print(f"Errors logged: {state_delta['error_log']}")
    except Exception as e:
        print(f"\nGraph execution crashed with exception: {e}")
        return

    print("\n\n================ FINAL RESULT ================")
    final_writer_draft = last_state.get("agent_outputs", {}).get("writer", "No writer draft generated.")
    print("Writer final output:")
    print(final_writer_draft)
    
    print("\n================ METRICS ================")
    print(f"Total execution steps: {last_state.get('step_count')}")
    print(f"Critic final review: {last_state.get('agent_outputs', {}).get('critic', 'Not reviewed')}")
    print(f"Errors logged: {last_state.get('error_log')}")

if __name__ == "__main__":
    main()
