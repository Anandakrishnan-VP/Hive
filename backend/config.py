import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

# Load .env file explicitly if it exists
load_dotenv_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
if os.path.exists(load_dotenv_path):
    from dotenv import load_dotenv
    load_dotenv(load_dotenv_path)

class Settings(BaseSettings):
    # LLM configuration
    GROQ_API_KEY: Optional[str] = None
    MODEL_NAME: str = "llama-3.3-70b-versatile"
    
    # Tool keys
    TAVILY_API_KEY: Optional[str] = None
    E2B_API_KEY: Optional[str] = None
    
    # Observability
    LANGSMITH_API_KEY: Optional[str] = None
    LANGSMITH_PROJECT: str = "multi-agent-system"
    
    # Databases & Checkpointing
    REDIS_URL: Optional[str] = None
    DATABASE_URL: Optional[str] = None
    
    # Graph guards
    MAX_STEPS: int = 15

    # Load from .env file
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()

# Setup LangSmith tracing automatically if API key is provided
if settings.LANGSMITH_API_KEY:
    os.environ["LANGCHAIN_TRACING_V2"] = "true"
    os.environ["LANGCHAIN_API_KEY"] = settings.LANGSMITH_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = settings.LANGSMITH_PROJECT

# Compute dynamic feature flags
USE_REDIS = bool(settings.REDIS_URL)
USE_POSTGRES = bool(settings.DATABASE_URL)

# Output for SQLite fallback if not using Postgres
SQLITE_DB_URL = "sqlite:///./hive.db"
DATABASE_URL_RESOLVED = settings.DATABASE_URL if USE_POSTGRES else SQLITE_DB_URL
