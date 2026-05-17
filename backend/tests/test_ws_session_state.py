import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone


@pytest.mark.asyncio
async def test_conversation_started_initializes_redis_state():
    mock_redis = AsyncMock()
    mock_redis.hgetall.return_value = {}

    session_id = "507f1f77bcf86cd799439011"
    doc = {
        "_id": MagicMock(),
        "status": "active",
        "question_ids": [],
        "elevenlabs_agent_id": "agent_123",
        "elevenlabs_conversation_id": None,
        "duration_minutes": 30,
    }

    with patch("routes.ws.get_redis", return_value=mock_redis), \
         patch("routes.ws.db") as mock_db:
        mock_db.sessions.update_one = MagicMock()
        from routes.ws import _handle
        ws = AsyncMock()
        await _handle(
            session_id,
            "user_test",
            {"type": "conversation.started", "conversation_id": "conv_abc"},
            ws,
            doc,
        )

    mock_redis.hset.assert_called_once()
    call_kwargs = mock_redis.hset.call_args
    assert call_kwargs[0][0] == f"session:{session_id}:state"


@pytest.mark.asyncio
async def test_question_advance_increments_redis_index():
    mock_redis = AsyncMock()
    mock_redis.hincrby.return_value = 2

    session_id = "507f1f77bcf86cd799439011"
    doc = {"status": "active", "question_ids": [], "elevenlabs_agent_id": None,
           "elevenlabs_conversation_id": None, "duration_minutes": 30}

    with patch("routes.ws.get_redis", return_value=mock_redis), \
         patch("routes.ws.db"):
        from routes.ws import _handle, _connections
        _connections[session_id] = []
        ws = AsyncMock()
        await _handle(
            session_id,
            "user_test",
            {"type": "question.advance", "question_index": 1},
            ws,
            doc,
        )

    mock_redis.hincrby.assert_called_once_with(
        f"session:{session_id}:state", "question_index", 1
    )


def test_patch_session_deletes_redis_state_on_completion(client, mock_redis, monkeypatch):
    from bson import ObjectId
    from datetime import datetime, timezone
    from unittest.mock import MagicMock, AsyncMock, patch

    session_doc = {
        "_id": ObjectId("507f1f77bcf86cd799439011"),
        "clerk_user_id": "user_test123",
        "status": "active",
        "question_ids": [],
        "elevenlabs_agent_id": None,
        "elevenlabs_conversation_id": None,
        "mode": "behavioral",
        "role": "SWE",
        "company": "",
        "difficulty": "medium",
        "duration_minutes": 30,
        "interviewer_tone": "neutral",
        "behavioral_persona": None,
        "resume_text": None,
        "resume_s3_url": None,
        "audio_s3_url": None,
        "code_snapshots": [],
        "created_at": datetime.now(timezone.utc),
        "started_at": None,
        "ended_at": None,
        "company_snapshot_id": None,
    }

    with patch("routes.interviews.db") as mock_db, \
         patch("routes.interviews.generate_feedback", new=AsyncMock()):
        mock_db.sessions.find_one.return_value = session_doc
        mock_db.sessions.update_one.return_value = MagicMock()

        response = client.patch(
            "/api/interviews/507f1f77bcf86cd799439011",
            json={"status": "completed"},
        )

    assert response.status_code == 200
    mock_redis.delete.assert_called_once_with("session:507f1f77bcf86cd799439011:state")
