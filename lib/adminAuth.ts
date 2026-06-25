import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Admin password check. The password lives in ADMIN_PASSWORD; the client sends
 * it via the X-Admin-Password header. Returns true if authorised, otherwise
 * writes a 401/500 response — callers should `return` immediately on false.
 *
 * Note: the admin role can manage the pool (payments, unlocks, results,
 * deadline) but is NEVER given access to any player's pick contents — that
 * privacy guarantee is enforced in the data endpoints, not here.
 */
export function requireAdmin(req: NextApiRequest, res: NextApiResponse): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    res.status(500).json({ error: 'ADMIN_PASSWORD is not configured on the server.' });
    return false;
  }
  const provided = req.headers['x-admin-password'];
  if (typeof provided !== 'string' || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized — invalid admin password.' });
    return false;
  }
  return true;
}
