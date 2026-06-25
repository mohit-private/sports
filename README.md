# Novo FIFA 2026 — Bracket Prediction Pool ⚽🏆

A friendly office pool for the FIFA World Cup 2026 knockout stage. Players join
with a name only, fill a bracket from the **Round of 32** up to the champion,
and chase the pot. Built with the same stack and discipline as the Novo
Vulnerability Tracker (Next.js Pages Router + Postgres/Neon + Tailwind).

## How it plays

- **Join** by entering a name — no accounts or sign-up. Each name can be used
  once, and a device can hold only one entry.
- **Pick** a winner for every knockout match — R32 → R16 → QF → SF → Final,
  plus the 3rd-place playoff. Each match shows FIFA rank, recent form, and a
  suggested favorite (a hint only — pick whoever you want).
- **Group predictions are optional & just for fun** (0 points) — the scored game
  is the knockout bracket.
- **Entry fee is per pool** (honor system) — the organizer sets each pool's fee
  and currency, or 0 for a free pool (which hides all pot/payment UI).
- **Edit until the deadline** — submit any time and keep changing your bracket
  right up to the deadline. Nobody sees your picks (not even the admin) until then.
- **Deadline** reveals everyone's picks on the All Picks page. If you registered
  but didn't submit, a random bracket is auto-filled for you.
- **Score** as results come in. No negative points.

| Round | Points per correct pick |
|---|---|
| Round of 32 | 1 |
| Round of 16 | 2 |
| Quarter-Finals | 3 |
| Semi-Finals | 5 |
| Final (champion) | 10 |
| Third place | 5 |

Scoring is **advancement-based**: you earn a round's points for every team you
correctly picked to win in that round (i.e. that actually advanced). This is
forgiving of bracket-path divergence — a fair model for a pool.

### Payouts

- 🥇 Winner: **80%** of the pot · 🥈 Runner-up: **20%**.
- **Tie for 1st:** the tied players split **50% each** and the 20% runner-up
  prize is void.
- Tie for 2nd splits the 20% evenly.

## Privacy model

- A player only ever sees **their own** picks until the deadline.
- After the deadline, **all** brackets are public on the All Picks page.
- The **admin cannot see pick contents** — the admin panel and APIs expose
  join/payment/submission status and *scores* only, never picks. The All Picks
  endpoint enforces the deadline gate for everyone, admin included.
- Your in-progress bracket is cached in the browser (localStorage) so it
  survives reloads even before you submit.

> Note: this is app-level privacy. Anyone with raw database access could read
> the `picks` column directly — that's out of scope for a fun pool. Picks must
> be readable server-side to compute scores once results are in (which only
> happens after the deadline, when picks are public anyway).

## Tech stack

- Next.js **Pages Router** + React 18 + TypeScript
- Tailwind CSS v3 (dark / light / system theme)
- Postgres via `postgres` (`postgres.js`) — local Postgres in dev, Neon on Vercel
- Name-only sign-in (no OAuth) — a typed name maps to a synthetic identity
- Signed-cookie sessions (HMAC, no server store) · Zustand for client state

## Local setup

1. **Install**
   ```bash
   npm install
   ```
2. **Configure** — copy the env template and fill it in:
   ```bash
   cp .env.local.example .env.local
   ```
   Minimum to run:
   - `DATABASE_URL` — a local Postgres (required to enforce unique names +
     one-entry-per-device; leave blank for browser-only mode)
   - `SESSION_SECRET` — `openssl rand -hex 32` (required in production)
   - `ADMIN_PASSWORD` — gates `/admin`
3. **Create tables** (if using a DB):
   ```bash
   npm run setup:db
   ```
4. **Run**
   ```bash
   npm run dev
   ```
   → http://localhost:3000

### Local Postgres quick start

```bash
createdb novo_fifa
# .env.local:
# DATABASE_URL=postgres://$(whoami)@localhost:5432/novo_fifa
npm run setup:db
```

Without `DATABASE_URL` the app still runs, but picks live only in the browser
and there's no shared leaderboard.

## Deploy to Vercel

1. Import the repo into Vercel (framework auto-detected as Next.js).
2. **Storage → Create → Postgres (Neon)** — Vercel injects `DATABASE_URL`.
3. Add env vars: `SESSION_SECRET`, `ADMIN_PASSWORD`, (optional)
   `SUBMISSION_DEADLINE`.
4. Deploy. Tables are created automatically on first request (idempotent), or
   run `npm run setup:db` against the Neon URL.

## Admin guide (`/admin`)

Password-protected (`ADMIN_PASSWORD`):

- **Players** — per pool: mark entries paid, see scores. (Never shows picks.)
- **Pools** — create pools, each with its own entry fee + currency (0 = free).
- **Finalize** — set the real group standings (autofill from live ESPN) to build
  the Round of 32.
- **Results** — tap the actual winners on the bracket as matches finish;
  everyone's standings recompute on save.
- **Settings** — submission deadline and defaults.

When the **real** Round of 32 is confirmed, update the fixtures/teams: the seed
lives in [lib/tournamentData.ts](lib/tournamentData.ts), and the admin Settings
endpoint also accepts an `r32` / `teams` / `rounds` override (stored in the
`tournament` config row). Everything downstream is data-driven from there.

## Project layout..

```
lib/            db, session, localAuth, device, scoring, bracket math, seed data
pages/          index, play, leaderboard, picks, admin
pages/api/      auth, me, tournament, picks, leaderboard, all-picks, admin/*
components/     Layout, Bracket, TeamButton, PotBanner, Countdown, ...
store/          zustand app store + localStorage draft cache
scripts/        setup-db.mts
```
