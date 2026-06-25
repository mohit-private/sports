import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/session';
import { getPoolEntries, getResults, hasDatabase } from '@/lib/db';
import { getTournament, isPastDeadline, resolvePool } from '@/lib/poolConfig';
import { scorePicks } from '@/lib/scoring';
import { ensureDeadlineAutofill } from '@/lib/autofill';

/**
 * Everyone's picks — revealed ONLY after the submission deadline. This is the
 * one place pick contents are exposed, and the deadline gate applies to ALL
 * callers including the admin (the admin has no privileged pick access).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireUser(req, res);
  if (!user) return;

  const t = await getTournament();
  if (!isPastDeadline(t.deadline)) {
    return res.status(403).json({
      error: 'Picks stay private until the submission deadline.',
      deadline: t.deadline,
      locked: false,
    });
  }

  if (!hasDatabase()) return res.status(200).json({ entries: [], locked: true });

  // Reveal picks for one pool (given by ?pool=CODE).
  const poolCode = String(req.query.pool || '').trim().toUpperCase();
  const pool = poolCode ? await resolvePool(poolCode) : null;
  if (!pool) return res.status(200).json({ entries: [], results: {}, tournament: t, locked: true, needsJoin: true });

  // The deadline has passed (gated above) — make sure no-shows are auto-filled.
  await ensureDeadlineAutofill();

  const [rows, results] = await Promise.all([getPoolEntries(pool.code), getResults()]);
  const entries = rows
    .filter((p) => p.status === 'submitted' || Object.keys(p.picks).length > 0)
    .map((p) => ({
      userId: p.user_id,
      name: p.name || p.user_id,
      picture: p.picture ?? null,
      status: p.status,
      picks: p.picks,
      score: scorePicks(t, p.picks, results).total,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return res.status(200).json({ entries, results, tournament: t, poolName: pool.name, locked: true });
}
