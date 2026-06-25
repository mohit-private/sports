# CLAUDE.md — novo-fifa

Loaded at the start of every Claude Code session for this app.

## What this app is

A FIFA World Cup 2026 bracket prediction pool. Players join with a name only
(no accounts/OAuth), fill a knockout bracket from the Round of 32 to the
champion, and compete for a pot. Each pool sets its own entry fee + currency
(0 = free, which hides all pot/payment UI). See [README.md](README.md) for the
full rules.

## Tech stack

- Next.js **Pages Router** (`/pages`) — NOT App Router
- React 18 + TypeScript, Tailwind CSS v3 (`darkMode: 'class'`)
- Postgres via `postgres` (postgres.js) — [lib/db.ts](lib/db.ts)
- Name-only sign-in (no OAuth): a typed name maps to a synthetic identity —
  [lib/localAuth.ts](lib/localAuth.ts), [pages/api/auth/local.ts](pages/api/auth/local.ts)
- Signed-cookie sessions (HMAC, stateless) — [lib/session.ts](lib/session.ts)
- Zustand for client state — [store/appStore.ts](store/appStore.ts)

## Hard rules / invariants

1. **The admin must never see pick contents.** Admin endpoints
   (`pages/api/admin/*`) and the admin UI expose status + scores only. The only
   place picks are returned is `pages/api/all-picks.ts`, and it is gated on the
   submission deadline for *everyone* (admin included). Don't add a code path
   that returns another player's picks before the deadline.

2. **A submitted entry is locked.** Editing requires `status === 'draft'` OR
   `unlocked === true`. Submitting clears `unlocked`. Unlocking (admin only)
   flips status back to `draft`. The deadline overrides everything — once past,
   no edits at all.

3. **Scoring is advancement-based and never negative.** See
   [lib/scoring.ts](lib/scoring.ts): for each round, `points × |predicted ∩
   actual advancers|`. Don't introduce penalties.

4. **The tournament is data-driven.** Teams, R32 fixtures, rounds/points, fee,
   payout, and deadline come from `getTournament()` ([lib/poolConfig.ts](lib/poolConfig.ts)),
   which merges the seed ([lib/tournamentData.ts](lib/tournamentData.ts)) with a
   DB `tournament` config override. Update the seed or the override — don't
   hardcode teams/points in components or API routes.

5. **Bracket math lives in [lib/bracket.ts](lib/bracket.ts)** and is shared by
   the UI and scoring. `prunePicks` keeps downstream picks consistent when an
   upstream winner changes — call it whenever picks mutate.

6. **Secrets in `.env.local` only**, never committed. Canonical set is in
   `.env.local.example`.

7. **One entry per device, and names are unique.** Both are enforced at join
   time in [pages/api/auth/local.ts](pages/api/auth/local.ts): a device's first
   name claims the entry (bound via `device_id`), the same device can't create a
   second under a different name, and a name already held by another device is
   rejected. Re-entering the same name on the same device resumes that entry.
   (Requires a DB — with none, persistence is browser-only and the rules can't
   be enforced.)

## Environment variables

| Variable | Purpose | Browser-exposed? |
|---|---|---|
| `DATABASE_URL` | Postgres / Neon connection string | no |
| `SESSION_SECRET` | HMAC key for session cookies (required in prod) | no |
| `ADMIN_PASSWORD` | Gates `/admin` (X-Admin-Password header) | no |
| `SUBMISSION_DEADLINE` | Optional default deadline (ISO) | no |

### Name-only sign-in

The only auth method. A typed name maps to a stable synthetic identity
(`local:<slug>`) — see [lib/localAuth.ts](lib/localAuth.ts) and
[pages/api/auth/local.ts](pages/api/auth/local.ts). The name is the unique key,
and the entry is bound to the first device that claims it (see rule 7). In dev,
`SESSION_SECRET` falls back to an insecure constant; production requires a real
one.

## Gotchas

- `lib/db.ts` lazily runs `ensureSchema()` (idempotent). Tables: `players`,
  `app_config`. Run `npm run setup:db` to create explicitly.
- With no `DATABASE_URL` the app degrades gracefully: picks persist only in the
  browser (localStorage) and there's no shared leaderboard.
- postgres.js returns JSONB as a string — `parsePicks` / `getConfig` parse it.
  Keep that in mind when adding JSONB columns.
- The R32 seed is *projected* from current standings. Swap in the real bracket
  via the admin Settings override once it's confirmed.
