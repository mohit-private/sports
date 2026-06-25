import crypto from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { SessionUser } from './types';

// Stateless signed-cookie sessions. The cookie holds a base64url JSON payload
// plus an HMAC-SHA256 signature keyed by SESSION_SECRET. No server-side store.

const COOKIE = 'fifa_session';
const MAX_AGE_DAYS = 30;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  // Dev convenience: let the app run without configuring a secret.
  // Never allow this fallback in production.
  if (process.env.NODE_ENV !== 'production') return 'dev-insecure-session-secret';
  throw new Error('SESSION_SECRET is not set. Generate one with: openssl rand -hex 32');
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64url');
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function createSessionToken(user: SessionUser): string {
  const exp = Date.now() + MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const body = b64url(JSON.stringify({ ...user, exp }));
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = sign(body);
  // constant-time compare
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!data.exp || Date.now() > data.exp) return null;
    return { sub: data.sub, email: data.email, name: data.name, picture: data.picture ?? null };
  } catch {
    return null;
  }
}

/** Append a Set-Cookie without clobbering ones already queued on the response
 *  (a single handler may set both the session and device cookies). */
export function appendSetCookie(res: NextApiResponse, cookie: string) {
  const prev = res.getHeader('Set-Cookie');
  const list = Array.isArray(prev) ? prev.map(String) : prev != null ? [String(prev)] : [];
  list.push(cookie);
  res.setHeader('Set-Cookie', list);
}

function readCookie(req: NextApiRequest, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

export function getSessionUser(req: NextApiRequest): SessionUser | null {
  return verifySessionToken(readCookie(req, COOKIE));
}

export function setSessionCookie(res: NextApiResponse, token: string) {
  const maxAge = MAX_AGE_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production' ? ' Secure;' : '';
  appendSetCookie(
    res,
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAge}`
  );
}

export function clearSessionCookie(res: NextApiResponse) {
  appendSetCookie(res, `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** Helper for API routes: returns the user or writes a 401 and returns null. */
export function requireUser(req: NextApiRequest, res: NextApiResponse): SessionUser | null {
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Not signed in.' });
    return null;
  }
  return user;
}
