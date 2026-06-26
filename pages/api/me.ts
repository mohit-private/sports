import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/session';
import { getPlayer, getMemberships, getPools, hasDatabase } from '@/lib/db';
import { getTournament, poolEconomics } from '@/lib/poolConfig';
import type { PoolMembership } from '@/lib/types';

/** Returns the signed-in user, their global paid flag, and the list of pools
 *  they've joined (each with its economics + the player's per-pool entry
 *  state). The client picks an "active" pool to play/view. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = getSessionUser(req);
  if (!user) return res.status(200).json({ user: null });

  let paid = false;
  let pools: PoolMembership[] = [];
  if (hasDatabase()) {
    try {
      const [player, memberships, allPools, t] = await Promise.all([
        getPlayer(user.sub),
        getMemberships(user.sub),
        getPools(),
        getTournament(),
      ]);
      paid = !!player?.paid;
      const byCode = new Map(allPools.map((p) => [p.code, p]));
      pools = memberships
        .filter((m) => byCode.has(m.pool_code)) // skip entries for deleted pools
        .map((m) => {
          const pool = byCode.get(m.pool_code)!;
          const { prize, currency } = poolEconomics(pool, t);
          return {
            code: m.pool_code,
            name: pool.name,
            fee: prize,
            currency,
            status: m.status,
            unlocked: m.unlocked,
            submittedAt: m.submitted_at,
          };
        });
    } catch {
      /* DB hiccup — return identity only */
    }
  }

  return res.status(200).json({ user, paid, pools, dbEnabled: hasDatabase() });
}
