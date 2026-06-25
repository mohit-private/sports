import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { getConfig, setConfig, getResults, reopenAllForKnockout, hasDatabase } from '@/lib/db';
import { getTournament } from '@/lib/poolConfig';
import { buildKnockout, validateFinalize, GroupStandings } from '@/lib/knockout';
import type { Knockout } from '@/lib/types';

/**
 * Finalize the group stage. The admin submits each group's real finishing
 * order (1st/2nd/3rd) and the 8 third-placed teams that advance. We resolve the
 * real Round-of-32 bracket, record the 32 qualifiers as GROUP results (scores
 * the group predictions), and reopen every entry for knockout picks.
 *
 * GET  → current finalize state ({ standings, advancingThirds } or null)
 * PUT  → { standings: { A:{first,second,third}, ... }, advancingThirds: [...8] }
 * DELETE → undo finalization (back to the groups phase)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  if (!hasDatabase()) return res.status(400).json({ error: 'No database configured.' });

  const t = await getTournament();

  if (req.method === 'GET') {
    const saved = await getConfig<{ standings: GroupStandings; advancingThirds: string[] }>('groupFinal');
    return res.status(200).json({ finalize: saved || null, phase: t.phase });
  }

  if (req.method === 'PUT') {
    const standings = (req.body?.standings || {}) as GroupStandings;
    const advancingThirds = Array.isArray(req.body?.advancingThirds)
      ? (req.body.advancingThirds as string[])
      : [];

    // Publish-only: save the current standings (partial allowed) so players can
    // "autofill by current standings", WITHOUT building the R32 or locking the
    // group phase. No full validation required.
    if (req.body?.publishOnly) {
      await setConfig('groupFinal', { standings, advancingThirds });
      const published = await getTournament();
      return res
        .status(200)
        .json({ ok: true, published: Object.keys(published.liveStandings || {}).length, tournament: published });
    }

    const err = validateFinalize(t.groups, standings, advancingThirds);
    if (err) return res.status(400).json({ error: err });

    const { r32, qualifiers } = buildKnockout(t.groups, standings, advancingThirds);
    const knockout: Knockout = { r32, finalizedAt: new Date().toISOString() };

    await setConfig('knockout', knockout);
    await setConfig('groupFinal', { standings, advancingThirds });

    // Record the 32 advancers as GROUP results so group predictions score.
    const results = await getResults();
    results.GROUP = qualifiers;
    await setConfig('results', results);

    // Reopen everyone for knockout predictions.
    await reopenAllForKnockout();

    return res.status(200).json({ ok: true, tournament: await getTournament() });
  }

  if (req.method === 'DELETE') {
    // Undo: clear the knockout bracket → back to the groups phase.
    await setConfig('knockout', { r32: [], finalizedAt: '' });
    return res.status(200).json({ ok: true, tournament: await getTournament() });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
