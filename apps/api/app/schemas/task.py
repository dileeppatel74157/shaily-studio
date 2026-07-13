from typing import Any, Dict, Optional
from pydantic import BaseModel, Field

class TaskCreate(BaseModel):
    agent_id: str = Field(..., description="ID of the agent to execute")
    prompt: str = Field(..., description="Prompt instructions for the agent")
    variables: Dict[str, Any] = Field(default_factory=dict, description="Additional context parameters")

class TaskRead(BaseModel):
    task_id: str
    agent_id: str
    status: str
    input_data: Dict[str, Any]
    error: Optional[str] = None
