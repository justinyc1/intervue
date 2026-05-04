import redis.asyncio as aioredis
from redis.asyncio import Redis

_redis: Redis | None = None


def init_redis(url: str) -> None:
    global _redis
    _redis = aioredis.from_url(url, decode_responses=True)


def get_redis() -> Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized. Call init_redis() first.")
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None
