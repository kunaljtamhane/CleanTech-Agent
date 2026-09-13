---
title: CleanTech RAG API
emoji: 🌱
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# CleanTech RAG API

FastAPI backend for the CleanTech RAG Assistant. Exposes:

- `GET /api/health` — health check
- `POST /api/chat` — `{"message": "..."}` → `{"answer", "citations", "bibliography", "blocked"}`
- `GET /docs` — interactive API docs (Swagger UI)

The Next.js frontend calls this API. See `DEPLOY_BACKEND.md` for setup.
