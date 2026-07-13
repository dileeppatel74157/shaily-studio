from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

class AgentContext(BaseModel):
    task_id: str
    user_id: str = "founder"
    variables: Dict[str, Any] = Field(default_factory=dict)
    memory: List[Dict[str, Any]] = Field(default_factory=list)

class AgentResponse(BaseModel):
    success: bool
    data: Dict[str, Any] = Field(default_factory=dict)
    errors: List[str] = Field(default_factory=list)
    output_text: Optional[str] = None

class BaseAgent(ABC):
    def __init__(self, agent_id: str, name: str, description: str):
        self.agent_id = agent_id
        self.name = name
        self.description = description

    @abstractmethod
    async def execute(self, prompt: str, context: AgentContext) -> AgentResponse:
        """Execute the agent task. Subclasses must implement this."""
        pass
