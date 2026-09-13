"""
FastAPI wrapper around backend.py.

This does not change the RAG/agent logic at all — build_pipeline() and
answer_question() are exactly what was verified locally. This file just
exposes them over HTTP so a separate frontend (Next.js on Vercel) can call
them, instead of Streamlit driving the whole page.
"""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend import build_pipeline, answer_question

# Comma-separated list of allowed frontend origins. Only really matters if you
# hit this API directly from a browser (e.g. via /docs) — the Next.js app
# calls it server-to-server, which isn't subject to CORS.
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

# Optional shared secret so random internet traffic can't run up your OpenAI
# bill by hitting this Space directly. If unset, the check is skipped (handy
# for local dev). Set the same value here and as API_KEY in the Next.js app.
BACKEND_API_KEY = os.environ.get("BACKEND_API_KEY")

_agent = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _agent
    _agent = build_pipeline()  # loads the vector store once at startup
    yield


app = FastAPI(title="CleanTech RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)


class Citation(BaseModel):
    source_type: str
    title: str
    url: str
    date: str
    domain: str


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation]
    bibliography: str
    blocked: bool


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/chat", response_model=ChatResponse)
def chat(req: ChatRequest, x_api_key: str | None = Header(default=None)):
    if BACKEND_API_KEY and x_api_key != BACKEND_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key.")
    if _agent is None:
        raise HTTPException(status_code=503, detail="Agent is still starting up, try again shortly.")
    result = answer_question(_agent, req.message)
    return result
