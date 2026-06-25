import type { NextApiRequest, NextApiResponse } from 'next';
import { buildLocalUser, LocalAuthError } from '@/lib/localAuth';
import { createSessionToken, setSessionCookie } from '@/lib/session';
import { upsertPlayer, getPlayer, linkDevice, isDeviceLinked, hasDatabase, findDeviceEntry } from '@/lib/db';
import { ensureDeviceId } from '@/lib/device';
import { verifyDeviceCode } from '@/lib/deviceLink';

/**
 * Name-only sign-in with device linking.
 *  • New name → claim it on this device (and any device with no links yet).
 *  • Known name, this device already linked → sign in.
 *  • Known name, new device → require the rotating code shown on an already
 *    linked device ("Add a device"). Correct code links this device too.
 * This keeps one entry per name, usable across the owner's devices, while
 * stopping someone hijacking a name from a device they don't control.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let user;
  try {
    user = buildLocalUser((req.body?.name as string) || '');
  } catch (e) {
    const err = e as LocalAuthError;
    return res.status(err.status || 400).json({ error: err.message });
  }

  if (hasDatabase()) {
    const deviceId = ensureDeviceId(req, res);
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    try {
      const player = await getPlayer(user.sub);

      const noLinks = !player || ((player.linked_devices?.length ?? 0) === 0 && !player.device_id);
      if (noLinks) {
        // First claim (or re-claim after an admin reset) — but make sure this
        // device hasn't already claimed a different name.
        const existing = await findDeviceEntry(deviceId);
        if (existing && existing.user_id !== user.sub) {
          return res.status(409).json({
            error: `This device is already registered as "${existing.name}". Sign in with that name instead.`,
          });
        }
        await upsertPlayer({ userId: user.sub, email: user.email, name: user.name, picture: user.picture, deviceId });
        setSessionCookie(res, createSessionToken(user));
        return res.status(200).json({ user, claimed: true });
      }

      if (isDeviceLinked(player!, deviceId)) {
        setSessionCookie(res, createSessionToken(user));
        return res.status(200).json({ user });
      }

      // Known name on a new device → must verify with the rotating code.
      if (!code) {
        return res.status(409).json({
          needsVerification: true,
          name: user.name,
          error: `"${user.name}" is already in use. To add this device, enter the code shown on your signed-in device (menu → “Add a device”).`,
        });
      }
      if (!player!.link_secret || !verifyDeviceCode(player!.link_secret, code)) {
        return res.status(401).json({
          needsVerification: true,
          error: 'That code is wrong or expired — check your other device and try again.',
        });
      }
      await linkDevice(user.sub, deviceId);
      setSessionCookie(res, createSessionToken(user));
      return res.status(200).json({ user, linked: true });
    } catch (e) {
      return res.status(500).json({ error: `Could not sign in: ${(e as Error).message}` });
    }
  }

  // Without a DB, persistence is browser-only — just establish the session.
  setSessionCookie(res, createSessionToken(user));
  return res.status(200).json({ user });
}
