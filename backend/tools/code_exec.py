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
        from e2b_code_interpreter import Sandbox
        # Run code in E2B sandbox
        with Sandbox.create(api_key=api_key) as sandbox:
            execution = sandbox.run_code(code)
            
            stdout = "".join(execution.logs.stdout)
            stderr = "".join(execution.logs.stderr)
            
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
