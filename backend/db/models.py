import uuid
import datetime
from sqlalchemy import create_engine, Column, String, Integer, Float, Text, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.config import DATABASE_URL_RESOLVED, USE_POSTGRES

# Configure SQLAlchemy Engine
# SQLite needs connect_args={"check_same_thread": False} for thread safety in FastAPI
connect_args = {"check_same_thread": False} if not USE_POSTGRES else {}

engine = create_engine(DATABASE_URL_RESOLVED, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class TaskRun(Base):
    __tablename__ = "task_runs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    task = Column(Text, nullable=False)
    status = Column(String(50), default="running")  # "running" | "complete" | "error"
    final_output = Column(Text, nullable=True)
    step_count = Column(Integer, default=0)
    token_cost_usd = Column(Float, nullable=True, default=0.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    trace_url = Column(String(500), nullable=True)
    user_id = Column(String(255), nullable=True)
    rating = Column(String(50), nullable=True)  # "up" | "down"

class GuestQuery(Base):
    __tablename__ = "guest_queries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_hash = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

def init_db():
    """Creates database tables if they do not exist."""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Dependency for retrieving database sessions in FastAPI routes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
