import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { getResults, setConfig, hasDatabase } from '@/lib/db';
import type { Results, RoundId } from '@/lib/types';

const ROUND_IDS: RoundId[] = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL', 'THIRD'];

/**
 * Match results that drive scoring. The admin enters, per round, the team
 * codes that actually advanced (won that round). Scores recompute live.
 *
 * GET → current results
 * PUT → { results: { R32:[...], R16:[...], ... } }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  if (!hasDatabase()) return res.status(200).json({ results: {}, dbEnabled: false });

  if (req.method === 'GET') {
    return res.status(200).json({ results: await getResults(), dbEnabled: true });
  }

  if (req.method === 'PUT') {
    const incoming = (req.body?.results || {}) as Record<string, unknown>;
    const clean: Results = {};
    for (const id of ROUND_IDS) {
      const arr = incoming[id];
      if (Array.isArray(arr)) {
        clean[id] = arr.filter((x) => typeof x === 'string' && x).map((x) => (x as string).toUpperCase());
      }
    }
    // Actual scorelines (excl. penalties), keyed `${round}:${code}` → [gf, ga].
    const inScores = (incoming.scores || {}) as Record<string, unknown>;
    const scores: Record<string, [number, number]> = {};
    for (const [key, val] of Object.entries(inScores)) {
      if (!Array.isArray(val) || val.length !== 2) continue;
      const gf = Number(val[0]);
      const ga = Number(val[1]);
      if (Number.isInteger(gf) && Number.isInteger(ga) && gf >= 0 && ga >= 0 && gf <= 99 && ga <= 99) {
        scores[key.toUpperCase()] = [gf, ga];
      }
    }
    clean.scores = scores;
    await setConfig('results', clean);
    return res.status(200).json({ ok: true, results: clean });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
