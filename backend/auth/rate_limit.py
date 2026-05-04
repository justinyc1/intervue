import logging

from fastapi import Depends, HTTPException, status

from auth.clerk import require_auth
from redis_client import get_redis

logger = logging.getLogger(__name__)


class RateLimiter:
    def __init__(self, calls: int, window_seconds: int, scope: str = "default"):
        self.calls = calls
        self.window_seconds = window_seconds
        self.scope = scope

    async def __call__(self, clerk_user_id: str = Depends(require_auth)) -> str:
        key = f"ratelimit:{self.scope}:{clerk_user_id}"
        count = None
        try:
            redis = get_redis()
            count = await redis.incr(key)
            if count == 1:
                await redis.expire(key, self.window_seconds)
        except Exception as exc:
            logger.warning("Rate limiter Redis unavailable, allowing request: %s", exc)
            return clerk_user_id
        if count > self.calls:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for {self.scope}. Try again in {self.window_seconds} seconds.",
            )
        return clerk_user_id
