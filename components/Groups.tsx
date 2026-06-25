import { useState } from 'react';
import type { Tournament, Picks, Results, Group } from '@/lib/types';
import { formCounts } from '@/lib/insights';
import { api } from '@/lib/clientApi';

// Group-stage predictions by REORDERING: each group is a draggable list of its
// 4 teams in predicted finishing order. Top 2 advance (green), 3rd is in the
// hunt for a best-third spot (amber), 4th is out. Drag a team up/down (or use
// the ▲▼ buttons on touch) to set the order — no 1/2/3 buttons. The top 3 are
// stored as g-<id>-1/2/3 via onSetOrder.
export function Groups({
  tournament,
  picks,
  onPick,
  onSetOrder,
  readOnly,
  results,
}: {
  tournament: Tournament;
  picks: Picks;
  onPick?: (slot: string, code: string) => void;
  onSetOrder?: (groupId: string, top3: string[]) => void;
  readOnly?: boolean;
  results?: Results;
}) {
  const [drag, setDrag] = useState<{ g: string; i: number } | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const advanced = new Set(results?.GROUP || []);
  const hasResults = advanced.size > 0;

  const byRank = (a: string, b: string) => (tournament.teams[a]?.rank ?? 99) - (tournament.teams[b]?.rank ?? 99);

  // Current finishing order for a group: the player's top 3, then any leftover
  // team (by rank). Always 4 distinct teams.
  function orderOf(g: Group): string[] {
    const top = [picks[`g-${g.id}-1`], picks[`g-${g.id}-2`], picks[`g-${g.id}-3`]]
      .filter((c) => c && g.teams.includes(c)) as string[];
    const seen = new Set(top);
    const rest = g.teams.filter((c) => !seen.has(c)).sort(byRank);
    return [...top, ...rest].slice(0, 4);
  }

  function commit(g: Group, order: string[]) {
    if (readOnly) return;
    const top3 = order.slice(0, 3);
    if (onSetOrder) onSetOrder(g.id, top3);
    else if (onPick) top3.forEach((code, i) => onPick(`g-${g.id}-${i + 1}`, code));
  }

  function reorder(g: Group, order: string[], from: number, to: number) {
    if (from === to) return;
    const next = [...order];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    commit(g, next);
  }

  function autofillByRank() {
    if (readOnly) return;
    for (const g of tournament.groups) commit(g, [...g.teams].sort(byRank));
  }
  // Order every group by today's LIVE standings from ESPN (sorted by points →
  // GD). Always available; reseeds the bracket with the current real order.
  async function autofillByStandings() {
    if (readOnly || liveBusy) return;
    setLiveBusy(true);
    try {
      const d = await api.standings();
      const byId = new Map<string, { code: string }[]>((d.groups || []).map((g: any) => [g.id, g.rows || []]));
      for (const g of tournament.groups) {
        const rows = byId.get(g.id) || [];
        const order = rows.map((r) => r.code).filter((c) => c && g.teams.includes(c)) as string[];
        const seen = new Set(order);
        const rest = g.teams.filter((c) => !seen.has(c)).sort(byRank);
        const full = [...order, ...rest].slice(0, 4);
        if (full.length === 4) commit(g, full);
      }
    } finally {
      setLiveBusy(false);
    }
  }

  // For consistent gradient of position colors.
  const rowTone = (i: number) =>
    i < 2
      ? 'border-emerald-400 bg-emerald-50/70 dark:border-emerald-700/60 dark:bg-emerald-900/25'
      : i === 2
      ? 'border-amber-400 bg-amber-50/70 dark:border-amber-700/60 dark:bg-amber-900/20'
      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900';
  const posBadge = (i: number) =>
    i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '4';

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold">Group Stage</h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          For fun — no points
        </span>
        {!readOnly && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={autofillByRank}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300"
            >
              ⚡ Reset to FIFA ranking
            </button>
            <button
              type="button"
              onClick={autofillByStandings}
              disabled={liveBusy}
              title="Order every group by today's live standings (ESPN)"
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300"
            >
              {liveBusy ? '… loading' : '📊 Use current standings'}
            </button>
          </div>
        )}
        <span className="w-full text-xs text-slate-500">
          Drag teams to set each group’s finishing order (or use ▲▼). Top 2 advance 🟩 · 3rd 🟨 in the hunt for a best-third spot.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tournament.groups.map((g) => {
          const order = orderOf(g);
          return (
            <div key={g.id} className="card p-3">
              <h4 className="mb-2 font-bold">Group {g.id}</h4>
              <div className="space-y-1.5">
                {order.map((code, idx) => {
                  const team = tournament.teams[code];
                  if (!team) return null;
                  const { w, d, l } = formCounts(team.form);
                  const qualified = hasResults && advanced.has(code);
                  return (
                    <div
                      key={code}
                      draggable={!readOnly}
                      onDragStart={() => setDrag({ g: g.id, i: idx })}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (drag && drag.g === g.id) reorder(g, order, drag.i, idx);
                        setDrag(null);
                      }}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition ${rowTone(idx)} ${
                        readOnly ? '' : 'cursor-grab active:cursor-grabbing'
                      } ${qualified ? 'ring-1 ring-emerald-400/60' : ''} ${
                        drag && drag.g === g.id && drag.i === idx ? 'opacity-50' : ''
                      }`}
                    >
                      <span className="w-5 shrink-0 text-center text-sm">{posBadge(idx)}</span>
                      <span className="text-lg leading-none">{team.flag}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold leading-tight">{team.name}</span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            #{team.rank}
                          </span>
                          {qualified && <span title="Advanced">✅</span>}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px]">
                          {team.form.split('').map((c, i) => (
                            <span key={i} className={c === 'W' ? 'text-emerald-500' : c === 'D' ? 'text-amber-500' : 'text-red-400'}>
                              {c}
                            </span>
                          ))}
                          <span className="text-slate-400">· {w}W {d}D {l}L</span>
                        </span>
                      </span>
                      {!readOnly && (
                        <span className="flex shrink-0 flex-col">
                          <button
                            type="button"
                            aria-label="Move up"
                            disabled={idx === 0}
                            onClick={() => reorder(g, order, idx, idx - 1)}
                            className="grid h-4 w-6 place-items-center text-xs text-slate-400 enabled:hover:text-emerald-600 disabled:opacity-20"
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            disabled={idx === order.length - 1}
                            onClick={() => reorder(g, order, idx, idx + 1)}
                            className="grid h-4 w-6 place-items-center text-xs text-slate-400 enabled:hover:text-emerald-600 disabled:opacity-20"
                          >
                            ▼
                          </button>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
