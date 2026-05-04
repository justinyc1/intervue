import logging
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status

from auth.clerk import require_auth
from db import db
from models.interview_session import InterviewSession, SessionStatus
from routes._helpers import session_to_response
from models.question import Question, QuestionType
from schemas.interviews import (
    AgentUrlResponse,
    CreateSessionRequest,
    PatchSessionRequest,
    ProblemResponse,
    QuestionResponse,
    SessionListResponse,
    SessionResponse,
)
from services.code_runner import load_problem
from services.elevenlabs import create_interview_agent, get_signed_url, sync_transcript
from services.tts_cache import prewarm as tts_prewarm
from services.feedback import generate_feedback
from services.question_planner import plan_questions
from redis_client import get_redis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/interviews", tags=["interviews"])


def _get_owned_session(session_id: str, clerk_user_id: str) -> dict:
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid session id")
    doc = db.sessions.find_one({"_id": ObjectId(session_id), "clerk_user_id": clerk_user_id})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return doc

# routes

from auth.rate_limit import RateLimiter

@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: CreateSessionRequest,
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(RateLimiter(5, 60, "create_session")),
):
    # Validate before insert to avoid orphan sessions on 400 errors
    from services.question_planner import plan_resume_questions
    if body.mode == "resume" and not body.resume_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resume text is required for resume mode")
    raw_problem = None
    if body.problem_id:
        raw_problem = load_problem(body.problem_id)
        if not raw_problem or not raw_problem.get("test_cases"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Problem '{body.problem_id}' has no test cases. Call POST /api/problems/{{slug}}/generate-tests first.",
            )

    session = InterviewSession(
        clerk_user_id=clerk_user_id,
        mode=body.mode,
        role=body.role,
        company=body.company,
        difficulty=body.difficulty,
        duration_minutes=body.duration_minutes,
        interviewer_tone=body.interviewer_tone,
        behavioral_persona=body.behavioral_persona,
        resume_text=body.resume_text,
        resume_s3_url=body.resume_s3_url,
    )

    result = db.sessions.insert_one(session.to_mongo())
    session_id = str(result.inserted_id)
    session.id = session_id

    if body.mode == "resume":
        questions = await plan_resume_questions(session_id, body.resume_text, body.duration_minutes)
    elif raw_problem:
        questions = [Question(
            session_id=session_id,
            order=0,
            type=QuestionType.technical,
            prompt=raw_problem.get("prompt", raw_problem.get("description", "")),
            follow_up_tree=[],
            coding_problem_id=raw_problem["id"],
        )]
    else:
        questions = plan_questions(session_id, body.mode, body.difficulty, body.duration_minutes)
        
    question_ids: list[str] = []
    if questions:
        q_docs = [q.to_mongo() for q in questions]
        q_result = db.questions.insert_many(q_docs)
        question_ids = [str(qid) for qid in q_result.inserted_ids]

    # Create the ElevenLabs conversational agent for this session
    agent_id: str | None = None
    try:
        agent_id, first_msg, voice_cfg = await create_interview_agent(session, questions)
        background_tasks.add_task(
            tts_prewarm,
            first_msg,
            voice_cfg["voice_id"],
            voice_cfg["stability"],
            voice_cfg["similarity_boost"],
        )
    except Exception as exc:
        logger.error("ElevenLabs agent creation failed for session %s: %s", session_id, exc)

    db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"question_ids": question_ids, "elevenlabs_agent_id": agent_id}},
    )

    doc = db.sessions.find_one({"_id": ObjectId(session_id)})
    return session_to_response(doc)


@router.get("", response_model=SessionListResponse)
def list_sessions(clerk_user_id: str = Depends(require_auth)):
    docs = list(db.sessions.find({"clerk_user_id": clerk_user_id}).sort("created_at", -1))
    sessions = [session_to_response(d) for d in docs]
    return SessionListResponse(sessions=sessions, total=len(sessions))


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: str,
    clerk_user_id: str = Depends(require_auth),
):
    doc = _get_owned_session(session_id, clerk_user_id)
    return session_to_response(doc)


@router.get("/{session_id}/questions", response_model=list[QuestionResponse])
def get_session_questions(
    session_id: str,
    clerk_user_id: str = Depends(require_auth),
):
    doc = _get_owned_session(session_id, clerk_user_id)
    question_ids = doc.get("question_ids", [])
    valid_oids = []
    for qid in question_ids:
        try:
            valid_oids.append(ObjectId(qid))
        except Exception:
            pass
    questions = list(db.questions.find({"_id": {"$in": valid_oids}}))
    questions.sort(key=lambda q: q.get("order", 0))

    result = []
    for q in questions:
        problem = None
        coding_problem_id = q.get("coding_problem_id")
        if coding_problem_id:
            raw = load_problem(coding_problem_id)
            if raw:
                problem = {
                    "id": raw["id"],
                    "title": raw["title"],
                    "difficulty": raw["difficulty"],
                    "description": raw["description"],
                    "examples": raw.get("examples", []),
                    "constraints": raw.get("constraints", []),
                    "starter_code": raw.get("starter_code", {}),
                }
        result.append(QuestionResponse(
            id=str(q["_id"]),
            type=q.get("type", "behavioral"),
            prompt=q.get("prompt", ""),
            order=q.get("order", 0),
            coding_problem_id=coding_problem_id,
            problem=problem,
        ))
    return result


@router.get("/{session_id}/agent-url", response_model=AgentUrlResponse)
async def get_agent_url(
    session_id: str,
    clerk_user_id: str = Depends(require_auth),
):
    """Return a short-lived signed WebSocket URL the frontend uses to connect
    directly to the ElevenLabs conversational agent."""
    doc = _get_owned_session(session_id, clerk_user_id)
    agent_id = doc.get("elevenlabs_agent_id")
    if not agent_id:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ElevenLabs agent not yet provisioned for this session",
        )
    signed_url = await get_signed_url(agent_id)
    return AgentUrlResponse(agent_id=agent_id, signed_url=signed_url)


@router.patch("/{session_id}", response_model=SessionResponse)
async def patch_session(
    session_id: str,
    body: PatchSessionRequest,
    background_tasks: BackgroundTasks,
    clerk_user_id: str = Depends(require_auth),
):
    doc = _get_owned_session(session_id, clerk_user_id)
    pre_update_status = doc.get("status")

    updates: dict = {}

    if body.status is not None:
        updates["status"] = body.status.value
        if body.status == SessionStatus.active and not doc.get("started_at"):
            updates["started_at"] = datetime.now(timezone.utc)
        if body.status in (SessionStatus.completed, SessionStatus.abandoned) and not doc.get("ended_at"):
            updates["ended_at"] = datetime.now(timezone.utc)

    if body.started_at is not None:
        updates["started_at"] = body.started_at

    if body.ended_at is not None:
        updates["ended_at"] = body.ended_at

    if body.elevenlabs_conversation_id is not None:
        updates["elevenlabs_conversation_id"] = body.elevenlabs_conversation_id

    if updates:
        db.sessions.update_one({"_id": ObjectId(session_id)}, {"$set": updates})

    doc = db.sessions.find_one({"_id": ObjectId(session_id)})

    _terminal = (SessionStatus.completed.value, SessionStatus.abandoned.value)
    session_completed = (
        body.status in (SessionStatus.completed, SessionStatus.abandoned)
        and pre_update_status not in _terminal
    )

    # Sync ElevenLabs transcript when session ends (only if conversation was linked)
    conversation_id = doc.get("elevenlabs_conversation_id")
    if session_completed and conversation_id:
        started_at = doc.get("started_at")
        background_tasks.add_task(
            _sync_transcript_background, session_id, conversation_id, started_at
        )

    # Generate feedback whenever a session ends (with or without ElevenLabs)
    if session_completed:
        background_tasks.add_task(generate_feedback, session_id)

    if session_completed:
        try:
            await get_redis().delete(f"session:{session_id}:state")
        except Exception as exc:
            logger.warning("Failed to delete session state from Redis: %s", exc)

    return session_to_response(doc)


async def _sync_transcript_background(
    session_id: str, conversation_id: str, started_at: datetime | None
):
    try:
        count = await sync_transcript(session_id, conversation_id, started_at)
        logger.info("Synced %d transcript segments for session %s", count, session_id)
    except Exception:
        logger.exception("Transcript sync failed for session %s", session_id)
