from typing import Dict
from .base import BaseAgent

class AgentRegistry:
    def __init__(self) -> None:
        self._registry: Dict[str, BaseAgent] = {}

    def register(self, agent: BaseAgent) -> None:
        if agent.agent_id in self._registry:
            raise ValueError(f"Agent with ID {agent.agent_id} already registered.")
        self._registry[agent.agent_id] = agent

    def get_agent(self, agent_id: str) -> BaseAgent:
        if agent_id not in self._registry:
            raise KeyError(f"Agent with ID {agent_id} not found in registry.")
        return self._registry[agent_id]

    def list_agents(self) -> Dict[str, str]:
        return {agent_id: agent.name for agent_id, agent in self._registry.items()}
