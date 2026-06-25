import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { appendSetCookie } from './session';

// A long-lived per-browser identifier used to deter the same machine from
// submitting more than one entry. NOTE: browsers do NOT expose hardware MAC
// addresses — this is the closest practical equivalent. It's bypassable
// (incognito / clearing cookies / another browser), so it deters casual
// double-entry rather than guaranteeing uniqueness. Admins can reset it.

const COOKIE = 'fifa_device';
const MAX_AGE_DAYS = 400; // ~max allowed by browsers

function readCookie(req: NextApiRequest, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Read the device id from the cookie, if present. */
export function getDeviceId(req: NextApiRequest): string | undefined {
  return readCookie(req, COOKIE);
}

/** Read the device id, creating + setting the cookie if absent. Returns the id. */
export function ensureDeviceId(req: NextApiRequest, res: NextApiResponse): string {
  const existing = getDeviceId(req);
  if (existing) return existing;
  const id = crypto.randomUUID();
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  appendSetCookie(res, `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAge}`);
  return id;
}
