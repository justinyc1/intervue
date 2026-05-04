import logging

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from auth.clerk import require_auth
from schemas.problems import (
    ProblemDetail, ProblemExample, ProblemListItem, ProblemListResponse,
    SolvedSlugsResponse, MarkSolvedResponse,
)

from db import db
from services.leetcode_client import fetch_problem_detail, fetch_problem_list
from services.leetcode_html_parser import parse_question_html
from services.test_case_generator import generate_full_problem

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/problems", tags=["problems"])


def _normalize_difficulty(raw: str) -> str:
    return raw.lower()


def _db_to_list_item(p: dict) -> ProblemListItem:
    return ProblemListItem(
        slug=p["id"],
        title=p["title"],
        difficulty=_normalize_difficulty(p["difficulty"]),
        source=p.get("source", "local"),
        has_test_cases=bool(p.get("test_cases")),
        topic_tags=p.get("topic_tags", []),
    )


def _lc_to_list_item(p: dict) -> ProblemListItem:
    return ProblemListItem(
        slug=p["titleSlug"],
        title=p["title"],
        difficulty=_normalize_difficulty(p["difficulty"]),
        source="leetcode",
        has_test_cases=False,
        topic_tags=[t["name"] for t in p.get("topicTags", [])],
    )


def _local_to_detail(p: dict) -> ProblemDetail:
    examples = [
        ProblemExample(
            input=ex.get("input", ""),
            output=ex.get("output", ""),
            explanation=ex.get("explanation"),
        )
        for ex in p.get("examples", [])
    ]
    return ProblemDetail(
        slug=p["id"],
        title=p["title"],
        difficulty=_normalize_difficulty(p["difficulty"]),
        source=p.get("source", "local"),
        has_test_cases=bool(p.get("test_cases")),
        description=p.get("description", ""),
        examples=examples,
        constraints=p.get("constraints", []),
        topic_tags=p.get("topic_tags", []),
        starter_code=p.get("starter_code"),
        hints=[],
    )


def _lc_to_detail(d: dict) -> ProblemDetail:
    return ProblemDetail(
        slug=d["titleSlug"],
        title=d["title"],
        difficulty=_normalize_difficulty(d["difficulty"]),
        source="leetcode",
        has_test_cases=False,
        description=d.get("description", ""),
        examples=[],
        constraints=[],
        topic_tags=d.get("topic_tags", []),
        starter_code=None,
        hints=d.get("hints", []),
    )


_CATALOG_THRESHOLD = 20 


@router.get("", response_model=ProblemListResponse)
async def list_problems(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    difficulty: str = "all",
    clerk_user_id: str = Depends(require_auth),
):
    """Return paginated problem list served from MongoDB.

    Falls back to alfa-leetcode-api only when the catalog hasn't been seeded yet
    (fewer than _CATALOG_THRESHOLD problems total in the DB).
    """
    total_seeded = db.problems.count_documents({})
    diff_filter = difficulty.lower() if difficulty != "all" else None
    query = {}
    if diff_filter:
        query["difficulty"] = diff_filter

    db_all = list(db.problems.find(query, {"_id": 0}))

    if total_seeded >= _CATALOG_THRESHOLD:
        combined = [_db_to_list_item(p) for p in db_all]
        total = len(combined)
        return ProblemListResponse(problems=combined[skip: skip + limit], total=total)

    # Cold-start fallback: catalog not seeded yet, merge DB + API
    local_ids = {p["id"] for p in db_all}
    lc_raw = await fetch_problem_list(limit=200)
    lc_filtered = [
        p for p in lc_raw
        if not p.get("isPaidOnly")
        and p["titleSlug"] not in local_ids
        and (diff_filter is None or p["difficulty"].lower() == diff_filter)
    ]

    combined = (
        [_db_to_list_item(p) for p in db_all]
        + [_lc_to_list_item(p) for p in lc_filtered]
    )
    total = len(combined)
    return ProblemListResponse(problems=combined[skip: skip + limit], total=total)


@router.get("/solved", response_model=SolvedSlugsResponse)
def get_solved_problems(clerk_user_id: str = Depends(require_auth)):
    """Return list of problem slugs the current user has marked solved."""
    docs = db.solved_problems.find(
        {"clerk_user_id": clerk_user_id},
        {"_id": 0, "problem_slug": 1},
    )
    return SolvedSlugsResponse(solved_slugs=[d["problem_slug"] for d in docs])


@router.post("/{slug}/solve", response_model=MarkSolvedResponse)
def mark_problem_solved(slug: str, clerk_user_id: str = Depends(require_auth)):
    """Mark a problem as solved for the current user (idempotent)."""
    result = db.solved_problems.update_one(
        {"clerk_user_id": clerk_user_id, "problem_slug": slug},
        {"$setOnInsert": {
            "clerk_user_id": clerk_user_id,
            "problem_slug": slug,
            "solved_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    already_solved = result.matched_count > 0
    return MarkSolvedResponse(slug=slug, already_solved=already_solved)


@router.post("/{slug}/generate-tests", response_model=ProblemDetail)
async def generate_problem_tests(slug: str, clerk_user_id: str = Depends(require_auth)):
    """Generate test cases + starter code for a problem using the enriched LLM pipeline.

    Returns existing data immediately if test_cases already present.
    """
    existing = db.problems.find_one({"id": slug}, {"_id": 0})
    if existing and existing.get("test_cases"):
        return _local_to_detail(existing)

    detail = await fetch_problem_detail(slug)
    if not detail:
        raise HTTPException(status_code=404, detail="Problem not found")

    parsed = parse_question_html(detail.get("question_html", ""))
    description = parsed["description"] or detail.get("description", "")

    problem_input = {
        "title": detail["title"],
        "description": description,
        "examples": parsed["examples"],
        "constraints": parsed["constraints"],
    }

    generated = await generate_full_problem(problem_input)
    if not generated:
        raise HTTPException(status_code=502, detail="Failed to generate test cases")

    doc = {
        "id": slug,
        "title": detail["title"],
        "difficulty": detail["difficulty"].lower(),
        "description": description,
        "examples": parsed["examples"],
        "constraints": parsed["constraints"],
        "topic_tags": detail.get("topic_tags", []),
        "test_cases": generated["test_cases"],
        "starter_code": generated["starter_code"],
    }

    db.problems.update_one({"id": slug}, {"$set": doc}, upsert=True)

    updated = db.problems.find_one({"id": slug}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to retrieve updated problem")
    return _local_to_detail(updated)


@router.get("/{slug}", response_model=ProblemDetail)
async def get_problem(slug: str, clerk_user_id: str = Depends(require_auth)):
    """Return full problem detail: DB first, then alfa-leetcode-api."""
    local = db.problems.find_one({"id": slug}, {"_id": 0})
    if local:
        return _local_to_detail(local)

    detail = await fetch_problem_detail(slug)
    if not detail:
        raise HTTPException(status_code=404, detail="Problem not found")
    return _lc_to_detail(detail)
