from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

with patch("auth.clerk._upsert_user"), \
     patch("auth.clerk._jwks_client"), \
     patch("services.problems_seed.seed_problems"):
    from main import app

client = TestClient(app)
AUTH = {"Authorization": "Bearer test-token"}
USER_ID = "user_test123"

MOCK_PROBLEM = {
    "_id": "some-oid",
    "id": "two-sum",
    "title": "Two Sum",
    "difficulty": "easy",
    "description": "Given an array...",
    "prompt": "Find two indices that sum to target.",
    "test_cases": [{"id": "tc1", "stdin": "[2,7]\n9", "expected_stdout": "[0,1]", "is_hidden": False}],
    "examples": [],
    "constraints": [],
    "starter_code": {"python": "pass"},
}

_SESSION_DOC = {
    "_id": "507f1f77bcf86cd799439011",
    "clerk_user_id": USER_ID,
    "mode": "technical",
    "role": "SWE",
    "company": "Google",
    "difficulty": "easy",
    "duration_minutes": 30,
    "interviewer_tone": "neutral",
    "behavioral_persona": None,
    "resume_text": None,
    "resume_s3_url": None,
    "audio_s3_url": None,
    "status": "pending",
    "question_ids": [],
    "elevenlabs_agent_id": None,
    "elevenlabs_conversation_id": None,
    "created_at": "2026-04-26T00:00:00Z",
    "started_at": None,
    "ended_at": None,
}


def _fake_verify(token):
    return {"sub": USER_ID}


def _make_mock_redis():
    """Return a mock Redis that allows rate limit checks."""
    mock = AsyncMock()
    mock.incr.return_value = 1
    mock.expire.return_value = True
    return mock


def test_create_session_with_problem_id_uses_specific_problem():
    mock_q_planner = MagicMock(return_value=[])
    mock_load = MagicMock(return_value=MOCK_PROBLEM)

    with patch("auth.clerk.verify_token", side_effect=_fake_verify), \
         patch("auth.clerk._upsert_user"), \
         patch("routes.interviews.db") as mock_db, \
         patch("auth.rate_limit.get_redis", return_value=_make_mock_redis()), \
         patch("routes.interviews.plan_questions", mock_q_planner), \
         patch("routes.interviews.load_problem", mock_load), \
         patch("routes.interviews.create_interview_agent", new=AsyncMock(return_value=(None, "", {}))), \
         patch("services.tts_cache.prewarm", new=AsyncMock()):
        mock_db.sessions.insert_one.return_value = MagicMock(inserted_id="507f1f77bcf86cd799439011")
        mock_db.questions.insert_many.return_value = MagicMock(inserted_ids=[])
        mock_db.sessions.update_one.return_value = MagicMock()
        mock_db.sessions.find_one.return_value = _SESSION_DOC
        resp = client.post("/api/interviews", headers=AUTH, json={
            "mode": "technical",
            "role": "SWE",
            "company": "Google",
            "difficulty": "easy",
            "duration_minutes": 30,
            "problem_id": "two-sum",
        })
    assert resp.status_code == 201
    mock_q_planner.assert_not_called()
    mock_load.assert_called_once_with("two-sum")


def test_create_session_without_problem_id_calls_planner():
    mock_q_planner = MagicMock(return_value=[])

    with patch("auth.clerk.verify_token", side_effect=_fake_verify), \
         patch("auth.clerk._upsert_user"), \
         patch("routes.interviews.db") as mock_db, \
         patch("auth.rate_limit.get_redis", return_value=_make_mock_redis()), \
         patch("routes.interviews.plan_questions", mock_q_planner), \
         patch("routes.interviews.create_interview_agent", new=AsyncMock(return_value=(None, "", {}))), \
         patch("services.tts_cache.prewarm", new=AsyncMock()):
        mock_db.sessions.insert_one.return_value = MagicMock(inserted_id="507f1f77bcf86cd799439011")
        mock_db.questions.insert_many.return_value = MagicMock(inserted_ids=[])
        mock_db.sessions.update_one.return_value = MagicMock()
        mock_db.sessions.find_one.return_value = _SESSION_DOC
        resp = client.post("/api/interviews", headers=AUTH, json={
            "mode": "technical",
            "role": "SWE",
            "company": "Google",
            "difficulty": "easy",
            "duration_minutes": 30,
        })
    assert resp.status_code == 201
    mock_q_planner.assert_called_once()
