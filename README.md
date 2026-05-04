# Intervue 

## Table of Contents

1. [Overview](#overview)  
2. [Inspiration](#inspiration)  
3. [How It Works](#how-it-works)
4. [Tech Stack](#tech-stack)
5. [Getting Started](#getting-started)  
   - [Prerequisites](#prerequisites)
   - [Installation](#installation)  
6. [Diagrams](#diagrams)

## Overview

**Don’t just prep. Practice for real.** Intervue is a live, voice-first mock interview platform that simulates the nuance and pressure of real technical and behavioral interviews. By blending real-time web intelligence with adaptive AI, we help candidates stop rehearsing and start performing.


## Inspiration
Most interview prep tools are static: you read a question on a screen and type an answer. But real interviews are **dynamic, verbal, and unpredictable**. Candidates often struggle not with *what* they know, but with *how* they communicate it under pressure.


## How It Works

1.  **Specify Your Question:** Provide the role, company, question difficulty and other relevant parameters.
2.  **Sharpen Your Skills:** Engage in up to 60 minutes of voice-to-voice interview session where you can talk about your approaches, write and run code, many other elements that real interviews would have.
3.  **The Feedback Loop:** Our engine analyzes your performance after each session, so you know exactly what needs improving and where you excel.


## Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS, Clerk
* **Backend:** FastAPI, Python, WebSocket, Judge0 (code execution)
* **Voice/AI:** ElevenLabs, Tavily, Groq (Llama 3.1 8B), Featherless 
* **Database:** MongoDB 
* **Cache/State:** Redis (problem catalog cache, rate limiting, session orchestration state)
* **Storage:** AWS S3 (resumes, code snapshots, feedback reports)
* **Infrastructure:** Docker, NGINX


## Getting Started

### Prerequisites
* API Keys for:
    - Clerk (publishable + secret)
    - ElevenLabs
    - Groq (primary LLM) or Featherless (fallback)
    - Judge0 (via RapidAPI)
    - MongoDB Atlas URI
    - Tavily
    - AWS S3 (access key, secret key, bucket name) — optional, needed for resume upload and code snapshots
* Redis, or Docker Compose for the bundled Redis service

### Installation
1.  **Clone the repo:**
    ```bash
    git clone https://github.com/justinyc1/intervue.git
    cd intervue
    ```
2.  **Set up environment:**
    ```bash
    # Backend secrets (runtime)
    cp backend/.env.example backend/.env
    # open backend/.env and fill in your API keys
    # set REDIS_URL=redis://localhost:6379 for local dev

    # Frontend build vars (Docker only)
    # create .env at the repo root and set VITE_CLERK_PUBLISHABLE_KEY
    # Docker Compose uses REDIS_URL=redis://redis:6379 internally
    ```

### Option A — Docker (recommended)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up --build
```

- Frontend → http://localhost:5173
- Backend API → http://localhost:8000

### Option B — Local dev

Requires Python 3.12+ and Node 18+.

```bash
# Redis
docker run --rm -p 6379:6379 redis:7

# Backend
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Diagrams
### User Flow:
![User Flow](./frontend/public/user_flow.jpg)

### System Architecture:
![System Architecture](./frontend/public/system_architecture.jpg)

[View Detailed Architecture Walkthrough](./ARCHITECTURE.md)
