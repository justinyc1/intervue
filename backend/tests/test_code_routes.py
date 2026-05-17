import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from fastapi.testclient import TestClient

from main import app
from auth.clerk import require_auth
from models.code_submission import SubmissionStatus

FAKE_USER_ID = "user_test123"
FAKE_SESSION_ID = "507f1f77bcf86cd799439011"
FAKE_QUESTION_ID = "507f1f77bcf86cd799439012"


def override_require_auth():
    return FAKE_USER_ID


def _fake_session():
    return {
        "_id": ObjectId(FAKE_SESSION_ID),
        "clerk_user_id": FAKE_USER_ID,
        "question_ids": [FAKE_QUESTION_ID],
    }


def _fake_question():
    return {
        "_id": ObjectId(FAKE_QUESTION_ID),
        "session_id": FAKE_SESSION_ID,
        "coding_problem_id": "two-sum",
        "type": "technical",
    }


def _fake_run_results():
    return [
        {"test_case_id": "tc1", "passed": True, "stdout": "[0,1]", "stderr": "", "runtime_ms": 10.0, "status": SubmissionStatus.accepted},
        {"test_case_id": "tc2", "passed": True, "stdout": "[1,2]", "stderr": "", "runtime_ms": 12.0, "status": SubmissionStatus.accepted},
    ]


def test_run_returns_200_with_results(client):
    with patch("routes.code.db") as mock_db, \
         patch("routes.code.run_test_cases", new=AsyncMock(return_value=_fake_run_results())):

        mock_db.sessions.find_one.return_value = _fake_session()
        mock_db.questions.find_one.return_value = _fake_question()

        resp = client.post(
            f"/api/interviews/{FAKE_SESSION_ID}/code/run",
            json={"question_id": FAKE_QUESTION_ID, "language": "python", "code": "..."},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["passed_count"] == 2
    assert data["total_count"] == 2
    assert data["status"] == "accepted"
    assert data["submission_id"] is None


def test_submit_returns_200_and_persists(client):
    fake_inserted_id = ObjectId()

    with patch("routes.code.db") as mock_db, \
         patch("routes.code.run_test_cases", new=AsyncMock(return_value=_fake_run_results())):

        mock_db.sessions.find_one.return_value = _fake_session()
        mock_db.questions.find_one.return_value = _fake_question()
        mock_db.code_submissions.insert_one.return_value = MagicMock(inserted_id=fake_inserted_id)

        resp = client.post(
            f"/api/interviews/{FAKE_SESSION_ID}/code/submit",
            json={"question_id": FAKE_QUESTION_ID, "language": "python", "code": "..."},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["passed_count"] == 2
    assert data["submission_id"] == str(fake_inserted_id)
    mock_db.code_submissions.insert_one.assert_called_once()


def test_run_requires_auth():
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        resp = c.post(
            f"/api/interviews/{FAKE_SESSION_ID}/code/run",
            json={"question_id": FAKE_QUESTION_ID, "language": "python", "code": "..."},
        )
    assert resp.status_code == 401


def test_run_invalid_session_id(client):
    resp = client.post(
        "/api/interviews/not-a-valid-id/code/run",
        json={"question_id": FAKE_QUESTION_ID, "language": "python", "code": "..."},
    )
    assert resp.status_code == 400


def test_run_session_not_owned(client):
    with patch("routes.code.db") as mock_db:
        mock_db.sessions.find_one.return_value = None
        resp = client.post(
            f"/api/interviews/{FAKE_SESSION_ID}/code/run",
            json={"question_id": FAKE_QUESTION_ID, "language": "python", "code": "..."},
        )
    assert resp.status_code == 404


def test_run_unsupported_language(client):
    with patch("routes.code.db") as mock_db:
        mock_db.sessions.find_one.return_value = _fake_session()
        mock_db.questions.find_one.return_value = _fake_question()
        resp = client.post(
            f"/api/interviews/{FAKE_SESSION_ID}/code/run",
            json={"question_id": FAKE_QUESTION_ID, "language": "ruby", "code": "..."},
        )
    assert resp.status_code == 422


def test_run_question_no_problem_id(client):
    question_no_problem = {**_fake_question(), "coding_problem_id": None}
    with patch("routes.code.db") as mock_db:
        mock_db.sessions.find_one.return_value = _fake_session()
        mock_db.questions.find_one.return_value = question_no_problem
        resp = client.post(
            f"/api/interviews/{FAKE_SESSION_ID}/code/run",
            json={"question_id": FAKE_QUESTION_ID, "language": "python", "code": "..."},
        )
    assert resp.status_code == 404
