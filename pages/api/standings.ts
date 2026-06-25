import type { NextApiRequest, NextApiResponse } from 'next';
import { getLiveTable } from '@/lib/liveStandings';

// Public: today's live group standings (full table per group) for display.
// Cached server-side; safe to poll. Returns { groups: [] } on fetch failure so
// the UI degrades quietly.
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const table = await getLiveTable();
    return res.status(200).json(table);
  } catch {
    return res.status(200).json({ groups: [], source: 'ESPN', fetchedAt: null });
  }
}
