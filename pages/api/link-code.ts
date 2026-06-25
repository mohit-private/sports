import type { NextApiRequest, NextApiResponse } from 'next';
import { getSessionUser } from '@/lib/session';
import { getDeviceId } from '@/lib/device';
import { getPlayer, isDeviceLinked, hasDatabase } from '@/lib/db';
import { deviceCode, codeExpiresInMs } from '@/lib/deviceLink';

/**
 * Returns the current rotating "add a device" code for the signed-in player.
 * Only an already-linked device may see it (so a stranger can't pull the code).
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not signed in.' });
  if (!hasDatabase()) return res.status(200).json({ code: null, dbEnabled: false });

  const player = await getPlayer(user.sub);
  if (!player || !player.link_secret) return res.status(404).json({ error: 'No entry found.' });

  const deviceId = getDeviceId(req);
  if (!isDeviceLinked(player, deviceId)) {
    return res.status(403).json({ error: 'This device isn’t linked to your entry.' });
  }

  const now = Date.now();
  return res.status(200).json({
    code: deviceCode(player.link_secret, now),
    expiresInMs: codeExpiresInMs(now),
  });
}
