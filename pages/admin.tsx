import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Bracket } from '@/components/Bracket';
import { adminApi } from '@/lib/clientApi';
import { CURRENCIES, formatMoney } from '@/lib/currency';
import { buildBracket, prunePicks, predictedWinnersByRound } from '@/lib/bracket';
import type { Tournament, Results, RoundId, Picks } from '@/lib/types';

// Map saved Results (per-round winner sets) back onto bracket slots, so the
// chart shows what's already been entered. Walks the bracket round by round:
// each match whose winner appears in that round's result set gets selected.
function resultsToPicks(t: Tournament, results: Results): Picks {
  let picks: Picks = {};
  for (let pass = 0; pass < 8; pass++) {
    const b = buildBracket(t, picks);
    const rounds: [RoundId, { slot: string; a: string | null; b: string | null; winner: string | null }[]][] = [
      ['R32', b.R32], ['R16', b.R16], ['QF', b.QF], ['SF', b.SF], ['FINAL', [b.FINAL]], ['THIRD', [b.THIRD]],
    ];
    let changed = false;
    for (const [rid, matches] of rounds) {
      const set = new Set((results[rid] || []).filter(Boolean));
      for (const m of matches) {
        if (m.winner) continue;
        const w = [m.a, m.b].find((x) => x && set.has(x));
        if (w) { picks[m.slot] = w; changed = true; }
      }
    }
    picks = prunePicks(t, picks);
    if (!changed) break;
  }
  // Restore entered scorelines onto the chart (oriented to each match's a/b).
  if (results.scores) {
    const b = buildBracket(t, picks);
    for (const m of [...b.R16, ...b.QF, ...b.SF, b.FINAL, b.THIRD]) {
      const real = m.winner ? results.scores[`${m.round}:${m.winner}`] : undefined;
      if (!real) continue;
      const [wg, og] = real;
      picks[`sc-${m.slot}-a`] = String(m.winner === m.a ? wg : og);
      picks[`sc-${m.slot}-b`] = String(m.winner === m.a ? og : wg);
    }
  }
  return picks;
}

/** The 32 group qualifiers = every team seeded into the finalized Round of 32. */
function groupQualifiers(t: Tournament): string[] {
  const codes = new Set<string>();
  for (const m of t.knockout?.r32 || []) {
    if (m.a) codes.add(m.a);
    if (m.b) codes.add(m.b);
  }
  return Array.from(codes);
}

const PW_KEY = 'fifa-admin-pw';

export default function Admin() {
  const [pw, setPw] = useState('');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'players' | 'pools' | 'finalize' | 'results' | 'settings'>('players');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem(PW_KEY);
    if (saved) {
      setPw(saved);
      setAuthed(true);
    }
  }, []);

  async function login() {
    setErr(null);
    try {
      await adminApi.pools(pw); // probe (pool-agnostic)
      sessionStorage.setItem(PW_KEY, pw);
      setAuthed(true);
    } catch (e: any) {
      setErr(e.message || 'Wrong password');
    }
  }

  if (!authed) {
    return (
      <Layout>
        <div className="card mx-auto max-w-sm p-8">
          <div className="text-center text-4xl">🛠️</div>
          <h1 className="mt-2 text-center text-xl font-bold">Admin panel</h1>
          <p className="mt-1 text-center text-sm text-slate-500">Enter the admin password.</p>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="ADMIN_PASSWORD"
            className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          />
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button onClick={login} className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white">
            Unlock
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">Admin</h1>
          <button
            onClick={() => {
              sessionStorage.removeItem(PW_KEY);
              setAuthed(false);
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700"
          >
            Lock panel
          </button>
        </div>
        <div className="card flex gap-1 overflow-x-auto p-1">
          {(['players', 'pools', 'finalize', 'results', 'settings'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium capitalize ${
                tab === t ? 'bg-emerald-600 text-white' : 'hover:bg-black/5 dark:hover:bg-white/10'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'players' && <PlayersTab pw={pw} />}
        {tab === 'pools' && <PoolsTab pw={pw} />}
        {tab === 'finalize' && <FinalizeTab pw={pw} />}
        {tab === 'results' && <ResultsTab pw={pw} />}
        {tab === 'settings' && <SettingsTab pw={pw} />}
      </div>
    </Layout>
  );
}

function PlayersTab({ pw }: { pw: string }) {
  const [players, setPlayers] = useState<any[]>([]);
  const [pools, setPools] = useState<{ code: string; name: string }[]>([]);
  const [pool, setPool] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Load the pool list first; the roster is scoped to one pool.
  useEffect(() => {
    (async () => {
      try {
        const d = await adminApi.pools(pw);
        const list = d.pools || [];
        setPools(list);
        if (list.length) setPool((cur) => cur || list[0].code);
      } catch (e: any) {
        setErr(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    if (!pool) return;
    try {
      const d = await adminApi.players(pw, pool);
      setPlayers(d.players || []);
    } catch (e: any) {
      setErr(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  async function del(p: any) {
    if (!confirm(`Delete "${p.name}" and their picks from this pool? This can't be undone.`)) return;
    setBusy(true);
    try {
      await adminApi.playerAction(pw, 'delete', p.userId, false, pool);
      await load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 text-sm text-slate-500 dark:border-slate-800">
        <span>Pick contents are never shown here — only submission status and scores. You can remove a player and their picks from this pool.</span>
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase">Pool</span>
          <select
            value={pool}
            onChange={(e) => setPool(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {pools.map((p) => (
              <option key={p.code} value={p.code}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>
      {err && <div className="p-4 text-sm text-red-600">{err}</div>}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
          <tr>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3 text-center">Bracket</th>
            <th className="px-4 py-3 text-center">Score</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.userId} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-4 py-3">
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-slate-500">{p.email}</div>
              </td>
              <td className="px-4 py-3 text-center">
                {p.status === 'submitted' ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">submitted</span>
                ) : p.hasPicks ? (
                  <span className="text-xs text-amber-500">draft</span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-center font-bold">{p.score}</td>
              <td className="px-4 py-3 text-right">
                <button
                  disabled={busy}
                  onClick={() => del(p)}
                  className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 disabled:opacity-50 dark:border-red-700/60 dark:text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {players.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-10 text-center text-slate-500">No players yet.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function ResultsTab({ pw }: { pw: string }) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [picks, setPicks] = useState<Picks>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, r] = await Promise.all([adminApi.getSettings(pw), adminApi.getResults(pw)]);
        setTournament(s.tournament);
        setPicks(resultsToPicks(s.tournament, r.results || {}));
      } catch (e: any) {
        setMsg(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Click an actual winner on the chart; clicking the selected team again clears it.
  function onPick(slot: string, code: string) {
    if (!tournament) return;
    setPicks((prev) => {
      const draft = { ...prev };
      if (code) draft[slot] = code;
      else delete draft[slot];
      return prunePicks(tournament, draft);
    });
  }

  // Enter the actual scoreline (excl. penalties) of a match.
  function onScore(slot: string, side: 'a' | 'b', goals: number | null) {
    if (!tournament) return;
    setPicks((prev) => {
      const key = `sc-${slot}-${side}`;
      const draft = { ...prev };
      if (goals == null) delete draft[key];
      else draft[key] = String(goals);
      return prunePicks(tournament, draft);
    });
  }

  async function save() {
    if (!tournament) return;
    setSaving(true);
    setMsg(null);
    try {
      const won = predictedWinnersByRound(tournament, picks);
      // Derive actual scorelines from the chart: for each decided knockout match
      // with a scoreline entered, record [winner goals, opponent goals].
      const b = buildBracket(tournament, picks);
      const knockout = [...b.R16, ...b.QF, ...b.SF, b.FINAL, b.THIRD];
      const scores: Record<string, [number, number]> = {};
      for (const m of knockout) {
        if (!m.winner || m.scoreA == null || m.scoreB == null) continue;
        const wg = m.winner === m.a ? m.scoreA : m.scoreB;
        const og = m.winner === m.a ? m.scoreB : m.scoreA;
        scores[`${m.round}:${m.winner}`] = [wg, og];
      }
      // GROUP qualifiers come from the finalized Round of 32, not the chart.
      const results: Results = {
        GROUP: groupQualifiers(tournament),
        R32: won.R32, R16: won.R16, QF: won.QF, SF: won.SF, FINAL: won.FINAL, THIRD: won.THIRD,
        scores,
      };
      await adminApi.putResults(pw, results);
      setMsg('✓ Results saved — everyone’s standings recalculated.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!tournament) return <div className="card p-6 text-slate-400">Loading…</div>;

  if (tournament.phase !== 'knockout') {
    return (
      <div className="card p-6 text-center text-slate-500">
        <div className="text-3xl">🔒⚽</div>
        <h3 className="mt-2 text-lg font-bold text-slate-700 dark:text-slate-200">Finalize the groups first</h3>
        <p className="mx-auto mt-1 max-w-md text-sm">
          Set the real group standings on the <strong>Finalize</strong> tab. That seeds the Round of
          32 — then enter knockout results here by tapping winners on the bracket, just like players do.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-slate-500">
          Tap the <strong>actual winner</strong> of each match as results come in, and (R16+) enter
          the <strong>final score</strong> excluding penalties — a draw stays a draw, tap the team
          that advanced on penalties. Standings recompute when you save.
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save results'}
          </button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </div>
      <Bracket tournament={tournament} picks={picks} onPick={onPick} onScore={onScore} showStats={false} hideGroups />
    </div>
  );
}

function SettingsTab({ pw }: { pw: string }) {
  const [t, setT] = useState<Tournament | null>(null);
  const [deadlineLocal, setDeadlineLocal] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await adminApi.getSettings(pw);
        setT(d.tournament);
        if (d.tournament.deadline) {
          const dt = new Date(d.tournament.deadline);
          // to YYYY-MM-DDTHH:mm in local time
          const off = dt.getTimezoneOffset() * 60000;
          setDeadlineLocal(new Date(dt.getTime() - off).toISOString().slice(0, 16));
        }
      } catch (e: any) {
        setMsg(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setMsg(null);
    const body: any = {};
    body.deadline = deadlineLocal ? new Date(deadlineLocal).toISOString() : null;
    try {
      const d = await adminApi.putSettings(pw, body);
      setT(d.tournament);
      setMsg('✓ Settings saved.');
    } catch (e: any) {
      setMsg(e.message);
    }
  }

  if (!t) return <div className="card p-6 text-slate-400">Loading…</div>;

  return (
    <div className="card max-w-lg space-y-4 p-6">
      <div>
        <label className="block text-sm font-semibold">Submission deadline</label>
        <p className="text-xs text-slate-500">After this, picks lock and all brackets become public.</p>
        <input
          type="datetime-local"
          value={deadlineLocal}
          onChange={(e) => setDeadlineLocal(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
        />
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        Prize is set per pool on the <strong>Pools</strong> tab. The prize splits{' '}
        <strong>{Math.round(t.payout.winner * 100)}%</strong> winner /{' '}
        <strong>{Math.round(t.payout.runnerUp * 100)}%</strong> runner-up · tie for 1st splits{' '}
        <strong>{Math.round(t.payout.drawSplit * 100)}%</strong> each.
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white">
          Save settings
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
    </div>
  );
}

interface Standing {
  first: string;
  second: string;
  third: string;
}

function FinalizeTab({ pw }: { pw: string }) {
  const [t, setT] = useState<Tournament | null>(null);
  const [phase, setPhase] = useState<string>('groups');
  const [standings, setStandings] = useState<Record<string, Standing>>({});
  const [thirds, setThirds] = useState<string[]>([]);
  const [liveGroups, setLiveGroups] = useState<any[] | null>(null);
  const [liveAt, setLiveAt] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, f] = await Promise.all([adminApi.getSettings(pw), adminApi.getFinalize(pw)]);
        setT(s.tournament);
        setPhase(f.phase);
        if (f.finalize) {
          setStandings(f.finalize.standings || {});
          setThirds(f.finalize.advancingThirds || []);
        }
      } catch (e: any) {
        setMsg(e.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!t) return <div className="card p-6 text-slate-400">Loading…</div>;

  const name = (code: string) => t.teams[code]?.name || code;

  function setPlace(groupId: string, place: keyof Standing, code: string) {
    setStandings((prev) => {
      const cur: Standing = { first: '', second: '', third: '', ...prev[groupId] };
      cur[place] = code;
      // a team can hold only one place in its group
      (['first', 'second', 'third'] as const).forEach((p) => {
        if (p !== place && cur[p] === code) cur[p] = '';
      });
      const next = { ...prev, [groupId]: cur };
      // if a third changed, drop it from the advancing set if no longer a third
      return next;
    });
  }

  // keep the advancing-thirds list consistent with the chosen thirds
  const groupThirds = t.groups.map((g) => ({ id: g.id, code: standings[g.id]?.third || '' }));
  const validThirds = new Set(groupThirds.map((x) => x.code).filter(Boolean));
  const selectedThirds = thirds.filter((c) => validThirds.has(c));

  function toggleThird(code: string) {
    setThirds((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.filter((c) => validThirds.has(c)).length >= 8) return prev; // cap at 8
      return [...prev, code];
    });
  }

  const completeGroups = t.groups.filter((g) => {
    const s = standings[g.id];
    return s && s.first && s.second && s.third;
  }).length;
  const allGroupsSet = completeGroups === t.groups.length;
  const ready = allGroupsSet && selectedThirds.length === 8;

  // Quick-fill every group's 1/2/3 by FIFA rank (best three advance as 1/2/3),
  // and pick the 8 best third-placed teams by rank. Admin can tweak before
  // finalizing — this just removes the tedium of 36 dropdowns.
  function autofillByRank() {
    const next: Record<string, Standing> = {};
    for (const g of t.groups) {
      const sorted = [...g.teams].sort((a, b) => (t.teams[a]?.rank ?? 99) - (t.teams[b]?.rank ?? 99));
      next[g.id] = { first: sorted[0], second: sorted[1], third: sorted[2] };
    }
    setStandings(next);
    // 8 best thirds by rank.
    const bestThirds = t.groups
      .map((g) => next[g.id].third)
      .sort((a, b) => (t.teams[a]?.rank ?? 99) - (t.teams[b]?.rank ?? 99))
      .slice(0, 8);
    setThirds(bestThirds);
  }

  // Pull today's real group standings from ESPN's live feed and fill the form.
  async function autofillByLiveStandings() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.liveStandings(pw);
      setStandings(r.standings || {});
      if (Array.isArray(r.advancingThirds)) setThirds(r.advancingThirds);
      setLiveGroups(Array.isArray(r.groups) ? r.groups : null);
      setLiveAt(r.fetchedAt || null);
      const when = r.fetchedAt ? new Date(r.fetchedAt).toLocaleString() : '';
      setMsg(`✓ Loaded live standings for ${r.matchedGroups}/12 groups from ${r.source} (${when}). Review the points below, then Publish or Finalize.`);
    } catch (e: any) {
      setMsg(e.message || 'Could not fetch live standings');
    } finally {
      setBusy(false);
    }
  }

  async function publishStandings() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.publishStandings(pw, standings);
      setMsg(`✓ Published current standings for ${r.published} group(s). Players can now "Autofill by current standings".`);
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.putFinalize(pw, standings, selectedThirds);
      setPhase(r.tournament.phase);
      setMsg('✓ Groups finalized — the Round of 32 is built and everyone can now pick the knockout.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    if (!confirm('Undo finalization and return to the group phase? Knockout picks stay saved.')) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi.undoFinalize(pw);
      setPhase(r.tournament.phase);
      setMsg('Reverted to the group phase.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <span className="font-bold">Phase:</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              phase === 'knockout'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            }`}
          >
            {phase === 'knockout' ? 'Knockout open' : 'Group stage'}
          </span>
        </div>
        <p className="mt-2">
          Enter each group’s real <strong>1st / 2nd / 3rd</strong>, then tick the <strong>8 best
          third-placed teams</strong> that advance. Finalizing builds the real Round of 32 (24 group
          top-2 + 8 thirds), scores the group predictions, and reopens every entry for knockout picks.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={autofillByLiveStandings}
            disabled={busy}
            className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600/60 dark:bg-amber-900/30 dark:text-amber-300"
            title="Fetch today’s real group standings from ESPN’s live feed and fill the form"
          >
            🌐 Autofill by current standings (live)
          </button>
          <button
            onClick={autofillByRank}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-black/5 dark:border-slate-700 dark:hover:bg-white/10"
          >
            ⚡ Autofill by FIFA rank
          </button>
          {phase === 'knockout' && (
            <button
              onClick={undo}
              disabled={busy}
              className="rounded-lg border border-red-400 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-300"
            >
              Undo finalization
            </button>
          )}
        </div>
      </div>

      {liveGroups && liveGroups.length > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-bold">🌐 Live ESPN standings (points)</h4>
            <span className="text-xs text-slate-500">{liveAt ? new Date(liveAt).toLocaleString() : ''}</span>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Straight from ESPN, in standing order. If a row shows a name but no flag, we couldn’t map
            it to a seed team — set that place manually below.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveGroups.map((g: any) => (
              <div key={g.id} className="rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
                <div className="mb-1 font-semibold">Group {g.id}</div>
                {(g.rows || []).map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-0.5">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-4 text-slate-400">{i + 1}</span>
                      <span className="truncate">{t.teams[r.code]?.flag || (r.code ? '' : '⚠️')} {r.name}</span>
                    </span>
                    <span className="ml-2 shrink-0 tabular-nums text-slate-500">
                      <strong className="text-slate-700 dark:text-slate-200">{r.pts}</strong> pts · {r.w}-{r.d}-{r.l} · GD {r.gd >= 0 ? '+' : ''}{r.gd}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {t.groups.map((g) => (
          <div key={g.id} className="card p-3">
            <h4 className="mb-2 font-bold">Group {g.id}</h4>
            {(['first', 'second', 'third'] as const).map((place, i) => (
              <label key={place} className="mb-1.5 flex items-center gap-2 text-sm">
                <span className="w-10 text-slate-500">{['1st', '2nd', '3rd'][i]}</span>
                <select
                  value={standings[g.id]?.[place] || ''}
                  onChange={(e) => setPlace(g.id, place, e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700"
                >
                  <option value="">—</option>
                  {g.teams.map((code) => (
                    <option key={code} value={code}>
                      {t.teams[code]?.flag} {name(code)} (#{t.teams[code]?.rank})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="font-bold">8 best third-placed teams advance</h4>
          <span className={`text-sm ${selectedThirds.length === 8 ? 'text-emerald-600' : 'text-amber-500'}`}>
            {selectedThirds.length}/8 selected
          </span>
        </div>
        {validThirds.size === 0 ? (
          <p className="text-sm text-slate-500">Set a 3rd-place team in each group first.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {groupThirds
              .filter((x) => x.code)
              .map((x) => {
                const on = selectedThirds.includes(x.code);
                return (
                  <button
                    key={x.id}
                    onClick={() => toggleThird(x.code)}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                      on ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <span className="text-lg">{t.teams[x.code]?.flag}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-[11px] text-slate-400">3rd · Grp {x.id}</span>
                      <br />
                      {name(x.code)}
                    </span>
                    {on && <span className="text-emerald-600">✓</span>}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={publishStandings}
          disabled={busy || completeGroups === 0}
          className="rounded-lg border border-emerald-500 px-5 py-2 font-semibold text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-emerald-300"
          title="Save the current standings so players can autofill by them — does NOT lock the group phase"
        >
          Publish current standings
        </button>
        <button
          onClick={finalize}
          disabled={!ready || busy}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          title={!ready ? 'Set every group’s 1/2/3 and exactly 8 advancing thirds' : 'Finalize'}
        >
          {phase === 'knockout' ? 'Re-finalize (rebuild R32)' : 'Finalize groups → build Round of 32'}
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </div>
      <p className="text-xs text-slate-400">
        “Publish current standings” lets players autofill from real results while the group phase is
        still open. “Finalize” locks the groups and builds the knockout bracket.
      </p>
    </div>
  );
}

function PoolsTab({ pw }: { pw: string }) {
  const [pools, setPools] = useState<any[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [fee, setFee] = useState('0');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    try {
      const d = await adminApi.pools(pw);
      setPools(d.pools || []);
    } catch (e: any) {
      setMsg(e.message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.createPool(pw, code, name, Number(fee) || 0, currency);
      setCode('');
      setName('');
      setFee('0');
      setCurrency('USD');
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: string) {
    if (!confirm(`Delete pool ${c}? Members keep their entries but lose this code.`)) return;
    setBusy(true);
    try {
      await adminApi.deletePool(pw, c);
      await load();
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetDevices() {
    if (!confirm('Clear ALL device locks? Every machine will be able to submit a fresh entry.')) return;
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.resetDevices(pw);
      setMsg('✓ Device locks cleared.');
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-slate-600 dark:text-slate-300">
        Create a pool, then share its <strong>code</strong> with that group. Players enter the code on
        the Play page to join — each pool has its own bracket &amp; leaderboard, so you can run several
        in parallel. Set the <strong>prize</strong> each pool plays for (0 hides all prize UI), and a
        currency.
      </div>

      <form onSubmit={create} className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500">Pool code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="OFFICE26"
            maxLength={20}
            className="mt-1 w-36 rounded-lg border border-slate-300 px-3 py-2 font-bold tracking-wide dark:border-slate-700"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Office Pool 2026"
            maxLength={40}
            className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Prize</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="mt-1 w-24 rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-1 w-28 rounded-lg border border-slate-300 px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={busy || !code.trim()}
          className="rounded-lg bg-emerald-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          Add pool
        </button>
        {msg && <span className="text-sm text-slate-500">{msg}</span>}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500 dark:bg-slate-800/60">
            <tr>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Prize</th>
              <th className="px-4 py-3 text-center">Joined</th>
              <th className="px-4 py-3 text-center">Submitted</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {pools.map((p) => (
              <PoolRow key={p.code} pw={pw} pool={p} busy={busy} onChanged={load} onRemove={remove} />
            ))}
            {pools.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-500">No pools yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">
          <strong>Device locks</strong> — one entry per machine. Clear them to allow re-entry (e.g. a
          new round, or to fix a mistaken lock).
        </div>
        <button
          onClick={resetDevices}
          disabled={busy}
          className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-700 dark:text-amber-300"
        >
          Reset device locks
        </button>
      </div>
    </div>
  );
}

function PoolRow({
  pw,
  pool,
  busy,
  onChanged,
  onRemove,
}: {
  pw: string;
  pool: any;
  busy: boolean;
  onChanged: () => void;
  onRemove: (code: string) => void;
}) {
  const [fee, setFee] = useState(String(pool.fee ?? 0));
  const [currency, setCurrency] = useState(pool.currency || 'USD');
  const [saving, setSaving] = useState(false);
  const dirty = Number(fee) !== Number(pool.fee ?? 0) || currency !== (pool.currency || 'USD');
  const potCurrency = pool.currency || 'USD';

  async function save() {
    setSaving(true);
    try {
      await adminApi.updatePool(pw, pool.code, { fee: Number(fee) || 0, currency });
      await onChanged();
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <td className="px-4 py-3 font-bold tracking-wide">{pool.code}</td>
      <td className="px-4 py-3">{pool.name}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={0}
            step="0.01"
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            className="w-20 rounded-lg border border-slate-300 px-2 py-1 dark:border-slate-700"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-lg border border-slate-300 px-1 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.code}</option>
            ))}
          </select>
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {saving ? '…' : 'Save'}
            </button>
          )}
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">{Number(pool.fee) > 0 ? `${formatMoney(Number(pool.fee), potCurrency)} prize` : 'no prize'}</div>
      </td>
      <td className="px-4 py-3 text-center">{pool.memberCount}</td>
      <td className="px-4 py-3 text-center">{pool.submittedCount}</td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={() => onRemove(pool.code)}
          disabled={busy}
          className="rounded-full border border-red-300 px-3 py-1 text-xs font-semibold text-red-600 dark:border-red-700/60 dark:text-red-300"
        >
          Delete
        </button>
      </td>
    </tr>
  );
}
