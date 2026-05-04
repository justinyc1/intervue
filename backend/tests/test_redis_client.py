import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import redis_client


def test_get_redis_raises_before_init():
    redis_client._redis = None
    with pytest.raises(RuntimeError, match="Redis not initialized"):
        redis_client.get_redis()


def test_get_redis_returns_client_after_init():
    mock_client = MagicMock()
    redis_client._redis = mock_client
    assert redis_client.get_redis() is mock_client
    redis_client._redis = None


@pytest.mark.asyncio
async def test_close_redis_calls_aclose():
    mock_client = AsyncMock()
    redis_client._redis = mock_client
    await redis_client.close_redis()
    mock_client.aclose.assert_called_once()
    assert redis_client._redis is None


@pytest.mark.asyncio
async def test_close_redis_noop_when_not_initialized():
    redis_client._redis = None
    await redis_client.close_redis()  # should not raise
