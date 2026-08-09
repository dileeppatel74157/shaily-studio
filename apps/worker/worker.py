import asyncio
import logging
import os
import sys
import json
import redis
import psycopg

# Ensure packages can be imported dynamically in dev environment
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../../packages")))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("shaily.worker")

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_TLS = os.getenv("REDIS_TLS", "false").lower() == "true"
DATABASE_URL = os.getenv("DATABASE_URL")

# Connect to Redis
redis_kwargs = {
    "host": REDIS_HOST,
    "port": REDIS_PORT,
    "decode_responses": True
}
if REDIS_PASSWORD:
    redis_kwargs["password"] = REDIS_PASSWORD
if REDIS_TLS:
    redis_kwargs["ssl"] = True

r = redis.Redis(**redis_kwargs)

def update_task_in_db(task_id: str, status: str, error: str = None):
    if not DATABASE_URL:
        logger.warning("DATABASE_URL not set, skipping DB update for task %s", task_id)
        return
    try:
        conn_str = DATABASE_URL
        if conn_str.startswith("postgresql+psycopg://"):
            conn_str = conn_str.replace("postgresql+psycopg://", "postgresql://")
        
        with psycopg.connect(conn_str) as conn:
            with conn.cursor() as cur:
                if error:
                    cur.execute(
                        "UPDATE tasks SET status = %s, error = %s, updated_at = NOW() WHERE id = %s",
                        (status, error, task_id)
                    )
                else:
                    cur.execute(
                        "UPDATE tasks SET status = %s, updated_at = NOW() WHERE id = %s",
                        (status, task_id)
                    )
                conn.commit()
        logger.info("Updated task %s to status %s in database", task_id, status)
    except Exception as e:
        logger.error("Failed to update database for task %s: %s", task_id, str(e))

async def execute_heavy_job(task_id: str, agent_id: str, prompt: str, task_type: str):
    logger.info("Starting execution of %s (Task ID: %s, Agent: %s)", task_type, task_id, agent_id)
    update_task_in_db(task_id, "running")
    
    try:
        # Simulate pipeline execution: rendering, video, voice, image generation, heavy AI
        await asyncio.sleep(3.0)
        
        # Real task routing
        if task_type == "video_generation":
            logger.info("Generating video for prompt: %s", prompt)
        elif task_type == "image_generation":
            logger.info("Generating image for prompt: %s", prompt)
        elif task_type == "voice_generation":
            logger.info("Generating voice for prompt: %s", prompt)
        elif task_type == "rendering":
            logger.info("Rendering video frames...")
        else:
            logger.info("Executing general AI agent job: %s", prompt)
            
        update_task_in_db(task_id, "completed")
    except Exception as e:
        logger.error("Error executing task %s: %s", task_id, str(e))
        update_task_in_db(task_id, "failed", error=str(e))

async def main():
    logger.info("Shaily Studio Worker starting up...")
    logger.info("Listening to queue 'shaily:tasks'...")
    while True:
        try:
            # BLPOP blocks until a task is available
            res = r.blpop("shaily:tasks", timeout=5)
            if res:
                _, item_str = res
                task_data = json.loads(item_str)
                task_id = task_data.get("id")
                agent_id = task_data.get("agent_id")
                prompt = task_data.get("prompt", "")
                task_type = task_data.get("task_type", "heavy_ai")
                
                await execute_heavy_job(task_id, agent_id, prompt, task_type)
        except Exception as e:
            logger.error("Worker loop error: %s", str(e))
            await asyncio.sleep(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Shaily Studio Worker shutting down...")
