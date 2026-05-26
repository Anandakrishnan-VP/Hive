import uuid
from backend.config import settings
from backend.graph.builder import graph

def main():
    print("--- Phase 1 Test ---")
    print(f"Model Name: {settings.MODEL_NAME}")
    print(f"Google API Key status: {'Set' if settings.GOOGLE_API_KEY else 'Not Set'}")
    print(f"Tavily API Key status: {'Set' if settings.TAVILY_API_KEY else 'Not Set'}")
    
    run_id = str(uuid.uuid4())
    print(f"Run ID: {run_id}")
    
    # Run the graph
    initial_state = {
        "task": "What are the top 3 AI agent frameworks in 2026?",
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
    
    print("\nInvoking graph...")
    result = graph.invoke(initial_state, config)
    
    print("\n--- Execution Finished ---")
    researcher_output = result.get("agent_outputs", {}).get("researcher", "No researcher output found.")
    print("Researcher JSON Output:")
    print(researcher_output)
    
    print(f"\nStep Count: {result.get('step_count')}")
    print(f"Errors: {result.get('error_log')}")
    
    # LangSmith Trace URL
    if settings.LANGSMITH_API_KEY:
        print(f"\nLangSmith Trace URL: https://smith.langchain.com/projects/p/{settings.LANGSMITH_PROJECT}")
    else:
        print("\nLangSmith Tracing not active (LANGSMITH_API_KEY not set).")

if __name__ == "__main__":
    main()
