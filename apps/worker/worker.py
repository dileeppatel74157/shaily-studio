import asyncio
import logging
import os
import sys
from arq.connections import RedisSettings

# Ensure packages can be imported dynamically in dev environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../packages")))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shaily.worker")


async def startup(ctx: dict) -> None:
    logger.info("Shaily Studio Worker starting up...")
    ctx["session"] = "worker_active"


async def shutdown(ctx: dict) -> None:
    logger.info("Shaily Studio Worker shutting down...")


async def execute_agent_job(ctx: dict, agent_id: str, prompt: str, task_id: str) -> dict:
    """Worker task to simulate running an AI agent process.

    Prepares the modular agent environment and executes the job.
    """
    logger.info("Worker received job: Task %s with Agent %s", task_id, agent_id)
    await asyncio.sleep(2.0)  # Simulate agent processing time
    logger.info("Worker completed job: Task %s", task_id)
    return {
        "success": True,
        "task_id": task_id,
        "agent_id": agent_id,
        "result": f"Simulated output from agent {agent_id} for prompt: {prompt}",
    }


class WorkerSettings:
    functions = [execute_agent_job]
    redis_settings = RedisSettings(
        host=os.getenv("REDIS_HOST", "localhost"), port=int(os.getenv("REDIS_PORT", 6379))
    )
    on_startup = startup
    on_shutdown = shutdown
