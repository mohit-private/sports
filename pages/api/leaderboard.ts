import type { NextApiRequest, NextApiResponse } from 'next';
import { getPoolEntries, getResults, hasDatabase } from '@/lib/db';
import { getTournament, resolvePool, poolEconomics } from '@/lib/poolConfig';
import { scorePicks, rankScores, computePayouts } from '@/lib/scoring';
import { ensureDeadlineAutofill } from '@/lib/autofill';

/**
 * Leaderboard for one pool: each entry's score (from admin-entered results),
 * competition ranking, and projected payouts. No pick contents are ever
 * returned — only aggregate scores. The pool is given by ?pool=CODE; its own
 * fee/currency drive the pot (a fee of 0 means no pot / payment UI).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const t = await getTournament();

  if (!hasDatabase()) {
    return res.status(200).json({ standings: [], payouts: null, pot: 0, dbEnabled: false });
  }

  const poolCode = String(req.query.pool || '').trim().toUpperCase();
  const pool = poolCode ? await resolvePool(poolCode) : null;
  if (!pool) {
    return res.status(200).json({ standings: [], payouts: null, pot: 0, dbEnabled: true, needsJoin: true });
  }
  const { prize, currency } = poolEconomics(pool, t);

  // After the deadline, auto-submit random brackets for any no-shows (once).
  await ensureDeadlineAutofill();

  const [entries, results] = await Promise.all([getPoolEntries(pool.code), getResults()]);

  const scored = entries.map((p) => {
    const breakdown = scorePicks(t, p.picks, results);
    return {
      userId: p.user_id,
      name: p.name || p.user_id,
      picture: p.picture ?? null,
      paid: !!p.paid,
      status: p.status,
      score: breakdown.total,
      correct: breakdown.correct,
    };
  });

  const ranks = rankScores(scored.map((s) => ({ userId: s.userId, score: s.score })));
  const rankByUser = new Map(ranks.map((r) => [r.userId, r.rank]));

  const paidCount = scored.filter((p) => p.paid).length;
  // Fixed prize set by the organizer for this pool.
  const payouts = computePayouts(ranks, prize, t.payout);

  const standings = scored
    .map((s) => ({
      ...s,
      rank: rankByUser.get(s.userId) || 0,
      award: payouts.awards[s.userId] || 0,
    }))
    .sort((a, b) => a.rank - b.rank || b.correct - a.correct || a.name.localeCompare(b.name));

  return res.status(200).json({
    standings,
    payouts,
    pot: payouts.pot,
    paidCount,
    prize,
    currency,
    poolCode: pool.code,
    poolName: pool.name,
    hasResults: Object.values(results).some((arr) => (arr || []).length > 0),
    dbEnabled: true,
  });
}
