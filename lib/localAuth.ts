import type { SessionUser } from './types';

// Name-only sign-in — the only auth method. A player just types a name, which
// maps to a deterministic synthetic identity (`local:<slug>`). The name is the
// unique key: re-entering the same name from the same device resumes that
// bracket; a different device using a taken name is rejected, and one device
// can only ever own a single entry (both enforced in pages/api/auth/local.ts).

export class LocalAuthError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Lowercase, collapse whitespace/punctuation — stable id from a display name. */
function slug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildLocalUser(rawName: string): SessionUser {
  const name = (rawName || '').trim();
  if (!name) throw new LocalAuthError('Enter a name to join the pool.');
  if (name.length > 40) throw new LocalAuthError('Name is too long (max 40 characters).');
  const s = slug(name);
  if (!s) throw new LocalAuthError('Name must contain at least one letter or number.');
  return {
    sub: `local:${s}`,
    email: `${s}@local`,
    name,
    picture: null,
  };
}
