import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
from app.core.config import settings

router = APIRouter()

PUBSUB_CHANNEL_PREFIX = "job_progress:"


@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(websocket: WebSocket, job_id: str):
    await websocket.accept()

    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = f"{PUBSUB_CHANNEL_PREFIX}{job_id}"
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"])
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await redis_client.aclose()


async def publish_job_progress(redis_url: str, job_id: str, payload: dict) -> None:
    """Called from workers to push progress to the WebSocket channel."""
    client = aioredis.from_url(redis_url, decode_responses=True)
    try:
        await client.publish(
            f"{PUBSUB_CHANNEL_PREFIX}{job_id}", json.dumps(payload)
        )
    finally:
        await client.aclose()
