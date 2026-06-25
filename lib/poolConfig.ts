import type { Tournament, Knockout } from './types';
import { DEFAULT_TOURNAMENT } from './tournamentData';
import { getConfig, hasDatabase, getPools } from './db';
import type { Pool } from './db';
import { buildKnockout } from './knockout';
import { DEFAULT_CURRENCY, isSupportedCurrency } from './currency';

/** A projected Round of 32 so the knockout bracket is predictable from day one,
 *  before any real group results. Seeds each group's 1st/2nd from seed order and
 *  the 8 best third-placed teams by FIFA rank. Replaced by the real draw once
 *  the admin finalizes the groups. */
function projectedKnockout(t: Tournament): Knockout {
  const standings: Record<string, { first: string; second: string; third: string }> = {};
  for (const g of t.groups) {
    const r = [...g.teams].sort((a, b) => (t.teams[a]?.rank ?? 99) - (t.teams[b]?.rank ?? 99));
    standings[g.id] = { first: r[0], second: r[1], third: r[2] };
  }
  const thirds = Object.values(standings)
    .map((s) => s.third)
    .filter(Boolean)
    .sort((a, b) => (t.teams[a]?.rank ?? 99) - (t.teams[b]?.rank ?? 99))
    .slice(0, 8);
  const { r32 } = buildKnockout(t.groups, standings, thirds);
  return { r32, finalizedAt: '', projected: true };
}

// Resolves the live tournament config: starts from the seed, applies any admin
// override stored in the DB (app_config key "tournament"), folds in the real
// knockout bracket once finalized (key "knockout"), and resolves the submission
// deadline (DB override > env SUBMISSION_DEADLINE > seed). The phase is derived
// from whether the knockout bracket exists.

export async function getTournament(): Promise<Tournament> {
  let t: Tournament = { ...DEFAULT_TOURNAMENT };

  if (hasDatabase()) {
    const override = await getConfig<Partial<Tournament>>('tournament');
    if (override) t = { ...t, ...override };

    const knockout = await getConfig<Knockout>('knockout');
    if (knockout && Array.isArray(knockout.r32) && knockout.r32.length > 0) {
      t.knockout = knockout;
    }
  }

  // The knockout bracket is always available to predict: until the admin
  // finalizes the real draw, fall back to a projected Round of 32 from the seed.
  if (!t.knockout || !Array.isArray(t.knockout.r32) || t.knockout.r32.length === 0) {
    t.knockout = projectedKnockout(t);
  }

  // Deadline precedence: DB override (already merged above if present) → env → null.
  if (!t.deadline && process.env.SUBMISSION_DEADLINE) {
    t.deadline = process.env.SUBMISSION_DEADLINE;
  }

  // Always in the knockout phase now — the bracket is the main, always-open game;
  // group predictions are a separate "for fun" tab.
  t.phase = 'knockout';

  // Published current standings (organizer-entered group 1st/2nd/3rd) power the
  // player-side "autofill by current standings" shortcut.
  if (hasDatabase()) {
    const gf = await getConfig<{ standings: Record<string, { first: string; second: string; third: string }> }>(
      'groupFinal'
    );
    if (gf?.standings) {
      const ls: Record<string, string[]> = {};
      for (const g of t.groups) {
        const s = gf.standings[g.id];
        if (s) {
          const trio = [s.first, s.second, s.third].filter(Boolean);
          if (trio.length) ls[g.id] = trio;
        }
      }
      t.liveStandings = Object.keys(ls).length ? ls : null;
    }
  }

  return t;
}

/** A pool's prize + currency. The stored `fee` field is the pool's fixed PRIZE
 *  amount (not a per-entry fee). Defaults to 0 — a prize of 0 means there's no
 *  prize and all prize UI is hidden. */
export function poolEconomics(pool: Pool, _t: Tournament): { prize: number; currency: string } {
  const prize = typeof pool.fee === 'number' ? pool.fee : 0;
  const currency = isSupportedCurrency(pool.currency) ? (pool.currency as string) : DEFAULT_CURRENCY;
  return { prize: Math.max(0, prize || 0), currency };
}

/** Look up a pool by code (case-insensitive), or null. */
export async function resolvePool(code: string): Promise<Pool | null> {
  const pools = await getPools();
  const want = code.trim().toUpperCase();
  return pools.find((p) => p.code.toUpperCase() === want) || null;
}

export function isPastDeadline(deadline: string | null, now: number = Date.now()): boolean {
  if (!deadline) return false;
  const ts = Date.parse(deadline);
  if (Number.isNaN(ts)) return false;
  return now >= ts;
}
