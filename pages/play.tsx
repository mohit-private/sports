import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Layout } from '@/components/Layout';
import { PageHero } from '@/components/PageHero';
import { Bracket } from '@/components/Bracket';
import { LiveStandings } from '@/components/LiveStandings';
import { SignIn } from '@/components/SignIn';
import { AddDevice } from '@/components/AddDevice';
import { PotBanner } from '@/components/PotBanner';
import { joinAndRefresh } from '@/components/PoolSwitcher';
import { useAppStore, loadDraft, persistDraft } from '@/store/appStore';
import { api } from '@/lib/clientApi';
import { prunePicks, phaseProgress, isComplete, buildBracket } from '@/lib/bracket';
import type { Picks } from '@/lib/types';

export default function Play() {
  const router = useRouter();
  const {
    user, setUser, entry, patchActiveEntry, tournament, prize, currency,
    pools, activePool, activePoolMeta, locked, dbEnabled, loadingSession,
  } = useAppStore();
  const [picks, setPicks] = useState<Picks>({});
  const urlCode = typeof router.query.code === 'string' ? router.query.code.toUpperCase() : '';
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Editable right up to the deadline - a submitted bracket can still be changed
  // and re-submitted until then (the picks API enforces the same rule).
  const editable = !!user && !locked;
  const poolPrize = activePoolMeta?.fee ?? prize;

  // Hydrate picks for the active pool: prefer server (DB), fall back to local draft.
  useEffect(() => {
    if (!user || !tournament || (dbEnabled && !activePool)) return;
    let alive = true;
    setHydrated(false);
    (async () => {
      const cacheKey = activePool || 'local';
      let initial: Picks = loadDraft(user.sub, cacheKey);
      if (dbEnabled && activePool) {
        try {
          const r = await api.getPicks(activePool);
          if (r?.picks && Object.keys(r.picks).length) initial = r.picks;
        } catch {
          /* keep local */
        }
      }
      if (!alive) return;
      // The Round of 32 is seeded from the player's group picks (or FIFA rank as
      // a fallback); knockout winners are NOT pre-filled - the player picks them.
      const pruned = prunePicks(tournament, initial);
      setPicks(pruned);
      persistDraft(user.sub, cacheKey, pruned);
      setHydrated(true);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tournament, activePool]);

  // Auto-join from ?code=POOL in URL — fires once the user is signed in and
  // only if they haven't joined any pool yet.
  useEffect(() => {
    if (!user || !dbEnabled || pools.length > 0 || !urlCode || joining) return;
    setJoining(true);
    joinAndRefresh(urlCode)
      .catch((err: any) => setJoinErr(err.message || 'Could not join pool'))
      .finally(() => setJoining(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dbEnabled, pools.length, urlCode]);

  function onPick(slot: string, teamCode: string) {
    if (!editable || !tournament || !user) return;
    setPicks((prev) => {
      const draft = { ...prev };
      if (teamCode) draft[slot] = teamCode;
      else delete draft[slot]; // empty code clears the slot
      const next = prunePicks(tournament, draft);
      persistDraft(user.sub, activePool || 'local', next);
      scheduleSave(next);
      return next;
    });
  }

  // Set a predicted scoreline goal for one side of a knockout match (R16+).
  function onScore(slot: string, side: 'a' | 'b', goals: number | null) {
    if (!editable || !tournament || !user) return;
    setPicks((prev) => {
      const key = `sc-${slot}-${side}`;
      const draft = { ...prev };
      if (goals == null) delete draft[key];
      else draft[key] = String(goals);
      const next = prunePicks(tournament, draft);
      persistDraft(user.sub, activePool || 'local', next);
      scheduleSave(next);
      return next;
    });
  }

  // Reorder a group (drag) → set its top 3, which reseeds the Round of 32.
  function setGroupOrder(groupId: string, top3: string[]) {
    if (!editable || !tournament || !user) return;
    setPicks((prev) => {
      const draft = {
        ...prev,
        [`g-${groupId}-1`]: top3[0],
        [`g-${groupId}-2`]: top3[1],
        [`g-${groupId}-3`]: top3[2],
      };
      const next = prunePicks(tournament, draft);
      persistDraft(user.sub, activePool || 'local', next);
      scheduleSave(next);
      return next;
    });
  }

  function scheduleSave(next: Picks) {
    if (!dbEnabled || !activePool) return; // local-only mode: localStorage already holds it
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        await api.saveDraft(activePool, next);
        setSaving('saved');
        setTimeout(() => setSaving('idle'), 1500);
      } catch {
        setSaving('error');
      }
    }, 700);
  }

  async function submit() {
    if (!tournament || !activePool) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await api.submitPicks(activePool, picks);
      patchActiveEntry({ status: 'submitted', unlocked: false, submittedAt: new Date().toISOString() });
      setConfirmOpen(false);
      setMsg('🔒 Bracket submitted. You can still edit it until the deadline.');
    } catch (e: any) {
      setMsg(e.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function joinPool(e: React.FormEvent) {
    e.preventDefault();
    if (joining) return;
    setJoinErr(null);
    setJoining(true);
    try {
      await joinAndRefresh(joinCode.trim().toUpperCase());
    } catch (err: any) {
      setJoinErr(err.message || 'Could not join');
    } finally {
      setJoining(false);
    }
  }

  if (loadingSession) {
    return (
      <Layout>
        <div className="py-20 text-center text-slate-400">Loading…</div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="card mx-auto max-w-md p-8 text-center">
          <div className="text-4xl">🔐</div>
          <h1 className="mt-2 text-xl font-bold">Sign in to play</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your name to fill your bracket.</p>
          <div className="mt-5 flex justify-center">
            <SignIn onSignedIn={setUser} />
          </div>
        </div>
      </Layout>
    );
  }

  // Joined-a-pool gate (DB mode only). Players must join at least one pool first.
  if (dbEnabled && pools.length === 0) {
    return (
      <Layout>
        <div className="card mx-auto max-w-md p-8 text-center">
          <div className="text-4xl">🎟️</div>
          <h1 className="mt-2 text-xl font-bold">Join your pool</h1>
          <p className="mt-1 text-sm text-slate-500">
            Enter the pool code your organizer gave you. You can join more pools later - each has its
            own bracket.
          </p>
          {joining && <p className="mt-4 text-sm text-emerald-600">Joining pool…</p>}
          <form onSubmit={joinPool} className="mt-5 flex flex-col items-center gap-2">
            <input
              value={joinCode || urlCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="POOL CODE"
              maxLength={20}
              autoFocus
              className="w-56 rounded-xl border border-slate-300 px-4 py-3 text-center font-bold tracking-widest outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700"
            />
            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="w-56 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {joining ? 'Joining…' : 'Join pool'}
            </button>
            {joinErr && <p className="text-sm text-red-600">{joinErr}</p>}
          </form>
        </div>
      </Layout>
    );
  }

  const prog = tournament ? phaseProgress(tournament, picks) : { count: 0, total: 0 };
  const complete = tournament ? isComplete(tournament, picks) : false;
  const isKnockout = tournament?.phase === 'knockout';
  const canSubmit = editable;

  // Count R16+ matches where a winner is picked but score is missing.
  const missingScores = (() => {
    if (!tournament || !isKnockout) return 0;
    const b = buildBracket(tournament, picks);
    const scoreRoundIds = new Set(
      tournament.rounds.filter((r) => (r.scorePoints || 0) > 0).map((r) => r.id)
    );
    const matches = [
      ...(scoreRoundIds.has('R16') ? b.R16 : []),
      ...(scoreRoundIds.has('QF') ? b.QF : []),
      ...(scoreRoundIds.has('SF') ? b.SF : []),
      ...(scoreRoundIds.has('FINAL') ? [b.FINAL] : []),
      ...(scoreRoundIds.has('THIRD') ? [b.THIRD] : []),
    ];
    return matches.filter((m) => m.winner != null && (m.scoreA == null || m.scoreB == null)).length;
  })();
  const pct = prog.total ? Math.round((prog.count / prog.total) * 100) : 0;
  const phaseLabel = 'picks made';
  const submitLabel = isKnockout ? 'Submit bracket' : 'Save group picks';
  const flags = tournament
    ? Object.fromEntries(Object.values(tournament.teams).map((tm) => [tm.code, tm.flag]))
    : {};

  return (
    <Layout>
      <div className="space-y-5">
        <PageHero
          emoji="⚽"
          title={tournament?.phase === 'knockout' ? 'Your Knockout Bracket' : 'Your Group Predictions'}
          subtitle={
            tournament?.phase === 'knockout'
              ? 'Pick a winner through every round to the champion in the centre.'
              : 'Group predictions are just for fun (no points) and totally optional - predict what you like. Scoring starts when the knockout bracket unlocks.'
          }
        >
          {activePoolMeta?.name && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              🎟️ Pool: {activePoolMeta.name}
            </span>
          )}
        </PageHero>
        <PotBanner tournament={tournament} />
        <AddDevice />
        {tournament?.phase !== 'knockout' && <LiveStandings flags={flags} />}

        {/* Status notices */}
        {locked && (
          <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700/50 dark:bg-red-900/30 dark:text-red-200">
            🔒 The deadline has passed. Brackets are locked and now visible to everyone on the All Picks page.
          </div>
        )}
        {!locked && entry.status === 'submitted' && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-200">
            ✅ Your bracket is submitted. You can keep editing and re-submit until the deadline.
          </div>
        )}
        {msg && (
          <div className="rounded-xl border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
            {msg}
          </div>
        )}

        {/* Progress + actions bar */}
        <div className="card sticky top-[60px] z-20 flex flex-wrap items-center gap-3 p-3">
          <div className="flex-1 min-w-[180px]">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{prog.count}/{prog.total} {phaseLabel}</span>
              <span>
                {saving === 'saving' && '💾 Saving…'}
                {saving === 'saved' && '✓ Saved'}
                {saving === 'error' && '⚠️ Save failed'}
                {!dbEnabled && saving === 'idle' && 'Saved locally'}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={!canSubmit}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white shadow-sm transition enabled:hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            title={!editable ? 'Locked' : 'Submit'}
          >
            {entry.status === 'submitted' ? (isKnockout ? 'Update bracket' : 'Update picks') : submitLabel}
          </button>
        </div>

        {!hydrated || !tournament ? (
          <div className="py-20 text-center text-slate-400">Loading bracket…</div>
        ) : (
          <Bracket tournament={tournament} picks={picks} onPick={onPick} onScore={onScore} onSetGroupOrder={setGroupOrder} readOnly={!editable} hideGroups={locked} />
        )}
      </div>

      {/* Confirm submit modal */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="card w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">{entry.status === 'submitted' ? 'Update your bracket?' : 'Submit your bracket?'}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Your picks are saved and you'll be counted as submitted. You can keep changing them and
              re-submit any time <strong>until the deadline</strong>, when everything locks.
            </p>
            {!complete && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-200">
                ⚠️ {prog.total - prog.count} pick{prog.total - prog.count === 1 ? '' : 's'} missing - empty slots will count as no pick.
              </div>
            )}
            {missingScores > 0 && (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-900/30 dark:text-amber-200">
                🎯 {missingScores} score prediction{missingScores === 1 ? '' : 's'} missing - you won't earn the +2 bonus for those matches.
              </div>
            )}
            {msg && <p className="mt-2 text-sm text-red-600">{msg}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Submitting…' : entry.status === 'submitted' ? 'Update' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
