# Deploying the Frontend (Vercel, free) — with Auth + Database

Three free services to set up before deploying: Google OAuth, Neon (database),
and Vercel (hosting). About 15 minutes total.

## 1. Google OAuth credentials

1. https://console.cloud.google.com/apis/credentials → create a project if you
   don't have one
2. **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Authorized redirect URIs, add both:
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
   - `https://<your-vercel-domain>/api/auth/callback/google` (add this after
     step 4 once you know your Vercel URL — you can come back and edit it)
5. Copy the **Client ID** and **Client secret**

If this is a brand-new Google Cloud project, it'll also ask you to configure
the OAuth consent screen first — "External" user type, fill in an app name,
your email — takes under a minute.

## 2. Neon database (free tier)

1. https://neon.tech → sign up → create a project
2. Copy the connection string it gives you (starts with `postgresql://`) —
   this is your `DATABASE_URL`
3. From the `frontend/` folder locally:
   ```bash
   npm install
   echo "DATABASE_URL=<paste-your-connection-string>" >> .env.local
   npx drizzle-kit migrate
   ```
   This creates all the tables (`user`, `account`, `session`,
   `verificationToken`, `chat`, `message`) — you should see confirmation output
   and can double check in Neon's table view.

## 3. Fill in .env.local for local testing

```bash
cp .env.local.example .env.local
```
Fill in `DATABASE_URL` (from step 2), `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
(from step 1), `API_URL` (your backend — `http://localhost:7860` while
developing, or the deployed HF Space URL), and generate a secret:
```bash
npx auth secret
```
This writes `AUTH_SECRET` into `.env.local` automatically.

Then run it:
```bash
npm run dev
```
Visit `http://localhost:3000`, sign in with Google, and confirm you land on
`/chat` and can start a conversation.

## 4. Deploy to Vercel

1. Push this `frontend/` folder to a GitHub repo
2. https://vercel.com/new → import the repo
3. Add every variable from `.env.local` as a Vercel environment variable
   (Project Settings → Environment Variables) — `DATABASE_URL`, `AUTH_SECRET`,
   `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `API_URL`, and `BACKEND_API_KEY` if
   you set one on the backend
4. Deploy
5. Once you have your Vercel URL, go back to Google Cloud Console and add
   `https://<your-vercel-domain>/api/auth/callback/google` to the authorized
   redirect URIs (step 1)
6. On the backend's Hugging Face Space, set `ALLOWED_ORIGINS` to your Vercel
   URL and restart the Space

## Notes

- `npx drizzle-kit migrate` only needs to run once against a given database
  (and again any time you change `db/schema.ts` — generate a new migration
  with `npx drizzle-kit generate` first, then `migrate`).
- The `BACKEND_API_KEY` (optional) must be set to the *same* value on both
  the frontend (Vercel env var) and backend (HF Space secret) — it's how the
  backend knows a request actually came from your app and not a random
  visitor who found the Space URL.
