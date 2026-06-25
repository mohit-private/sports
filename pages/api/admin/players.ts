import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { getPoolEntries, getResults, setPaid, setUnlocked, deletePlayerEntry, hasDatabase } from '@/lib/db';
import { getTournament, resolvePool } from '@/lib/poolConfig';
import { scorePicks } from '@/lib/scoring';

/**
 * Admin roster for one pool (?pool=CODE). Crucially returns NO pick data — the
 * admin sees who joined, who paid (global per-player flag), who submitted, and
 * each entry's SCORE, but never the picks themselves (privacy guarantee).
 *
 * GET  → roster for the pool (no picks)
 * POST → { action: 'paid', userId, value }            (global, per player)
 *      | { action: 'unlock', userId, pool, value }    (per pool entry)
 *      | { action: 'delete', userId, pool }           (remove entry + picks)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  if (!hasDatabase()) return res.status(200).json({ players: [], dbEnabled: false });

  if (req.method === 'GET') {
    const poolCode = String(req.query.pool || '').trim().toUpperCase();
    const pool = poolCode ? await resolvePool(poolCode) : null;
    if (!pool) return res.status(200).json({ players: [], dbEnabled: true, needsPool: true });

    const t = await getTournament();
    const [entries, results] = await Promise.all([getPoolEntries(pool.code), getResults()]);
    const roster = entries.map((p) => ({
      userId: p.user_id,
      name: p.name || p.user_id,
      email: p.email || '',
      picture: p.picture ?? null,
      paid: !!p.paid,
      status: p.status,
      unlocked: p.unlocked,
      submittedAt: p.submitted_at,
      poolCode: pool.code,
      // score only — never picks
      score: scorePicks(t, p.picks, results).total,
      hasPicks: Object.keys(p.picks).length > 0,
    }));
    return res.status(200).json({ players: roster, poolCode: pool.code, dbEnabled: true });
  }

  if (req.method === 'POST') {
    const { action, userId, value, pool } = req.body || {};
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'userId required.' });
    }
    if (action === 'paid') {
      await setPaid(userId, !!value);
    } else if (action === 'unlock') {
      const poolCode = String(pool || '').trim().toUpperCase();
      if (!poolCode) return res.status(400).json({ error: 'pool required to unlock an entry.' });
      await setUnlocked(userId, poolCode, !!value);
    } else if (action === 'delete') {
      const poolCode = String(pool || '').trim().toUpperCase();
      if (!poolCode) return res.status(400).json({ error: 'pool required to delete an entry.' });
      await deletePlayerEntry(userId, poolCode);
    } else {
      return res.status(400).json({ error: 'Unknown action.' });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
