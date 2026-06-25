import crypto from 'crypto';

// A rotating 6-digit code (TOTP-style) shown on an already-linked device so the
// owner can add a new device to their entry. Stateless: derived from the
// player's secret + the current time window, so nothing needs storing.

const PERIOD_S = 60; // code changes every 60s
const PERIOD_MS = PERIOD_S * 1000;

/** The 6-digit code for a secret at time `t`. */
export function deviceCode(secret: string, t: number = Date.now()): string {
  const counter = Math.floor(t / 1000 / PERIOD_S);
  const h = crypto.createHmac('sha256', secret).update(String(counter)).digest();
  const num = h.readUInt32BE(0) % 1_000_000;
  return String(num).padStart(6, '0');
}

/** Accept the current window plus ±1 (clock skew + the time it takes to type). */
export function verifyDeviceCode(secret: string, code: string, t: number = Date.now()): boolean {
  const c = (code || '').trim();
  if (!/^\d{6}$/.test(c)) return false;
  for (const d of [0, -1, 1]) {
    if (deviceCode(secret, t + d * PERIOD_MS) === c) return true;
  }
  return false;
}

/** Milliseconds until the current code rolls over (for the countdown UI). */
export function codeExpiresInMs(t: number = Date.now()): number {
  return PERIOD_MS - (t % PERIOD_MS);
}

/** A fresh random secret for a newly-claimed player. */
export function newLinkSecret(): string {
  return crypto.randomBytes(24).toString('hex');
}
