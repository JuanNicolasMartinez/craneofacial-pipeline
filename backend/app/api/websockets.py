import asyncio
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
from app.core.config import settings

router = APIRouter()

PUBSUB_CHANNEL_PREFIX = "job_progress:"
_DONE_SENTINEL = "__done__"
# Close WS after this many seconds of silence (covers crashed workers)
_IDLE_TIMEOUT = 30.0


@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(websocket: WebSocket, job_id: str):
    await websocket.accept()

    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = f"{PUBSUB_CHANNEL_PREFIX}{job_id}"
    await pubsub.subscribe(channel)

    try:
        while True:
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=_IDLE_TIMEOUT,
                )
            except asyncio.TimeoutError:
                # No messages for _IDLE_TIMEOUT seconds — worker likely dead
                break

            if message is None:
                await asyncio.sleep(0.05)
                continue

            data = message["data"]
            if data == _DONE_SENTINEL:
                break

            await websocket.send_text(data)

            # Auto-close when step 9 is done or a terminal error is reported
            try:
                parsed = json.loads(data)
                if parsed.get("step") == 9 and parsed.get("status") in ("done", "error"):
                    break
                if parsed.get("status") == "error":
                    break
            except (json.JSONDecodeError, TypeError):
                pass

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
