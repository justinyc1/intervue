import pytest
from unittest.mock import AsyncMock, MagicMock
from fastapi.testclient import TestClient

import redis_client
from main import app
from auth.clerk import require_auth
from db import db as real_db


FAKE_USER_ID = "user_test123"
FAKE_SESSION_ID = "507f1f77bcf86cd799439011"


def override_require_auth():
    return FAKE_USER_ID


@pytest.fixture
def mock_redis():
    mock = AsyncMock()
    mock.get.return_value = None
    mock.setex.return_value = True
    mock.incr.return_value = 1
    mock.expire.return_value = True
    mock.hset.return_value = 1
    mock.hgetall.return_value = {}
    mock.hincrby.return_value = 1
    mock.delete.return_value = 1
    mock.expireat.return_value = True
    return mock


@pytest.fixture
def client(mock_redis):
    app.dependency_overrides[require_auth] = override_require_auth
    with TestClient(app) as c:
        redis_client._redis = mock_redis
        yield c
    app.dependency_overrides.clear()
    redis_client._redis = None


@pytest.fixture
def mock_db(monkeypatch):
    mock = MagicMock()
    monkeypatch.setattr("db.db", mock)
    try:
        monkeypatch.setattr("routes.code.db", mock)
    except (ImportError, AttributeError):
        pass
    return mock
