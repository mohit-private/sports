import { Countdown } from './Countdown';
import type { Tournament } from '@/lib/types';

// Shows what the winner & runner-up actually win (physical prizes) plus the
// deadline countdown.
export function PotBanner({ tournament }: { tournament: Tournament | null }) {
  if (!tournament) return null;
  const { deadline, prizes } = tournament;

  return (
    <div className="card overflow-hidden p-0">
      <div className="grid gap-px bg-slate-200/60 dark:bg-slate-800 sm:grid-cols-2">
        {/* Prizes */}
        <div className="bg-white/80 p-5 dark:bg-slate-900/70">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prizes 🏆</div>
          <div className="mt-2 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">🥇</span>
              <span className="font-bold">Winner</span>
              <span className="ml-auto font-semibold text-emerald-600">{prizes?.winner || '—'} 👕</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🥈</span>
              <span className="font-bold">Runner-up</span>
              <span className="ml-auto font-semibold text-emerald-600">{prizes?.runnerUp || '—'} 👕</span>
            </div>
            <div className="pt-1 text-[11px] text-slate-500">
              Most points wins. Tie for 1st? They split the jerseys — organizer’s call.
            </div>
          </div>
        </div>

        {/* Deadline */}
        <div className="bg-white/80 p-5 dark:bg-slate-900/70">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Picks lock in</div>
          <div className="mt-2">
            <Countdown deadline={deadline} />
          </div>
          {deadline && (
            <div className="mt-1 text-[11px] text-slate-500">{new Date(deadline).toLocaleString()}</div>
          )}
        </div>
      </div>
    </div>
  );
}
