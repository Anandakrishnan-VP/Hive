import os
from typing import Optional
from backend.config import settings

def get_llm(agent_name: Optional[str] = None, temperature: float = 0.1):
    """
    Dynamically loads and returns the configured Chat LLM for a specific agent.
    Supports provider-prefixed models (e.g., 'groq/llama-3.3-70b-versatile', 'gemini/gemini-2.5-flash').
    """
    # 1. Resolve model name for the agent
    model_name = settings.MODEL_NAME
    if agent_name:
        agent_key = f"{agent_name.upper()}_MODEL"
        model_name = getattr(settings, agent_key, settings.MODEL_NAME)
        
    # 2. Parse provider and actual model
    provider = "groq"
    actual_model = model_name
    
    if "/" in model_name:
        parts = model_name.split("/", 1)
        provider = parts[0].lower()
        actual_model = parts[1]
    elif "gemini" in model_name.lower():
        provider = "gemini"

    # 3. Instantiate the correct provider model class
    if provider == "groq":
        if not settings.GROQ_API_KEY or not settings.GROQ_API_KEY.strip():
            raise ValueError(
                f"GROQ_API_KEY is missing. Required for agent '{agent_name or 'default'}' ({model_name})."
            )
        try:
            from langchain_groq import ChatGroq
        except ImportError:
            raise ImportError(
                "The 'langchain-groq' package is required to use Groq API. "
                "Please run: pip install langchain-groq"
            )
        return ChatGroq(
            model=actual_model,
            groq_api_key=settings.GROQ_API_KEY,
            temperature=temperature
        )
        
    elif provider in ("gemini", "google"):
        api_key = settings.GEMINI_API_KEY or os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise ValueError(
                f"GEMINI_API_KEY / GOOGLE_API_KEY is missing. Required for agent '{agent_name or 'default'}' ({model_name})."
            )
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError:
            raise ImportError(
                "The 'langchain-google-genai' package is required to use Google/Gemini API. "
                "Please run: pip install langchain-google-genai"
            )
        return ChatGoogleGenerativeAI(
            model=actual_model,
            api_key=api_key,
            temperature=temperature
        )
    else:
        raise ValueError(f"Unsupported provider: {provider}")

