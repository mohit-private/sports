import { create } from 'zustand';
import type { Picks, SessionUser, Tournament, EntryStatus, PoolMembership } from '@/lib/types';

// Draft picks are cached in localStorage so a player's in-progress bracket
// survives reloads and stays visible even before they submit. Keyed by user
// AND pool, since a player has a separate bracket in each pool they join.
const DRAFT_KEY = (uid: string, pool: string) => `fifa-draft-${uid}-${pool}`;
const ACTIVE_POOL_KEY = 'fifa-active-pool';

export function loadDraft(uid: string, pool: string): Picks {
  if (typeof window === 'undefined' || !pool) return {};
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY(uid, pool)) || '{}');
  } catch {
    return {};
  }
}
export function persistDraft(uid: string, pool: string, picks: Picks) {
  if (typeof window === 'undefined' || !pool) return;
  try {
    localStorage.setItem(DRAFT_KEY(uid, pool), JSON.stringify(picks));
  } catch {
    /* ignore quota */
  }
}

function loadActivePool(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(ACTIVE_POOL_KEY);
  } catch {
    return null;
  }
}
function saveActivePool(code: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (code) localStorage.setItem(ACTIVE_POOL_KEY, code);
    else localStorage.removeItem(ACTIVE_POOL_KEY);
  } catch {
    /* ignore */
  }
}

export interface EntryView {
  paid: boolean;          // global per-player flag
  status: EntryStatus;    // for the active pool
  unlocked: boolean;
  submittedAt: string | null;
}

/** Derive the active pool's entry view from memberships + the global paid flag. */
function computeEntry(pools: PoolMembership[], active: string | null, paid: boolean): EntryView {
  const m = pools.find((p) => p.code === active);
  return {
    paid,
    status: m?.status ?? 'draft',
    unlocked: m?.unlocked ?? false,
    submittedAt: m?.submittedAt ?? null,
  };
}

/** Pick a sensible active pool: keep the current one if still a member, else
 *  the persisted choice, else the first pool. */
function reconcileActive(pools: PoolMembership[], current: string | null): string | null {
  const codes = new Set(pools.map((p) => p.code));
  if (current && codes.has(current)) return current;
  const persisted = loadActivePool();
  if (persisted && codes.has(persisted)) return persisted;
  return pools[0]?.code ?? null;
}

interface AppState {
  user: SessionUser | null;
  paid: boolean;
  pools: PoolMembership[];
  activePool: string | null;
  activePoolMeta: PoolMembership | null;
  entry: EntryView;
  tournament: Tournament | null;
  pot: number;
  prize: number;
  currency: string;
  paidCount: number;
  submittedCount: number;
  playerCount: number;
  locked: boolean; // deadline passed
  dbEnabled: boolean;
  loadingSession: boolean;

  setUser: (user: SessionUser | null) => void;
  setMemberships: (paid: boolean, pools: PoolMembership[]) => void;
  setActivePool: (code: string | null) => void;
  /** Patch the active pool's entry state (e.g. after submit). */
  patchActiveEntry: (patch: Partial<Pick<PoolMembership, 'status' | 'unlocked' | 'submittedAt'>>) => void;
  setTournamentMeta: (p: {
    tournament: Tournament;
    pot: number;
    prize: number;
    currency: string;
    paidCount: number;
    submittedCount: number;
    playerCount: number;
    locked: boolean;
  }) => void;
  setDbEnabled: (v: boolean) => void;
  setLoadingSession: (v: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  paid: false,
  pools: [],
  activePool: null,
  activePoolMeta: null,
  entry: { paid: false, status: 'draft', unlocked: false, submittedAt: null },
  tournament: null,
  pot: 0,
  prize: 0,
  currency: 'USD',
  paidCount: 0,
  submittedCount: 0,
  playerCount: 0,
  locked: false,
  dbEnabled: false,
  loadingSession: true,

  setUser: (user) => set({ user }),

  setMemberships: (paid, pools) =>
    set((s) => {
      const activePool = reconcileActive(pools, s.activePool);
      saveActivePool(activePool);
      return {
        paid,
        pools,
        activePool,
        activePoolMeta: pools.find((p) => p.code === activePool) ?? null,
        entry: computeEntry(pools, activePool, paid),
      };
    }),

  setActivePool: (code) =>
    set((s) => {
      saveActivePool(code);
      return {
        activePool: code,
        activePoolMeta: s.pools.find((p) => p.code === code) ?? null,
        entry: computeEntry(s.pools, code, s.paid),
      };
    }),

  patchActiveEntry: (patch) =>
    set((s) => {
      const pools = s.pools.map((p) => (p.code === s.activePool ? { ...p, ...patch } : p));
      return {
        pools,
        activePoolMeta: pools.find((p) => p.code === s.activePool) ?? null,
        entry: computeEntry(pools, s.activePool, s.paid),
      };
    }),

  setTournamentMeta: ({ tournament, pot, prize, currency, paidCount, submittedCount, playerCount, locked }) =>
    set({ tournament, pot, prize, currency, paidCount, submittedCount, playerCount, locked }),
  setDbEnabled: (dbEnabled) => set({ dbEnabled }),
  setLoadingSession: (loadingSession) => set({ loadingSession }),
}));
