import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { resetDeviceLocks, hasDatabase } from '@/lib/db';

/** Clear all device locks so machines can submit a fresh entry (e.g. for a new
 *  round, or to undo a mistaken lock). POST only. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasDatabase()) return res.status(400).json({ error: 'No database configured.' });
  await resetDeviceLocks();
  return res.status(200).json({ ok: true });
}
