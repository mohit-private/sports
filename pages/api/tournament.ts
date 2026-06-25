import type { NextApiRequest, NextApiResponse } from 'next';
import { getTournament, isPastDeadline, resolvePool, poolEconomics } from '@/lib/poolConfig';
import { getPoolEntries, hasDatabase } from '@/lib/db';

/**
 * Public tournament payload: teams, groups, rounds/points, deadline, plus the
 * pot/counts for a given pool (?pool=CODE) using that pool's own fee/currency.
 * A fee of 0 means no pot / payment UI. Contains no pick data.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const t = await getTournament();

  let paidCount = 0;
  let playerCount = 0;
  let submittedCount = 0;
  let prize = 0;
  let currency = 'USD';
  if (hasDatabase()) {
    try {
      const poolCode = String(req.query.pool || '').trim().toUpperCase();
      const pool = poolCode ? await resolvePool(poolCode) : null;
      if (pool) {
        ({ prize, currency } = poolEconomics(pool, t));
        const entries = await getPoolEntries(pool.code);
        playerCount = entries.length;
        paidCount = entries.filter((p) => p.paid).length;
        submittedCount = entries.filter((p) => p.status === 'submitted').length;
      }
    } catch {
      /* ignore */
    }
  }

  const locked = isPastDeadline(t.deadline);
  // Each pool has a fixed prize the organizer sets (0 = none / hidden).
  return res.status(200).json({
    tournament: t,
    prize,
    currency,
    paidCount,
    submittedCount,
    playerCount,
    locked,
    serverTime: new Date().toISOString(),
  });
}
