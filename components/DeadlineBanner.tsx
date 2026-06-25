import { Countdown } from './Countdown';
import { useAppStore } from '@/store/appStore';

/** Big, hard-to-miss "submit before X" banner shown on the home page until the
 *  deadline. After it passes, brackets lock and unsubmitted (but registered)
 *  players get a random bracket auto-submitted for them. */
export function DeadlineBanner() {
  const { tournament, locked } = useAppStore();
  const deadline = tournament?.deadline || null;
  if (!deadline) return null;

  if (locked) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 px-5 py-4 text-center dark:border-red-700/50 dark:bg-red-900/30">
        <div className="text-lg font-extrabold text-red-700 dark:text-red-200">🔒 Picks are locked</div>
        <div className="mt-1 text-sm text-red-700/80 dark:text-red-200/80">
          The deadline has passed. Everyone’s brackets are now public on the All Picks page.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-emerald-50 px-5 py-5 text-center shadow-sm dark:border-amber-600/40 dark:from-amber-900/30 dark:to-emerald-900/20">
      <div className="text-sm font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        ⏰ Submit your bracket before
      </div>
      <div className="mt-1 text-lg font-extrabold text-slate-800 dark:text-white sm:text-xl">
        {new Date(deadline).toLocaleString(undefined, {
          weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
        })}
      </div>
      <div className="mt-3 flex justify-center">
        <Countdown deadline={deadline} />
      </div>
      <div className="mx-auto mt-3 max-w-xl text-xs text-slate-600 dark:text-slate-300">
        You can keep editing your picks right up to the deadline. If you’ve joined a pool but don’t
        submit in time, we’ll auto-generate a random bracket for you so you’re still in the game.
      </div>
    </div>
  );
}
