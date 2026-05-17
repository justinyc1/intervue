import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_rate_limiter_allows_first_request():
    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1  # first request in window

    with patch("auth.rate_limit.get_redis", return_value=mock_redis):
        from auth.rate_limit import RateLimiter
        limiter = RateLimiter(calls=5, window_seconds=60, scope="test")
        result = await limiter(clerk_user_id="user_abc")

    assert result == "user_abc"
    mock_redis.incr.assert_called_once_with("ratelimit:test:user_abc")
    mock_redis.expire.assert_called_once_with("ratelimit:test:user_abc", 60)


@pytest.mark.asyncio
async def test_rate_limiter_sets_expire_only_on_first_request():
    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 3  # third request, window already set

    with patch("auth.rate_limit.get_redis", return_value=mock_redis):
        from auth.rate_limit import RateLimiter
        limiter = RateLimiter(calls=5, window_seconds=60, scope="test")
        await limiter(clerk_user_id="user_abc")

    mock_redis.expire.assert_not_called()


@pytest.mark.asyncio
async def test_rate_limiter_blocks_when_over_limit():
    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 6  # over the 5-call limit

    with patch("auth.rate_limit.get_redis", return_value=mock_redis):
        from auth.rate_limit import RateLimiter
        limiter = RateLimiter(calls=5, window_seconds=60, scope="test")
        with pytest.raises(HTTPException) as exc_info:
            await limiter(clerk_user_id="user_abc")

    assert exc_info.value.status_code == 429


@pytest.mark.asyncio
async def test_rate_limiter_uses_scope_in_key():
    mock_redis = AsyncMock()
    mock_redis.incr.return_value = 1

    with patch("auth.rate_limit.get_redis", return_value=mock_redis):
        from auth.rate_limit import RateLimiter
        limiter = RateLimiter(calls=10, window_seconds=30, scope="create_session")
        await limiter(clerk_user_id="user_xyz")

    mock_redis.incr.assert_called_once_with("ratelimit:create_session:user_xyz")
