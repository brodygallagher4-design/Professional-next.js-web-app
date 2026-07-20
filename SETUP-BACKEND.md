# SimBazaar — Railway + Supabase setup

The app now ships with a Node/Express backend (`server/index.mjs`) that serves the
built website **and** a JSON API, backed by a Supabase Postgres database.

```
Browser ──► Railway (Express server)
              ├── serves dist/  (your website)
              └── /api/* ──► Supabase (Postgres)
```

## 1. Create the Supabase database (5 minutes)

1. Go to https://supabase.com → New project (pick a strong DB password, any region near your users).
2. When it finishes provisioning, open **SQL Editor**, paste the whole contents of
   `supabase/schema.sql`, and click **Run**. That creates the tables
   (merchants, products, purchases, chat_messages, referrals) and seeds them
   with the app's current data.
3. Collect two values from **Project Settings → API**:
   - `Project URL`            → this is `SUPABASE_URL`
   - `service_role` secret key → this is `SUPABASE_SERVICE_ROLE_KEY`

> The service-role key must ONLY ever live on the server (Railway env vars).
> Never put it in frontend code and never commit it to git. Row Level Security
> is enabled on every table with no public policies, so browsers can't read
> the database directly — everything goes through your API.

## 2. Run it locally first

```bash
# copy the env template and fill in the two Supabase values
cp .env.example .env            # then edit .env

# terminal 1 — backend (reads .env automatically? no: set the vars, then run)
set SUPABASE_URL=...            # PowerShell: $env:SUPABASE_URL="..."
set SUPABASE_SERVICE_ROLE_KEY=...
npm run dev:server              # starts http://localhost:8787

# terminal 2 — frontend
npm run dev                     # http://localhost:5173 (proxies /api → :8787)
```

Check http://localhost:8787/api/health — you want `{"ok":true,"db":true}`.
The marketplace "Trending now" grid now loads from the database (and falls back
to the built-in demo data whenever the API is offline).

## 3. Deploy to Railway

Easiest path (GitHub):
1. Push this folder to a GitHub repository.
2. https://railway.app → New Project → **Deploy from GitHub repo** → pick the repo.
3. Railway auto-detects Node. Set these in **Variables**:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. In **Settings → Build**, set Build Command to `npm run build`
   (Start Command is picked up from `package.json` → `npm start`).
5. Generate a domain under **Settings → Networking**. Done — that URL serves
   your whole site with the live API.

Alternative (no GitHub): install the Railway CLI, then `railway init` and
`railway up` from this folder, and add the same two variables.

## 4. What's wired so far

- `GET /api/health` — server + database status
- `GET /api/products` — marketplace catalogue (already consumed by the app)
- `GET /api/merchants` — top merchants
- `GET /api/purchases` — My Purchase orders
- `GET/POST /api/orders/:id/messages` — trade chat persistence
- Frontend helper: `src/app/lib/api.ts` (each call falls back gracefully)

Next candidates to wire end-to-end when you're ready: My Purchase from
`/api/purchases`, the trade chat, Top Merchants, and Supabase Auth for logins.

## Authentication

Accounts are managed by **Supabase Auth** (email + password). The Express server
exposes `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout` and
`/api/auth/session`; on success it stores an opaque session token (SHA-256
hashed) in the `sessions` table and sets an httpOnly `sb_session` cookie
(30 days). Every `/api/*` route except `GET /api/products`, `GET /api/merchants`
and `/api/health` requires a valid session. In the app, public visitors can only
open the landing page, marketplace/browsing pages and the login/signup pages —
everything else redirects to login and returns them to the page they wanted.
