# Architecture: AI Mock Interview Platform

## Purpose

This document defines the technical architecture for a live mock interview platform that supports:

- LeetCode-style coding interviews  
- Behavioral voice interviews  
- Company-specific interview adaptation  
- Real-time AI interviewer (voice)  
- Post-interview feedback + scoring  

---

# 1. High-Level System Overview

The system is composed of **4 main layers**:

## 1. Frontend
- React + TypeScript + Tailwind CSS v3 (Vite)  
- Interview UI (coding + voice)  
- WebSocket client for real-time interaction  
- Auth via Clerk  
- Served by nginx in production (Docker); Vite dev server locally  

## 2. Backend & Business Logic (FastAPI)
- Central API gateway  
- Session orchestration  
- Service-based architecture  
- Handles all core logic  

## 3. External AI + Data Services
- ElevenLabs → voice + transcription  
- Groq / Featherless AI → LLM (feedback, question generation, test case generation)  
- alfa-leetcode-api → LeetCode problem catalog  

## 4. Database
- MongoDB Atlas → persistent storage  

## 5. Infrastructure
- Docker + Docker Compose — containerizes backend (Python/uvicorn), frontend (nginx), and Redis  
- nginx — serves the Vite static build; handles SPA routing (`try_files`)  
- Redis — shared cache and ephemeral state layer; runs as `redis:alpine` in the compose stack  
- `VITE_API_URL` build arg controls which backend the frontend bundle targets  

---

# 2. System Architecture (Based on Diagram)

## Core Backend Entry Point

### FastAPI

Acts as the **central orchestrator**:

### Responsibilities:
- Handles all HTTP requests  
- Creates interview sessions  
- Initializes WebSocket sessions  
- Routes requests to internal services  
- Enforces auth (via Clerk)  

---

# 3. Backend Service Layer

The backend is structured into **independent services**:

---

## 3.1 Session Service (CORE)

This is the **central coordinator of the system**.

### Responsibilities
- Create interview session  
- Manage session lifecycle  
- Track current question  
- Coordinate between services  
- Store session data in MongoDB  

### Interactions
- Calls Retrieval Service → to fetch questions  
- Calls Voice Service → to start interviewer  
- Calls Feedback Service → after session ends  

---

## 3.2 Problems Service

Handles **coding problem catalog and test case generation**

### Responsibilities
- Serve paginated problem list (local seed + alfa-leetcode-api)  
- Fetch and parse LeetCode problem detail (description, examples, constraints)  
- Generate stdin/stdout test cases and starter code via LLM  
- Cache enriched problems in MongoDB  
- Track per-user solved problems  

### External dependencies
- alfa-leetcode-api (problem data)  
- Groq / Featherless AI (test case + starter code generation)  

### Output
- Structured problems with test cases and multi-language starter code  

---

## 3.3 Voice Service

Handles **real-time conversation**

### Responsibilities
- Create ElevenLabs agent  
- Stream interviewer speech (TTS)  
- Receive user speech (STT)  
- Manage conversation + transcription  
- Send transcript events to backend  

### External dependency
- ElevenLabs  

### Key outputs
- Transcript segments  
- Speaking events  
- Conversation IDs  

---

## 3.4 Feedback Service

Handles **post-interview evaluation**

### Responsibilities
- Analyze transcript  
- Evaluate communication quality  
- Evaluate technical explanation  
- Generate structured feedback  
- Produce scorecard  
- Generate shareable HTML report (uploaded to S3)  

### External dependency
- Groq (primary — `llama-3.1-8b-instant`) / Featherless AI (fallback — `Meta-Llama-3.1-8B-Instruct`)  

### Output
- Overall score + category scores  
- Per-question strengths, improvements, better-answer examples  
- Top strengths / weaknesses, targeted drills  

---

## 3.5 Analytics Service

Handles **user-level insights**

### Responsibilities
- Aggregate past interview performance  
- Track improvement trends  
- Compute metrics over time  

### Data source
- MongoDB  

---

# 4. External Services Integration

---

## 4.1 alfa-leetcode-api (Problem Catalog)

### Used by:
- Problems Service  

### Purpose
- Fetch paginated LeetCode problem list  
- Fetch per-problem detail (description, examples, constraints, example test cases)  
- Source for LLM-enriched test case generation  

---

## 4.2 ElevenLabs (Voice Layer)

### Used by:
- Voice Service  

### Purpose
- Interviewer speech (TTS)  
- User speech transcription (STT)  
- Real-time conversation handling  

---

## 4.3 LLM Layer (Groq / Featherless AI)

### Used by:
- Feedback Service  
- Problems Service (test case + starter code generation)  
- Question Planner (behavioral + resume question generation)  

### Purpose
- Transcript analysis and scoring  
- Structured feedback generation  
- Stdin/stdout test case generation for LeetCode problems  
- STAR behavioral question generation  

### Models
- Groq: `llama-3.1-8b-instant` (primary — lower latency)  
- Featherless AI: `Meta-Llama-3.1-8B-Instruct` (fallback)  

---

# 5. Storage Layer

## MongoDB

### Collections:
- `sessions` — interview session documents  
- `questions` — per-session question list  
- `users` — user records  
- `transcript_segments` — synced ElevenLabs transcript  
- `code_submissions` — run/submit results  
- `feedback` — generated feedback reports  
- `problems` — LeetCode problems enriched with test cases + starter code  
- `solved_problems` — per-user solved problem tracking  

### Why MongoDB
- Flexible schema  
- Fits nested interview data  
- Good for transcripts + JSON feedback  

## Redis

### Stores:
- `problems:catalog` — JSON-serialized problem list from alfa-leetcode-api (TTL 1 h)
- `problems:detail:{slug}` — JSON-serialized per-problem detail (TTL 6 h)
- `ratelimit:{scope}:{user_id}` — sliding-window request counter per user per route (TTL = window seconds)
- `session:{id}:state` — hash of per-session orchestration state (`question_index`, `silence_count`, `timer_started_at`); TTL = session duration + 1 h

All Redis calls are wrapped in `try/except`; on failure the backend logs a warning and falls through to the primary data source, so the app continues to work without Redis.

### Connection
Initialized once at app startup via `backend/redis_client.py` (`init_redis` / `get_redis` / `close_redis`). The compose stack injects `REDIS_URL=redis://redis:6379`; local dev without compose defaults to `redis://localhost:6379`.

## AWS S3

### Stores:
- `resumes/{user_id}/{uuid}.pdf` — uploaded resume PDFs  
- `sessions/{id}/code_snapshots/snapshot_NNNN.json` — periodic code snapshots during interviews  
- `reports/{session_id}/feedback.html` — shareable HTML feedback reports (7-day presigned URLs)  

---

# 6. Data Flow (End-to-End)

---

## 6.1 Session Creation

1. Frontend → FastAPI  
2. FastAPI → Session Service  
3. Session Service → Question Planner (behavioral/resume: LLM; technical: MongoDB problems pool or specific problem)  
4. ElevenLabs agent created with session context  
5. Session + questions stored in MongoDB  

---

## 6.2 Start Interview

1. Frontend connects (WebSocket / session init)  
2. FastAPI → Session Service  
3. Session Service → Voice Service  
4. Voice Service → ElevenLabs agent created  
5. Agent starts conversation  

---

## 6.3 Live Interview (Real-Time)

**Flow:**

- User speaks → ElevenLabs  
- ElevenLabs → transcript  
- Voice Service → Session Service  

### Session Service decides:
- Follow-up  
- Interruption  
- Next question  

---

## 6.4 Coding Flow (Technical Mode)

1. User writes code (frontend)  
2. Frontend → FastAPI (`/run` or `/submit`)  
3. FastAPI → Judge0 CE (via RapidAPI)  
4. Results returned  
5. Stored in MongoDB  

---

## 6.5 End Interview

1. Session ends  
2. Session Service → Feedback Service  
3. Feedback Service → Featherless AI  
4. Feedback generated  
5. Stored in MongoDB  

---

## 6.6 Feedback Display

1. Frontend requests results  
2. FastAPI → MongoDB  
3. Feedback returned  

### UI renders:
- Score  
- Transcript  
- Suggestions  

---

# 7. Core Architectural Principles

---

## 7.1 Service-Based Design

Each service has a **single responsibility**:

- Session control  
- Retrieval  
- Voice  
- Feedback  

---

## 7.2 Backend Owns Logic

Frontend is **UI only**

All decisions happen in backend:
- Interview flow  
- Follow-ups  
- Scoring  

---

## 7.3 External APIs are Isolated

Each provider is wrapped:

- `tavily.py`  
- `elevenlabs.py`  
- `featherless.py`  

👉 Makes swapping providers easy  

---

## 7.4 Real-Time + REST Separation

- REST → setup, data fetch  
- WebSocket / streaming → live interview  

---

# 8. Deployment

## Containers

| Service  | Image base       | Exposed port | Notes                              |
|----------|------------------|--------------|------------------------------------|
| backend  | python:3.12-slim | 8000         | uvicorn, reads `backend/.env`      |
| frontend | nginx:alpine     | 80           | Vite static build; SPA routing     |
| redis    | redis:alpine     | 6379         | ephemeral cache + session state    |

## Docker Compose (local)

```bash
docker compose up --build
```

Frontend → `http://localhost`, Backend API → `http://localhost:8000`

## Environment

Backend secrets are injected at **runtime** via `backend/.env` (never baked into the image).  
`VITE_API_URL` is a **build-time** arg; the compiled JS bundle embeds the value so it must be set before `docker compose build`.

```
VITE_API_URL=http://localhost:8000   # default (local docker compose)
VITE_API_URL=https://intervue.org    # production override
```
