import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { getConfig, setConfig, hasDatabase } from '@/lib/db';
import { getTournament } from '@/lib/poolConfig';
import type { Tournament } from '@/lib/types';

/**
 * Pool settings stored in the `tournament` config key (merged over the seed
 * by getTournament). The admin can set the submission deadline, entry fee,
 * payout split, and — once the real draw is known — override the group
 * composition, team list, and round points.
 *
 * GET → resolved tournament (seed + overrides)
 * PUT → { deadline?, entryFee?, payout?, groups?, teams?, rounds? }  (partial)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    return res.status(200).json({ tournament: await getTournament(), dbEnabled: hasDatabase() });
  }

  if (req.method === 'PUT') {
    if (!hasDatabase()) {
      return res.status(400).json({ error: 'No database configured — settings cannot be persisted.' });
    }
    const existing = (await getConfig<Partial<Tournament>>('tournament')) || {};
    const body = req.body || {};
    const next: Partial<Tournament> = { ...existing };

    if ('deadline' in body) next.deadline = body.deadline || null;
    if (typeof body.entryFee === 'number' && body.entryFee >= 0) next.entryFee = body.entryFee;
    if (body.payout && typeof body.payout === 'object') next.payout = body.payout;
    if (Array.isArray(body.groups)) next.groups = body.groups;
    if (body.teams && typeof body.teams === 'object') next.teams = body.teams;
    if (Array.isArray(body.rounds)) next.rounds = body.rounds;

    await setConfig('tournament', next);
    return res.status(200).json({ ok: true, tournament: await getTournament() });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
