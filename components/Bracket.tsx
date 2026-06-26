import { useEffect, useMemo, useState } from 'react';
import type { Tournament, Picks, Results, RoundId } from '@/lib/types';
import { buildBracket, DerivedMatch } from '@/lib/bracket';
import { suggestion } from '@/lib/insights';
import { api } from '@/lib/clientApi';
import { TeamButton } from './TeamButton';
import { Groups } from './Groups';

/** Group ids whose real standings are LOCKED from the live ESPN source: every
 *  team in the group has played all its group matches, so the qualifiers and
 *  their finishing order can no longer change. (A 4-team group = 3 matches
 *  each.) Pure + client-safe — operates on the shape /api/standings returns. */
function finalizedGroupIds(standings: { id: string; rows: { played: number }[] }[]): string[] {
  return standings
    .filter((g) => g.rows.length >= 2 && g.rows.every((r) => r.played >= g.rows.length - 1))
    .map((g) => g.id);
}

// The full prediction surface: the group stage (pick the top 2 of each group)
// followed by the knockout bracket, drawn as a real left-to-right tree. The
// group top 2 are seeded automatically into the Round of 16.
export function Bracket({
  tournament,
  picks,
  onPick,
  onScore,
  readOnly,
  results,
  showStats = true,
  hideGroups = false,
  hideKnockout = false,
  onSetGroupOrder,
}: {
  tournament: Tournament;
  picks: Picks;
  onPick?: (slot: string, teamCode: string) => void;
  onScore?: (slot: string, side: 'a' | 'b', goals: number | null) => void;
  readOnly?: boolean;
  results?: Results;
  showStats?: boolean;
  hideGroups?: boolean;
  hideKnockout?: boolean;
  onSetGroupOrder?: (groupId: string, top3: string[]) => void;
}) {
  const bracket = useMemo(() => buildBracket(tournament, picks), [tournament, picks]);
  const teamOf = (code: string | null) => (code ? tournament.teams[code] || null : null);

  // Which groups are finalized, straight from the live ESPN standings. We poll
  // /api/standings (cached server-side) once on mount; on any failure the strip
  // simply doesn't render. Order chips by the tournament's own group order.
  const [finalized, setFinalized] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    api
      .standings()
      .then((d: any) => alive && setFinalized(finalizedGroupIds(d.groups || [])))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const finalizedGroups = useMemo(() => {
    const done = new Set(finalized);
    return tournament.groups.filter((g) => done.has(g.id)).map((g) => g.id);
  }, [finalized, tournament.groups]);
  const pointsByRound = useMemo(
    () => Object.fromEntries(tournament.rounds.map((r) => [r.id, r.points])),
    [tournament.rounds]
  );
  const scorePointsByRound = useMemo(
    () => Object.fromEntries(tournament.rounds.map((r) => [r.id, r.scorePoints || 0])),
    [tournament.rounds]
  );

  function outcome(round: RoundId, code: string | null): 'win' | undefined {
    if (!results || !code) return undefined;
    const arr = results[round];
    if (!arr || arr.length === 0) return undefined;
    return arr.includes(code) ? 'win' : undefined;
  }

  function renderMatch(m: DerivedMatch, roundId: RoundId) {
    const a = teamOf(m.a);
    const b = teamOf(m.b);
    const sugg = a && b ? suggestion(a, b) : null;
    const pick = (code: string | null) => {
      if (readOnly || !code || !onPick) return;
      // clicking the already-selected winner deselects it
      onPick(m.slot, m.winner === code ? '' : code);
    };
    // Has this round been decided (results entered)? Then mark the player's pick
    // correct/wrong and show the points earned for it.
    const roundResults = results?.[roundId] || [];
    const decided = roundResults.length > 0 && !!m.winner;
    const correct = decided && roundResults.includes(m.winner!);
    const pts = pointsByRound[roundId] || 0;

    // Exact-score prediction: R16 onward, once both teams in the match are known.
    const sp = scorePointsByRound[roundId] || 0;
    const scored = sp > 0 && !!m.a && !!m.b;
    const real = m.winner ? results?.scores?.[`${roundId}:${m.winner}`] : undefined;
    const predWinnerGoals = m.winner === m.a ? m.scoreA : m.scoreB;
    const predOppGoals = m.winner === m.a ? m.scoreB : m.scoreA;
    const scoreHit =
      correct && real && predWinnerGoals != null && predOppGoals != null &&
      real[0] === predWinnerGoals && real[1] === predOppGoals;

    // Goal box shown inline on each team's row. While editing it appears once a
    // winner is selected (enter the scoreline, excl. penalties). In read-only /
    // results view it just shows the predicted number.
    const editingScore = scored && !readOnly && !!onScore && !!m.winner;
    function goalCell(side: 'a' | 'b', val: number | null) {
      if (editingScore) {
        return (
          <input
            type="number"
            min={0}
            max={99}
            inputMode="numeric"
            aria-label="goals"
            value={val ?? ''}
            onChange={(e) => {
              const raw = e.target.value;
              onScore!(m.slot, side, raw === '' ? null : Math.max(0, Math.min(99, parseInt(raw, 10) || 0)));
            }}
            className="w-9 shrink-0 rounded border border-slate-300 px-1 py-1 text-center text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        );
      }
      if (scored && readOnly && (m.scoreA != null || m.scoreB != null)) {
        return <span className="w-6 shrink-0 text-center text-sm font-bold text-slate-600 dark:text-slate-300">{val ?? '–'}</span>;
      }
      return null;
    }

    const teamRow = (team: typeof a, code: string | null, side: 'a' | 'b', val: number | null) => (
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <TeamButton
            team={team}
            selected={m.winner === code && !!code}
            favored={!!sugg && sugg.favorite === team?.code}
            disabled={readOnly || !code}
            showStats={showStats}
            onClick={() => pick(code)}
            result={outcome(roundId, code)}
          />
        </div>
        {goalCell(side, val)}
      </div>
    );

    const matchDate = m.date
      ? new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
      : null;

    return (
      <div key={m.slot} className="bkt-match">
        <div className={`card space-y-1.5 p-2.5 ${correct ? 'ring-2 ring-emerald-500' : ''}`}>
          {matchDate && (
            <div className="text-center text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              {matchDate} ET
            </div>
          )}
          {teamRow(a, m.a, 'a', m.scoreA)}
          {teamRow(b, m.b, 'b', m.scoreB)}

          {decided && (
            <div
              className={`rounded-md py-0.5 text-center text-[11px] font-bold ${
                correct
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              {correct ? `✓ +${pts}` : '✗ 0'}
              {scoreHit ? ` · 🎯 +${sp} score` : correct && sp > 0 && real ? ` · score ✗ (was ${real[0]}:${real[1]})` : ''}
              {' pts'}
            </div>
          )}
        </div>
      </div>
    );
  }

  const roundName = (id: RoundId) => tournament.rounds.find((r) => r.id === id)?.name;

  function header(id: RoundId, name: string, matches: DerivedMatch[]) {
    const total = matches.length; // R32:16 · R16:8 · QF:4 · SF:2 · Final:1
    const picked = matches.filter((m) => m.winner != null).length;
    const full = picked === total;
    return (
      <div className="mb-2 flex h-9 items-center gap-2">
        <span className="text-sm font-bold">{roundName(id) || name}</span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
          {pointsByRound[id]} pt{pointsByRound[id] === 1 ? '' : 's'}
        </span>
        {/* Per-round selection limit: pick exactly one winner per match. */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            full
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          }`}
          title={`Pick ${total} winner${total === 1 ? '' : 's'} this round`}
        >
          {picked}/{total}
        </span>
      </div>
    );
  }

  // Split the bracket into two halves that meet only in the Final, so the
  // tree can fan out from a centre column (left half builds rightward, right
  // half mirrors leftward).
  const leftRounds = [
    { id: 'R32' as RoundId, matches: bracket.R32.slice(0, 8) },
    { id: 'R16' as RoundId, matches: bracket.R16.slice(0, 4) },
    { id: 'QF' as RoundId, matches: bracket.QF.slice(0, 2) },
    { id: 'SF' as RoundId, matches: bracket.SF.slice(0, 1) },
  ];
  const rightRounds = [
    { id: 'SF' as RoundId, matches: bracket.SF.slice(1, 2) },
    { id: 'QF' as RoundId, matches: bracket.QF.slice(2, 4) },
    { id: 'R16' as RoundId, matches: bracket.R16.slice(4, 8) },
    { id: 'R32' as RoundId, matches: bracket.R32.slice(8, 16) },
  ];

  function roundCol(round: { id: RoundId; matches: DerivedMatch[] }, key: string) {
    return (
      <div key={key} className="flex flex-col">
        {header(round.id, round.id, round.matches)}
        <div className={`bkt-round flex-1 ${round.matches.length === 1 ? 'bkt-round--final' : ''}`}>
          {round.matches.map((m) => renderMatch(m, round.id))}
        </div>
      </div>
    );
  }
  function connectorCol(count: number, side: 'left' | 'right', key: string) {
    return (
      <div key={key} className="flex flex-col">
        <div className="mb-2 h-9" />
        <div className="bkt-connector flex-1">
          {Array.from({ length: count }, (_, i) => (
            <div key={i} className={`bkt-elbow ${side === 'left' ? 'bkt-elbow--left' : ''}`}>
              <span />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const champion = teamOf(bracket.FINAL.winner);
  const championOutcome = outcome('FINAL', bracket.FINAL.winner);

  return (
    <div className="space-y-8">
      {/* Group stage — locked read-only once the admin finalizes the real draw. */}
      {!hideGroups && (
        <Groups
          tournament={tournament}
          picks={picks}
          onPick={onPick}
          onSetOrder={onSetGroupOrder}
          readOnly={readOnly || (!tournament.knockout?.projected && (tournament.knockout?.r32?.length ?? 0) > 0)}
          results={results}
        />
      )}

      {/* Knockout bracket — always available to predict (projected until the
          admin finalizes the real draw). */}
      {!hideKnockout && (
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-bold">Knockout Bracket 🏆</h3>
            <span className="text-xs text-slate-500">
              Final &amp; champion in the centre · both halves fan out to the Round of 32
            </span>
          </div>

          {/* Finalized-groups indicator — derived live from ESPN. A group shows up
              here once all its matches are played, so its qualifiers and order are
              locked in. */}
          {finalizedGroups.length > 0 && (
            <div
              className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-xs dark:border-emerald-800/60 dark:bg-emerald-900/20"
              title="Groups whose standings are locked from the live ESPN results — every match played, qualifiers and finishing order fixed."
            >
              <span className="font-semibold text-emerald-700 dark:text-emerald-300">✅ Groups finalized</span>
              <span className="text-emerald-500/70 dark:text-emerald-400/70">(live)</span>
              <span className="flex flex-wrap gap-1">
                {finalizedGroups.map((id) => (
                  <span
                    key={id}
                    className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white"
                  >
                    {id}
                  </span>
                ))}
              </span>
              <span className="text-emerald-600/70 dark:text-emerald-400/60">
                {finalizedGroups.length}/{tournament.groups.length}
              </span>
            </div>
          )}
          <div className="bracket-scroll">
            <div className="bracket bracket--mirror items-stretch">
              {/* LEFT half — builds rightward toward the centre */}
              {roundCol(leftRounds[0], 'l-r32')}
              {connectorCol(4, 'right', 'lc0')}
              {roundCol(leftRounds[1], 'l-r16')}
              {connectorCol(2, 'right', 'lc1')}
              {roundCol(leftRounds[2], 'l-qf')}
              {connectorCol(1, 'right', 'lc2')}
              {roundCol(leftRounds[3], 'l-sf')}
              {connectorCol(1, 'right', 'lc3')}

              {/* CENTRE — Final, champion + third-place playoff */}
              <div className="flex w-[320px] shrink-0 flex-col items-center justify-center px-1">
                <div className="mb-2 flex h-9 items-center gap-2">
                  <span className="text-sm font-bold">Final</span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    {pointsByRound['FINAL']} pts
                  </span>
                </div>
                <div className="final-spotlight w-full rounded-2xl p-3 text-center">
                  <div className="animate-float text-4xl drop-shadow">🏆</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-200">
                    Champion
                  </div>
                  <div className="mt-0.5 mb-2 text-base font-extrabold text-white drop-shadow">
                    {champion ? (
                      <span className={championOutcome === 'win' ? 'text-emerald-300' : ''}>
                        {champion.flag} {champion.name}
                      </span>
                    ) : (
                      <span className="text-white/60">Awaiting…</span>
                    )}
                  </div>
                  <div className="rounded-xl bg-white/90 p-1 dark:bg-slate-900/80">
                    {renderMatch(bracket.FINAL, 'FINAL')}
                  </div>
                </div>

                <div className="mt-5 w-full">
                  <div className="mb-1 flex items-center justify-center gap-2">
                    <h4 className="text-xs font-bold">🥉 Third place</h4>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {pointsByRound['THIRD']} pts
                    </span>
                  </div>
                  {renderMatch(bracket.THIRD, 'THIRD')}
                </div>
              </div>

              {/* RIGHT half — mirrors leftward toward the centre */}
              {connectorCol(1, 'left', 'rc0')}
              {roundCol(rightRounds[0], 'r-sf')}
              {connectorCol(1, 'left', 'rc1')}
              {roundCol(rightRounds[1], 'r-qf')}
              {connectorCol(2, 'left', 'rc2')}
              {roundCol(rightRounds[2], 'r-r16')}
              {connectorCol(4, 'left', 'rc3')}
              {roundCol(rightRounds[3], 'r-r32')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
