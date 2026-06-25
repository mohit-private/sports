# Novo FIFA 2026 — Test Plan

A quick manual test pass for the bracket pool. No account needed — you sign in
with **just a name**. Allow ~10–15 min.

## Setup
- **App URL:** your deployed URL (or `http://localhost:3000` in dev)
- **Admin URL:** `/admin` — password is the `ADMIN_PASSWORD` env var (dev: `admin123`)
- **Pool code:** get one from the organizer (admin can create them — see Admin tests). A `MAIN` pool exists by default.
- **Tip:** to test "second person from the same machine," use a **separate browser or an Incognito/Private window** (each acts like a different device).

Mark each row Pass/Fail and note anything odd.

---

## 1. Sign in & join a pool
| # | Step | Expected |
|---|---|---|
| 1.1 | Open the app, go to **My Bracket** | Prompted to **sign in** (name only — no Google) |
| 1.2 | Enter a name, continue | Signed in; then prompted to **Join your pool** (enter a code) |
| 1.3 | Enter a wrong code (e.g. `NOPE`) | Error: "No pool with that code" |
| 1.4 | Enter a valid code | Joins the pool; your bracket page loads; header/banner shows the pool name |
| 1.5 | Top banner | Shows **Prizes** (🥇 2 Official Soccer Jerseys, 🥈 1 Jersey) + the deadline countdown |

## 2. Group predictions
| # | Step | Expected |
|---|---|---|
| 2.1 | In **Group Stage**, each of the 12 groups (A–L) shows 4 teams with FIFA rank + form | Full team names visible (not cut off) |
| 2.2 | For a team, tap 🥇 / 🥈 / 🥉 | Marks 1st/2nd/3rd; a team can hold only one rank in its group |
| 2.3 | Click **⚡ Autofill by FIFA ranking** | Every group's top 3 filled by rank |
| 2.4 | Click **📊 Autofill by current standings** (if enabled) | Fills from the published live standings (greyed if organizer hasn't published) |

## 3. Knockout bracket
| # | Step | Expected |
|---|---|---|
| 3.1 | Scroll to the **Knockout Bracket** | Centered layout: Final + champion in the middle, two halves fan out to the Round of 32 |
| 3.2 | Each round header | Shows points (R32 1 · R16 2 · QF 3 · SF 5 · Final 10 · 3rd 5) and a `x/N` picked counter |
| 3.3 | Pick a winner in an R32 match | Selected team highlights **light blue**; it advances into the next round; downstream slots that referenced a now-removed team clear |
| 3.4 | A future-round slot before its feeders are picked | Shows 🔒 "Winner of previous round" |

## 4. Submit (must pick everything)
| # | Step | Expected |
|---|---|---|
| 4.1 | Leave any group or knockout pick blank | **Submit is disabled**; tooltip: "Pick every group's 1st/2nd/3rd and every knockout match first" |
| 4.2 | Progress bar | Counts both group picks **and** knockout picks |
| 4.3 | Complete everything, click **Submit**, confirm | Bracket locks: "submitted and locked" |
| 4.4 | Try to change a pick after submitting | Read-only / locked (until an admin unlocks you) |

## 5. One entry per machine (device lock)
| # | Step | Expected |
|---|---|---|
| 5.1 | After submitting as person A, **sign out** | Back to sign-in |
| 5.2 | In the **same browser**, sign in as a different name, join a pool, complete a bracket, Submit | **Blocked**: "This device has already submitted an entry (as A)" |
| 5.3 | Repeat 5.2 in a **fresh Incognito window** | Allowed (different device) |

> Note: this is a browser-cookie lock — it stops casual double-entry but is bypassable (incognito / clearing cookies / another device). That's expected.

## 6. Leaderboard & scoring (after the deadline / once results exist)
| # | Step | Expected |
|---|---|---|
| 6.1 | Open **Leaderboard** before the deadline | "Picks are private until the deadline" |
| 6.2 | After the deadline | Everyone in **your pool** listed with scores; each row shows the player's 🏆 picked champion |
| 6.3 | Admin enters a round's results (see 8.4) | Scores update automatically for anyone who picked those winners |
| 6.4 | Expand a player | Knockout bracket only (no group stage); correct picks ringed green with **✓ +N pts**, wrong with **✗ 0 pts** |

## 7. Live standings
| # | Step | Expected |
|---|---|---|
| 7.1 | On **My Bracket** (or **Live Standings**) | A "Live group standings" panel shows all 12 groups' current tables (live from ESPN) |
| 7.2 | Table shading | Top 2 green, 3rd amber; updates as real games finish |

## 8. Admin (`/admin`, password required)
| # | Step | Expected |
|---|---|---|
| 8.1 | **Pools** tab → add a pool (code + name) | New pool appears with joined/submitted counts; share the code with testers |
| 8.2 | Delete a pool | Removed from the list |
| 8.3 | **Pools** → **Reset device locks** | All device locks cleared (machines can submit fresh — useful for re-testing) |
| 8.4 | **Results** tab → tap teams that won a round → **Save** | Persists; revisit shows it saved; leaderboard scores recompute |
| 8.5 | **Finalize** tab → **🌐 Autofill by current standings (live)** | Fills each group's 1/2/3 + 8 best thirds from ESPN |
| 8.6 | **Finalize** → set 1/2/3 for all 12 + tick exactly 8 thirds → **Finalize** | Builds the real Round of 32; bracket switches from projected to the real draw |
| 8.7 | **Players** tab | Shows status/score/pool per player — **never** their pick contents |

## 9. Prizes
| # | Step | Expected |
|---|---|---|
| 9.1 | Home page + bracket banner | Winner = **2 Official Soccer Jerseys**, Runner-up = **1 Official Soccer Jersey** (no money) |

---

## What to report
For any failure, note: which step, what you saw vs. expected, the URL, browser, and whether you were signed in / which pool. Screenshots help.
