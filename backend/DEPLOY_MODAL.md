# Deploying the Backend on Modal (no credit card required)

Modal gives $5/month in free compute credit with no payment method needed —
this covers a personal-scale app comfortably. Add a card later only if you
want the larger $30/month tier (e.g. if you're testing heavily).

## 1. Install and authenticate

From inside `backend/` (with your venv active):

```bash
pip install modal
modal setup
```

`modal setup` opens a browser to create/link your Modal account — no card
required at this step.

## 2. Create the secret (your API keys)

Go to https://modal.com/secrets → **Create new secret** → choose the generic
"Environment variables" template → name it exactly `cleantech-secrets` → add:

- `OPENAI_API_KEY` = your OpenAI key
- `BACKEND_API_KEY` = a random string (reuse the one you generated earlier
  with `openssl rand -hex 32`, or generate a new one — just make sure the
  frontend's `BACKEND_API_KEY` matches this exactly)

## 3. Upload chroma_db to a persistent Volume

This is a one-time upload (not repeated on every deploy):

```bash
modal volume create cleantech-chroma-db
modal volume put cleantech-chroma-db ./chroma_db /
```

This will take a while (~2.3GB). Once done, verify the structure landed
correctly:

```bash
modal volume ls cleantech-chroma-db
```

You should see `chroma.sqlite3` and a UUID-named folder **directly** at the
top level. If instead you see a nested `chroma_db/` folder inside (i.e.
`chroma_db/chroma.sqlite3` rather than just `chroma.sqlite3`), the upload
nested one level deeper than expected — tell me what `modal volume ls` shows
and I'll adjust `CHROMA_MOUNT` in `modal_app.py` to match.

## 4. Deploy

```bash
modal deploy modal_app.py
```

This builds the container image and deploys it. On success it prints a URL
like:

```
https://<your-workspace>--cleantech-rag-api-fastapi-app.modal.run
```

That's your backend's public URL — this is what `API_URL` in the frontend's
`.env.local` (and later, Vercel) needs to point to.

## 5. Test it

```bash
curl https://<your-workspace>--cleantech-rag-api-fastapi-app.modal.run/api/health
```

Should return `{"status":"ok"}`. Then test `/api/chat` the same way you did
locally, but with `-H "X-API-Key: <your BACKEND_API_KEY>"` added, since this
endpoint now requires it:

```bash
curl -X POST https://<your-workspace>--cleantech-rag-api-fastapi-app.modal.run/api/chat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <your BACKEND_API_KEY>" \
  -d '{"message": "What is agrovoltaics?"}'
```

## Notes on cost and cold starts

- `scaledown_window=300` in `modal_app.py` keeps a container warm for 5
  minutes after the last request, so a burst of questions doesn't each pay
  the vector-store-load cost. The container scales to zero (no cost) after
  that.
- The very first request after a cold start will be slower (loading the
  vector store). This is normal and matches how Cloud Run or any
  scale-to-zero host would behave too.
- Check your usage anytime at https://modal.com/usage. If you're
  consistently near the $5 free credit, adding a payment method raises it to
  $30/month at the same usage-based rates — no separate action needed beyond
  that.

## Updating later

Since `chroma_db` lives in a Volume (not the container image), redeploying
after code changes is fast:

```bash
modal deploy modal_app.py
```

You only need to touch the Volume again if the underlying data changes
(e.g. you rebuild the vector store with `rebuild_vectorstore.py`).
