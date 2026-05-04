from models.interview_session import (
    BehavioralPersona,
    InterviewMode,
    InterviewSession,
)


def test_behavioral_session_has_no_role():
    session = InterviewSession(
        clerk_user_id="user_123",
        mode=InterviewMode.behavioral,
        behavioral_persona=BehavioralPersona.corporate,
        duration_minutes=30,
    )
    assert session.role is None
    assert session.difficulty is None
    assert session.interviewer_tone is None
    assert session.behavioral_persona == BehavioralPersona.corporate


def test_technical_session_fields_unchanged():
    from models.interview_session import Difficulty, InterviewerTone
    session = InterviewSession(
        clerk_user_id="user_123",
        mode=InterviewMode.technical,
        role="Software Engineer",
        difficulty=Difficulty.medium,
        interviewer_tone=InterviewerTone.neutral,
        duration_minutes=45,
    )
    assert session.role == "Software Engineer"
    assert session.behavioral_persona is None


from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from main import app
from auth.clerk import require_auth

FAKE_USER_ID = "user_test123"


def override_auth():
    return FAKE_USER_ID


def test_create_behavioral_session_endpoint(monkeypatch):
    fake_session_doc = {
        "_id": "507f1f77bcf86cd799439011",
        "clerk_user_id": FAKE_USER_ID,
        "mode": "behavioral",
        "role": None,
        "company": None,
        "difficulty": None,
        "duration_minutes": 20,
        "interviewer_tone": None,
        "behavioral_persona": "corporate",
        "status": "pending",
        "question_ids": [],
        "elevenlabs_agent_id": None,
        "elevenlabs_conversation_id": None,
        "created_at": "2026-04-20T00:00:00Z",
        "started_at": None,
        "ended_at": None,
    }

    mock_db = MagicMock()
    mock_db.sessions.insert_one.return_value.inserted_id = "507f1f77bcf86cd799439011"
    mock_db.questions.insert_many.return_value.inserted_ids = []
    mock_db.sessions.find_one.return_value = fake_session_doc

    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1
    mock_redis.expire.return_value = True

    with (
        patch("routes.behavioral.db", mock_db),
        patch("auth.rate_limit.get_redis", return_value=mock_redis),
        patch("routes.behavioral.plan_behavioral_questions", new=AsyncMock(return_value=[])),
        patch("routes.behavioral.create_behavioral_agent", new=AsyncMock(return_value=("agent_abc", "Hello! Thank you for joining today.", {"voice_id": "EXAVITQu4vr4xnSDxMaL", "stability": 0.65, "similarity_boost": 0.80}))),
    ):
        app.dependency_overrides[require_auth] = override_auth
        client = TestClient(app)
        resp = client.post(
            "/api/interviews/behavioral",
            json={"duration_minutes": 20, "behavioral_persona": "corporate"},
        )
        app.dependency_overrides.clear()

    assert resp.status_code == 201
    data = resp.json()
    assert data["mode"] == "behavioral"
    assert data["role"] is None
    assert data["behavioral_persona"] == "corporate"
