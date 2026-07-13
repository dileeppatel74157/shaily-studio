import os
import sys
import uuid
from fastapi import Depends, FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

# Ensure packages can be imported dynamically in dev environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../packages")))

from app.core.config import settings
from app.db.session import get_db
from app.schemas.task import TaskCreate, TaskRead

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_STR}/openapi.json",
)

# CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/")
def read_root():
    return {"status": "online", "service": settings.PROJECT_NAME, "version": "1.0.0"}


@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    # Verify DB connectivity
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"disconnected: {e}"

    return {
        "status": "healthy",
        "database": db_status,
        "environment": os.getenv("PYTHON_ENV", "development"),
    }


@app.post("/api/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(task_in: TaskCreate):
    # This is a modular skeleton to trigger worker tasks
    # No actual queue triggers yet, just returning a mocked payload to prove the api model and schema resolves
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    return TaskRead(
        task_id=task_id,
        agent_id=task_in.agent_id,
        status="pending",
        input_data={"prompt": task_in.prompt},
    )
