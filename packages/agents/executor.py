import logging
from typing import Any, Dict
from .base import AgentContext, AgentResponse
from .registry import AgentRegistry

logger = logging.getLogger("shaily.agents")

class AgentExecutor:
    def __init__(self, registry: AgentRegistry) -> None:
        self.registry = registry

    async def run_task(
        self, agent_id: str, prompt: str, task_id: str, variables: Dict[str, Any]
    ) -> AgentResponse:
        logger.info("Preparing to run task %s with agent %s", task_id, agent_id)
        try:
            agent = self.registry.get_agent(agent_id)
            context = AgentContext(task_id=task_id, variables=variables)
            response = await agent.execute(prompt, context)
            logger.info(
                "Agent %s completed task %s with success=%s",
                agent_id,
                task_id,
                response.success,
            )
            return response
        except Exception as e:
            logger.error(
                "Error running task %s with agent %s: %s", task_id, agent_id, e, exc_info=True
            )
            return AgentResponse(success=False, errors=[str(e)])
