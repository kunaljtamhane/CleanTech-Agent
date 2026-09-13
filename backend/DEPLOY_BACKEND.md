# Deploying the Backend API (Hugging Face Spaces, Docker SDK)

Same free-hosting approach as before (`chroma_db` bundled via git-lfs on the
free `cpu-basic` tier), but the app now runs as a FastAPI service instead of
a Streamlit app, since the frontend has moved to Next.js.

## 1. Create the Space

1. https://huggingface.co/new-space
2. Name it, e.g. `cleantech-rag-api`
3. **SDK:** Docker
4. **Hardware:** CPU basic (free)
5. Create it

## 2. Clone, add files, push

```bash
git clone https://huggingface.co/spaces/<your-username>/cleantech-rag-api
cd cleantech-rag-api
git lfs install
```

Copy in: `Dockerfile`, `api.py`, `backend.py`, `requirements.txt`, `README.md`,
`.gitattributes`, `rebuild_vectorstore.py`, `test_chroma_load.py`, and your
verified `chroma_db/` folder.

```bash
git lfs track "chroma_db/**/*.bin" "chroma_db/*.sqlite3"
git add .gitattributes
git add .
git commit -m "Deploy CleanTech RAG API"
git push
```

## 3. Set secrets

Space → **Settings → Repository secrets**:
- `OPENAI_API_KEY` — your OpenAI key
- `BACKEND_API_KEY` — make up a random string (e.g. `openssl rand -hex 32`).
  Set this **same value** as `BACKEND_API_KEY` in the Vercel frontend's env
  vars. This is what stops random visitors who find your Space URL from
  running up your OpenAI bill directly — only requests carrying this key are
  answered. Leave both unset while you're still testing locally via `/docs`.
- `ALLOWED_ORIGINS` — your Vercel frontend URL once you have it, e.g.
  `https://cleantech-desk.vercel.app` (only matters for direct browser
  requests, e.g. testing via `/docs`; the deployed frontend calls this API
  server-to-server, which isn't subject to CORS)

## 4. Test it

Your API will be live at:
`https://<your-username>-cleantech-rag-api.hf.space`

Check `/api/health` first (should return `{"status":"ok"}`), then try `/docs`
for an interactive Swagger UI to test `/api/chat` directly before wiring up
the frontend.

## Troubleshooting

Same chromadb version-mismatch symptom and fix as before — see the comments
in `api.py`/`backend.py` and use `rebuild_vectorstore.py` if `/api/health`
works but `/api/chat` errors with an empty-collection message.

**CORS errors in the browser console once the frontend is live:** double
check `ALLOWED_ORIGINS` exactly matches your Vercel URL (including `https://`,
no trailing slash), and that you redeployed/restarted the Space after setting it.
