import type { Team } from '@/lib/types';
import { formCounts } from '@/lib/insights';

export function TeamButton({
  team,
  selected,
  favored,
  disabled,
  showStats,
  onClick,
  result, // 'win' | 'lose' | undefined — actual outcome highlight (post-results)
}: {
  team: Team | null;
  selected: boolean;
  favored?: boolean;
  disabled?: boolean;
  showStats?: boolean;
  onClick?: () => void;
  result?: 'win' | 'lose';
}) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-400 dark:border-slate-700">
        <span className="text-lg">🔒</span> <span>Winner of previous round</span>
      </div>
    );
  }
  const { w, d, l } = formCounts(team.form);

  const base =
    'group flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition';
  // Your own pick → soft blue (light, not loud). The actual winner (from
  // results) → green, and it overrides the blue so a correct pick reads green.
  const state = selected
    ? 'border-sky-300 bg-sky-50 dark:border-sky-700/60 dark:bg-sky-900/20'
    : 'border-slate-200 hover:border-sky-200 hover:bg-sky-50/40 dark:border-slate-700 dark:hover:bg-white/5';
  const resultRing =
    result === 'win'
      ? ' !border-emerald-600 !bg-emerald-100 !ring-2 !ring-emerald-500 dark:!bg-emerald-800/50'
      : result === 'lose'
      ? ' opacity-50'
      : '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${state}${resultRing} ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
    >
      <span className="text-xl leading-none">{team.flag}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold leading-tight">{team.name}</span>
          {/* FIFA ranking — always shown beside every team. */}
          <span
            title="FIFA ranking"
            className="shrink-0 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          >
            #{team.rank}
          </span>
          {favored && (
            <span title="Model favorite" className="rounded bg-amber-100 px-1 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              ★
            </span>
          )}
        </span>
        {showStats && (
          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1" title="Recent form (last 5)">
              {team.form.split('').map((c, i) => (
                <span
                  key={i}
                  className={
                    c === 'W'
                      ? 'text-emerald-500'
                      : c === 'D'
                      ? 'text-amber-500'
                      : 'text-red-400'
                  }
                >
                  {c}
                </span>
              ))}
            </span>
            <span className="text-slate-400">
              {w}W {d}D {l}L
            </span>
          </span>
        )}
      </span>
      {selected && <span className={result === 'win' ? 'text-emerald-600' : 'text-sky-500'}>✓</span>}
    </button>
  );
}
