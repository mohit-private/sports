import { useState } from 'react';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/clientApi';

/** Fetch a pool's pot/fee/currency/counts and push into the store. Pass null
 *  for the global (no-pool) payload. */
export async function refreshPoolMeta(code: string | null) {
  const t = await api.tournament(code);
  if (!t?.tournament) return;
  useAppStore.getState().setTournamentMeta({
    tournament: t.tournament,
    pot: t.prize || 0,
    prize: t.prize || 0,
    currency: t.currency || 'USD',
    paidCount: t.paidCount || 0,
    submittedCount: t.submittedCount || 0,
    playerCount: t.playerCount || 0,
    locked: !!t.locked,
  });
}

/** Join a pool by code, then refresh memberships + make it the active pool. */
export async function joinAndRefresh(code: string) {
  const { pool } = await api.joinPool(code);
  const me = await api.me();
  useAppStore.getState().setMemberships(!!me.paid, me.pools || []);
  useAppStore.getState().setActivePool(pool.code);
  await refreshPoolMeta(pool.code);
  return pool;
}

/** Header control: switch the active pool and join more. Renders nothing until
 *  the player has joined at least one pool (the play page handles first join). */
export function PoolSwitcher() {
  const { pools, activePool, setActivePool } = useAppStore();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!pools.length) return null;

  async function onSwitch(next: string) {
    setActivePool(next);
    try {
      await refreshPoolMeta(next);
    } catch {
      /* ignore */
    }
  }

  async function onJoin(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !code.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      await joinAndRefresh(code.trim().toUpperCase());
      setCode('');
      setAdding(false);
    } catch (e: any) {
      setErr(e.message || 'Could not join');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-white/70 sm:inline">🎟️</span>
      <select
        value={activePool ?? ''}
        onChange={(e) => onSwitch(e.target.value)}
        className="max-w-[10rem] rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 text-sm font-semibold text-white outline-none [&>option]:text-slate-900"
        title="Active pool"
      >
        {pools.map((p) => (
          <option key={p.code} value={p.code}>
            {p.name}
          </option>
        ))}
      </select>

      {adding ? (
        <form onSubmit={onJoin} className="flex items-center gap-1">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            maxLength={20}
            autoFocus
            className="w-24 rounded-lg border border-white/30 bg-white/10 px-2 py-1.5 text-sm font-semibold tracking-widest text-white placeholder-white/50 outline-none"
          />
          <button
            type="submit"
            disabled={busy || !code.trim()}
            className="rounded-lg bg-amber-400 px-2 py-1.5 text-sm font-bold text-emerald-950 disabled:opacity-50"
          >
            {busy ? '…' : 'Join'}
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setErr(null); }}
            className="rounded-lg px-1.5 py-1.5 text-sm text-white/70 hover:text-white"
            aria-label="Cancel"
          >
            ✕
          </button>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="rounded-lg border border-white/30 px-2 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/15"
          title="Join another pool"
        >
          ＋
        </button>
      )}
      {err && <span className="text-xs text-amber-200">{err}</span>}
    </div>
  );
}
