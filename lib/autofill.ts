import { getTournament, isPastDeadline } from './poolConfig';
import { getConfig, setConfig, getDraftEntries, submitEntry, hasDatabase } from './db';
import { randomBracket } from './randomBracket';

// Once the submission deadline passes, every registered player who never
// submitted gets a random bracket auto-submitted on their behalf, so the whole
// pool is scored. This runs lazily (no cron): the first read after the deadline
// triggers it, guarded by an `autofilledAt` config flag + an in-process lock so
// it only ever runs once.

let inFlight: Promise<void> | null = null;

export async function ensureDeadlineAutofill(): Promise<void> {
  if (!hasDatabase()) return;
  const t = await getTournament();
  if (!isPastDeadline(t.deadline)) return;
  if (await getConfig<string>('autofilledAt')) return;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    // Re-check the flag inside the lock to avoid a double run on concurrent reads.
    if (await getConfig<string>('autofilledAt')) return;
    const drafts = await getDraftEntries();
    for (const e of drafts) {
      const picks = randomBracket(t, e.picks);
      await submitEntry(e.user_id, e.pool_code, picks);
    }
    await setConfig('autofilledAt', new Date().toISOString());
  })()
    .catch(() => {
      /* swallow — a failed pass just leaves the flag unset to retry next read */
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
