import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/session';
import { getPlayer, upsertPlayer, ensureEntry, hasDatabase } from '@/lib/db';
import { resolvePool, getTournament, poolEconomics } from '@/lib/poolConfig';

/**
 * Join a pool by code. Additive — the player keeps any pools they're already
 * in; this just adds a (draft) entry for the new pool. A player has a separate
 * bracket per pool. Codes are matched case-insensitively.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = requireUser(req, res);
  if (!user) return;
  if (!hasDatabase()) return res.status(400).json({ error: 'No database configured.' });

  const code = String(req.body?.code || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ error: 'Enter a pool code to join.' });

  const pool = await resolvePool(code);
  if (!pool) return res.status(404).json({ error: 'No pool with that code. Check with your organizer.' });

  // Ensure the player row exists (sessions can outlive rows), then add the entry.
  const existing = await getPlayer(user.sub);
  if (!existing) {
    await upsertPlayer({ userId: user.sub, email: user.email, name: user.name, picture: user.picture });
  }
  await ensureEntry(user.sub, pool.code);

  const t = await getTournament();
  const { prize, currency } = poolEconomics(pool, t);
  return res.status(200).json({ ok: true, pool: { code: pool.code, name: pool.name, fee: prize, currency } });
}
