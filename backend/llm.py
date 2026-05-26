import os
from typing import Optional
from backend.config import settings

def get_llm(temperature: float = 0.1):
    """
    Dynamically loads and returns the configured Chat LLM using Groq.
    Requires GROQ_API_KEY to be defined in settings.
    """
    if not settings.GROQ_API_KEY or not settings.GROQ_API_KEY.strip():
        raise ValueError(
            "GROQ_API_KEY is missing. Please specify GROQ_API_KEY in your .env file."
        )
        
    try:
        from langchain_groq import ChatGroq
    except ImportError:
        raise ImportError(
            "The 'langchain-groq' package is required to use Groq API. "
            "Please run: pip install langchain-groq"
        )
    
    # Smart model fallback: if model is gemini, switch to a high-capability Groq model
    model = settings.MODEL_NAME
    if "gemini" in model.lower():
        model = "llama-3.3-70b-versatile"
        
    return ChatGroq(
        model=model,
        groq_api_key=settings.GROQ_API_KEY,
        temperature=temperature
    )

