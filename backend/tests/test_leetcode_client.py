import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

FAKE_LIST_RESP = {
    "count": 2,
    "problemsetQuestionList": [
        {"frontendQuestionId": "1", "title": "Two Sum", "titleSlug": "two-sum",
         "difficulty": "Easy", "isPaidOnly": False,
         "topicTags": [{"name": "Array", "slug": "array"}]},
        {"frontendQuestionId": "146", "title": "LRU Cache", "titleSlug": "lru-cache",
         "difficulty": "Medium", "isPaidOnly": False,
         "topicTags": [{"name": "Design", "slug": "design"}]},
    ],
}

FAKE_DETAIL_RESP = {
    "questionId": "1",
    "title": "Two Sum",
    "titleSlug": "two-sum",
    "difficulty": "Easy",
    "content": "<p>Given an array of integers <code>nums</code>.</p><p>Return indices.</p>",
    "topicTags": [{"name": "Array", "slug": "array"}],
    "codeSnippets": [
        {"lang": "Python3", "langSlug": "python3", "code": "class Solution:\n    pass"},
    ],
    "hints": ["Use a hash map."],
}

FAKE_ITEMS = FAKE_LIST_RESP["problemsetQuestionList"]


def _make_http_mock(json_response):
    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = json_response
    mock_http = AsyncMock()
    mock_http.get.return_value = mock_resp
    mock_cls = MagicMock()
    mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
    mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
    return mock_cls, mock_http


@pytest.mark.asyncio
async def test_fetch_problem_list_cache_miss_fetches_api():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None  # cache miss

    mock_cls, mock_http = _make_http_mock(FAKE_LIST_RESP)

    with patch("services.leetcode_client.get_redis", return_value=mock_redis), \
         patch("httpx.AsyncClient", mock_cls):
        from services.leetcode_client import fetch_problem_list
        items = await fetch_problem_list(limit=100)

    assert len(items) == 2
    assert items[0]["titleSlug"] == "two-sum"
    mock_redis.setex.assert_called_once()
    args = mock_redis.setex.call_args[0]
    assert args[0] == "problems:catalog"
    assert args[1] == 3600


@pytest.mark.asyncio
async def test_fetch_problem_list_cache_hit_skips_api():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = json.dumps(FAKE_ITEMS)

    mock_cls, mock_http = _make_http_mock(FAKE_LIST_RESP)

    with patch("services.leetcode_client.get_redis", return_value=mock_redis), \
         patch("httpx.AsyncClient", mock_cls):
        from services.leetcode_client import fetch_problem_list
        items = await fetch_problem_list()

    assert len(items) == 2
    mock_http.get.assert_not_called()


@pytest.mark.asyncio
async def test_fetch_problem_list_redis_down_falls_through_to_api():
    mock_redis = AsyncMock()
    mock_redis.get.side_effect = Exception("Redis connection refused")

    mock_cls, mock_http = _make_http_mock(FAKE_LIST_RESP)

    with patch("services.leetcode_client.get_redis", return_value=mock_redis), \
         patch("httpx.AsyncClient", mock_cls):
        from services.leetcode_client import fetch_problem_list
        items = await fetch_problem_list()

    assert len(items) == 2
    mock_http.get.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_problem_list_returns_empty_on_api_error():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    mock_http = AsyncMock()
    mock_http.get.side_effect = Exception("network error")
    mock_cls = MagicMock()
    mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
    mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

    with patch("services.leetcode_client.get_redis", return_value=mock_redis), \
         patch("httpx.AsyncClient", mock_cls):
        from services.leetcode_client import fetch_problem_list
        items = await fetch_problem_list()

    assert items == []


@pytest.mark.asyncio
async def test_fetch_problem_detail_cache_miss_fetches_api():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    mock_cls, _ = _make_http_mock(FAKE_DETAIL_RESP)

    with patch("services.leetcode_client.get_redis", return_value=mock_redis), \
         patch("httpx.AsyncClient", mock_cls):
        from services.leetcode_client import fetch_problem_detail
        detail = await fetch_problem_detail("two-sum")

    assert detail is not None
    assert "<p>" not in detail["description"]
    assert "Given an array of integers" in detail["description"]
    assert detail["topic_tags"] == ["Array"]
    mock_redis.setex.assert_called_once()
    args = mock_redis.setex.call_args[0]
    assert args[0] == "problems:detail:two-sum"
    assert args[1] == 21600


@pytest.mark.asyncio
async def test_fetch_problem_detail_cache_hit_skips_api():
    from services.leetcode_client import fetch_problem_detail
    cached = {
        "title": "Two Sum", "titleSlug": "two-sum", "difficulty": "Easy",
        "description": "Given an array", "topic_tags": ["Array"], "hints": [],
        "example_testcases": "", "question_html": "",
    }
    mock_redis = AsyncMock()
    mock_redis.get.return_value = json.dumps(cached)

    mock_cls, mock_http = _make_http_mock(FAKE_DETAIL_RESP)

    with patch("services.leetcode_client.get_redis", return_value=mock_redis), \
         patch("httpx.AsyncClient", mock_cls):
        detail = await fetch_problem_detail("two-sum")

    assert detail["title"] == "Two Sum"
    mock_http.get.assert_not_called()


@pytest.mark.asyncio
async def test_fetch_problem_detail_returns_none_on_error():
    mock_redis = AsyncMock()
    mock_redis.get.return_value = None

    mock_http = AsyncMock()
    mock_http.get.side_effect = Exception("network error")
    mock_cls = MagicMock()
    mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
    mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)

    with patch("services.leetcode_client.get_redis", return_value=mock_redis), \
         patch("httpx.AsyncClient", mock_cls):
        from services.leetcode_client import fetch_problem_detail
        detail = await fetch_problem_detail("nonexistent")

    assert detail is None


def test_strip_html_preserves_text_and_newlines():
    from services.html_utils import strip_html
    result = strip_html("<p>Hello <strong>world</strong>.</p><p>Line two.</p>")
    assert "Hello world." in result
    assert "Line two." in result
    assert "<" not in result
