import json
from langchain_core.tools import tool
from backend.config import settings

@tool("execute_python")
def execute_python(code: str) -> str:
    """Execute Python code in a secure sandboxed environment using E2B.
    Takes a Python code string as input.
    Returns a JSON string with keys: stdout, stderr, success.
    """
    api_key = settings.E2B_API_KEY
    if not api_key:
        return json.dumps({
            "stdout": "",
            "stderr": "E2B API key is missing. Please set E2B_API_KEY in your environment.",
            "success": False
        })
        
    try:
        from e2b_code_interpreter import CodeInterpreter
        # Run code in E2B sandbox with a 30 second timeout
        # E2B Python library uses the API key from constructor or env var
        with CodeInterpreter(api_key=api_key) as sandbox:
            execution = sandbox.notebook.exec_cell(code)
            
            stdout = execution.stdout
            stderr = execution.stderr
            
            success = True
            if execution.error:
                success = False
                error_msg = f"{execution.error.name}: {execution.error.value}\n{execution.error.traceback}"
                stderr = f"{stderr}\n{error_msg}".strip()
                
            return json.dumps({
                "stdout": stdout,
                "stderr": stderr,
                "success": success
            })
    except Exception as e:
        return json.dumps({
            "stdout": "",
            "stderr": f"Sandbox execution failure: {str(e)}",
            "success": False
        })
