"""WebSocket gateway for live interview session state."""

import json
import logging
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from auth.clerk import verify_token
from db import db
from redis_client import get_redis
from services.s3 import S3MultipartAudioStreamer

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])

_connections: dict[str, list[WebSocket]] = {}


async def broadcast(session_id: str, event: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    for ws in _connections.get(session_id, []):
        try:
            await ws.send_json(event)
        except Exception:
            dead.append(ws)
    for ws in dead:
        _remove(session_id, ws)


def _remove(session_id: str, ws: WebSocket) -> None:
    bucket = _connections.get(session_id, [])
    if ws in bucket:
        bucket.remove(ws)
    if not bucket:
        _connections.pop(session_id, None)


@router.websocket("/ws/interviews/{session_id}")
async def interview_ws(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(..., description="Clerk session JWT"),
):
    try:
        claims = verify_token(token)
        clerk_user_id: str = claims["sub"]
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    if not ObjectId.is_valid(session_id):
        await websocket.close(code=4004, reason="Invalid session id")
        return

    doc = db.sessions.find_one({"_id": ObjectId(session_id), "clerk_user_id": clerk_user_id})
    if not doc:
        await websocket.close(code=4004, reason="Session not found")
        return

    await websocket.accept()
    _connections.setdefault(session_id, []).append(websocket)
    logger.info("WS connected: session=%s user=%s", session_id, clerk_user_id)

    question_index = 0
    try:
        state = await get_redis().hgetall(f"session:{session_id}:state")
        if state:
            question_index = int(state.get("question_index", 0))
    except Exception as exc:
        logger.warning("Could not read session state from Redis: %s", exc)

    await websocket.send_json({
        "type": "session.state",
        "session_id": session_id,
        "status": doc.get("status"),
        "question_ids": doc.get("question_ids", []),
        "question_index": question_index,
        "elevenlabs_agent_id": doc.get("elevenlabs_agent_id"),
        "elevenlabs_conversation_id": doc.get("elevenlabs_conversation_id"),
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "detail": "Invalid JSON"})
                continue
            await _handle(session_id, clerk_user_id, msg, websocket, doc)
    except WebSocketDisconnect:
        _remove(session_id, websocket)
        logger.info("WS disconnected: session=%s user=%s", session_id, clerk_user_id)


async def _handle(
    session_id: str,
    clerk_user_id: str,
    msg: dict,
    ws: WebSocket,
    doc: dict,
) -> None:
    msg_type = msg.get("type")

    if msg_type == "ping":
        await ws.send_json({"type": "pong"})

    elif msg_type == "conversation.started":
        conversation_id = msg.get("conversation_id")
        if conversation_id:
            db.sessions.update_one(
                {"_id": ObjectId(session_id)},
                {"$set": {"elevenlabs_conversation_id": conversation_id}},
            )
            duration_minutes = doc.get("duration_minutes", 30)
            ttl = duration_minutes * 60 + 3600
            try:
                redis = get_redis()
                existing = await redis.hgetall(f"session:{session_id}:state")
                if not existing:
                    await redis.hset(
                        f"session:{session_id}:state",
                        mapping={"question_index": 0, "silence_count": 0, "timer_started_at": 0},
                    )
                    await redis.expire(f"session:{session_id}:state", ttl)
            except Exception as exc:
                logger.warning("Failed to initialize session state in Redis: %s", exc)
            await broadcast(session_id, {
                "type": "conversation.linked",
                "session_id": session_id,
                "conversation_id": conversation_id,
            })

    elif msg_type == "question.advance":
        try:
            new_index = await get_redis().hincrby(
                f"session:{session_id}:state", "question_index", 1
            )
        except Exception as exc:
            logger.warning("Failed to increment question_index in Redis: %s", exc)
            new_index = msg.get("question_index", 0)
        await broadcast(session_id, {
            "type": "question.advanced",
            "session_id": session_id,
            "question_index": new_index,
        })

    elif msg_type == "transcript.synced":
        await broadcast(session_id, {
            "type": "transcript.synced",
            "session_id": session_id,
            "segment_count": msg.get("segment_count"),
        })

    else:
        await ws.send_json({"type": "error", "detail": f"Unknown message type: {msg_type}"})


@router.websocket("/ws/interviews/{session_id}/audio")
async def audio_stream_ws(
    websocket: WebSocket,
    session_id: str,
    token: str = Query(..., description="Clerk session JWT"),
):
    try:
        claims = verify_token(token)
        clerk_user_id: str = claims["sub"]
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    if not ObjectId.is_valid(session_id):
        await websocket.close(code=4004, reason="Invalid session id")
        return

    doc = db.sessions.find_one({"_id": ObjectId(session_id), "clerk_user_id": clerk_user_id})
    if not doc:
        await websocket.close(code=4004, reason="Session not found")
        return

    streamer = None
    try:
        streamer = S3MultipartAudioStreamer(session_id)
        await websocket.accept()
        logger.info("Audio WS connected: session=%s user=%s", session_id, clerk_user_id)
        while True:
            chunk = await websocket.receive_bytes()
            if chunk:
                streamer.add_chunk(chunk)
    except WebSocketDisconnect:
        logger.info("Audio WS disconnected: session=%s user=%s", session_id, clerk_user_id)
    except Exception as e:
        logger.error("Audio WS error for session %s: %s", session_id, e)
    finally:
        if streamer:
            audio_url = streamer.close()
            if audio_url:
                db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$set": {"audio_s3_url": audio_url}},
                )
                logger.info("Saved audio_s3_url for session %s: %s", session_id, audio_url)
