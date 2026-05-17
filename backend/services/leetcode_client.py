import json
import logging

import httpx

from redis_client import get_redis
from services.html_utils import strip_html

logger = logging.getLogger(__name__)

_BASE = "https://alfa-leetcode-api.onrender.com"
_LIST_CACHE_TTL = 3600
_DETAIL_CACHE_TTL = 21600


async def fetch_problem_list(limit: int = 200) -> list[dict]:
    cache_key = f"problems:catalog:{limit}"
    try:
        cached = await get_redis().get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as exc:
        logger.warning("Redis unavailable for problem list cache: %s", exc)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(f"{_BASE}/problems", params={"limit": limit})
            resp.raise_for_status()
            data = resp.json()
        result = data.get("problemsetQuestionList", [])
        try:
            await get_redis().setex(cache_key, _LIST_CACHE_TTL, json.dumps(result))
        except Exception as exc:
            logger.warning("Failed to write problem list to Redis: %s", exc)
        return result
    except Exception as exc:
        logger.error("Failed to fetch LeetCode problem list: %s", exc)
        return []


async def fetch_problem_detail(slug: str) -> dict | None:
    key = f"problems:detail:{slug}"
    try:
        cached = await get_redis().get(key)
        if cached:
            return json.loads(cached)
    except Exception as exc:
        logger.warning("Redis unavailable for problem detail cache: %s", exc)

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(f"{_BASE}/select", params={"titleSlug": slug})
            resp.raise_for_status()
            data = resp.json()

        raw_html = data.get("question", data.get("content", ""))
        result = {
            "title": data.get("questionTitle", data.get("title", "")),
            "titleSlug": data.get("titleSlug", slug),
            "difficulty": data.get("difficulty", ""),
            "description": strip_html(raw_html),
            "topic_tags": [t["name"] for t in data.get("topicTags", [])],
            "hints": data.get("hints", []),
            "example_testcases": data.get("exampleTestcases", ""),
            "question_html": raw_html,
        }
        try:
            await get_redis().setex(key, _DETAIL_CACHE_TTL, json.dumps(result))
        except Exception as exc:
            logger.warning("Failed to write problem detail to Redis: %s", exc)
        return result
    except Exception as exc:
        logger.error("Failed to fetch LeetCode detail for %s: %s", slug, exc)
        return None
