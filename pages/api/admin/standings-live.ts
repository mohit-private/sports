import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { getLiveTable, deriveAutofill } from '@/lib/liveStandings';

// Returns today's live group standings mapped to our teams, plus a derived
// autofill payload (each group's 1st/2nd/3rd + the 8 best third-placed teams)
// for the admin Finalize form.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const table = await getLiveTable();
    const { standings, advancingThirds, matchedGroups } = deriveAutofill(table);
    if (matchedGroups === 0) {
      return res.status(502).json({ error: 'Live standings fetched but no groups could be matched.' });
    }
    // Include the raw live table (codes + names + points) so the admin can
    // verify the autofill against what ESPN actually reports.
    return res.status(200).json({
      standings,
      advancingThirds,
      matchedGroups,
      groups: table.groups,
      source: table.source,
      fetchedAt: table.fetchedAt,
    });
  } catch (e) {
    return res.status(502).json({ error: `Could not fetch live standings: ${(e as Error).message}` });
  }
}
