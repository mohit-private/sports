// Thin browser-side fetch helpers. All return parsed JSON or throw on !ok.
import type { Picks } from './types';

// Returns parsed JSON (typed `any` so call sites stay ergonomic) or throws on !ok.
async function json(res: Response): Promise<any> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data;
}

const q = (pool?: string | null) => (pool ? `?pool=${encodeURIComponent(pool)}` : '');

export const api = {
  me: () => fetch('/api/me').then(json),
  // Pot/counts are per-pool; pass the active pool (omit for the global teams payload).
  tournament: (pool?: string | null) => fetch(`/api/tournament${q(pool)}`).then(json),
  // Returns the raw body (incl. `needsVerification`) rather than throwing, so the
  // sign-in UI can branch into the device-linking code step.
  loginLocal: async (name: string, code?: string): Promise<any> => {
    const r = await fetch('/api/auth/local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, code }),
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, ...data };
  },
  linkCode: () => fetch('/api/link-code').then(json),
  logout: () => fetch('/api/auth/logout', { method: 'POST' }).then(json),
  getPicks: (pool: string) => fetch(`/api/picks${q(pool)}`).then(json),
  saveDraft: (pool: string, picks: Picks) =>
    fetch('/api/picks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool, picks }),
    }).then(json),
  submitPicks: (pool: string, picks: Picks) =>
    fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool, picks }),
    }).then(json),
  leaderboard: (pool: string) => fetch(`/api/leaderboard${q(pool)}`).then(json),
  allPicks: (pool: string) => fetch(`/api/all-picks${q(pool)}`).then(json),
  standings: () => fetch('/api/standings').then(json),
  joinPool: (code: string) =>
    fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    }).then(json),
};

// Admin calls carry the password in a header (kept in sessionStorage by the UI).
function adminHeaders(pw: string) {
  return { 'Content-Type': 'application/json', 'X-Admin-Password': pw };
}
export const adminApi = {
  players: (pw: string, pool: string) =>
    fetch(`/api/admin/players?pool=${encodeURIComponent(pool)}`, { headers: adminHeaders(pw) }).then(json),
  playerAction: (
    pw: string,
    action: 'paid' | 'unlock' | 'delete',
    userId: string,
    value: boolean,
    pool?: string
  ) =>
    fetch('/api/admin/players', {
      method: 'POST',
      headers: adminHeaders(pw),
      body: JSON.stringify({ action, userId, value, pool }),
    }).then(json),
  getResults: (pw: string) => fetch('/api/admin/results', { headers: adminHeaders(pw) }).then(json),
  putResults: (pw: string, results: any) =>
    fetch('/api/admin/results', {
      method: 'PUT',
      headers: adminHeaders(pw),
      body: JSON.stringify({ results }),
    }).then(json),
  getSettings: (pw: string) => fetch('/api/admin/settings', { headers: adminHeaders(pw) }).then(json),
  putSettings: (pw: string, body: any) =>
    fetch('/api/admin/settings', {
      method: 'PUT',
      headers: adminHeaders(pw),
      body: JSON.stringify(body),
    }).then(json),
  getFinalize: (pw: string) => fetch('/api/admin/finalize', { headers: adminHeaders(pw) }).then(json),
  putFinalize: (pw: string, standings: any, advancingThirds: string[]) =>
    fetch('/api/admin/finalize', {
      method: 'PUT',
      headers: adminHeaders(pw),
      body: JSON.stringify({ standings, advancingThirds }),
    }).then(json),
  undoFinalize: (pw: string) =>
    fetch('/api/admin/finalize', { method: 'DELETE', headers: adminHeaders(pw) }).then(json),
  publishStandings: (pw: string, standings: any) =>
    fetch('/api/admin/finalize', {
      method: 'PUT',
      headers: adminHeaders(pw),
      body: JSON.stringify({ standings, publishOnly: true }),
    }).then(json),
  liveStandings: (pw: string) =>
    fetch('/api/admin/standings-live', { headers: adminHeaders(pw) }).then(json),
  pools: (pw: string) => fetch('/api/admin/pools', { headers: adminHeaders(pw) }).then(json),
  createPool: (pw: string, code: string, name: string, fee: number, currency: string) =>
    fetch('/api/admin/pools', {
      method: 'POST',
      headers: adminHeaders(pw),
      body: JSON.stringify({ code, name, fee, currency }),
    }).then(json),
  updatePool: (pw: string, code: string, patch: { name?: string; fee?: number; currency?: string }) =>
    fetch('/api/admin/pools', {
      method: 'PUT',
      headers: adminHeaders(pw),
      body: JSON.stringify({ code, ...patch }),
    }).then(json),
  deletePool: (pw: string, code: string) =>
    fetch('/api/admin/pools', { method: 'DELETE', headers: adminHeaders(pw), body: JSON.stringify({ code }) }).then(json),
  resetDevices: (pw: string) =>
    fetch('/api/admin/reset-devices', { method: 'POST', headers: adminHeaders(pw) }).then(json),
};
