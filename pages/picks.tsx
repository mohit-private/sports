import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { PageHero } from '@/components/PageHero';
import { Bracket } from '@/components/Bracket';
import { Countdown } from '@/components/Countdown';
import { api } from '@/lib/clientApi';
import { useAppStore } from '@/store/appStore';
import type { Tournament, Results, Picks } from '@/lib/types';

interface Entry {
  userId: string;
  name: string;
  picture: string | null;
  status: string;
  picks: Picks;
  score: number;
}

export default function AllPicks() {
  const { user, tournament: storeTournament, activePool, activePoolMeta, dbEnabled, loadingSession } = useAppStore();
  const [state, setState] = useState<'loading' | 'locked-wait' | 'open' | 'signin' | 'error'>('loading');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [results, setResults] = useState<Results>({});
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loadingSession) return;
    if (!user) {
      setState('signin');
      return;
    }
    if (dbEnabled && !activePool) {
      setState('open');
      setEntries([]);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const d = await api.allPicks(activePool || '');
        if (!alive) return;
        setEntries(d.entries || []);
        setResults(d.results || {});
        setTournament(d.tournament || storeTournament);
        setState('open');
      } catch (e: any) {
        if (!alive) return;
        // 403 before deadline — surface the wait state.
        setDeadline(storeTournament?.deadline || null);
        if ((e.message || '').toLowerCase().includes('private')) {
          setState('locked-wait');
        } else {
          setError(e.message);
          setState('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loadingSession, storeTournament, activePool]);

  if (state === 'loading' || loadingSession) {
    return (
      <Layout>
        <div className="py-20 text-center text-slate-400">Loading…</div>
      </Layout>
    );
  }

  if (state === 'signin') {
    return (
      <Layout>
        <div className="card mx-auto max-w-md p-8 text-center">
          <div className="text-4xl">👀</div>
          <h1 className="mt-2 text-xl font-bold">Sign in to view picks</h1>
          <p className="mt-1 text-sm text-slate-500">Everyone’s brackets unlock after the deadline.</p>
        </div>
      </Layout>
    );
  }

  if (state === 'locked-wait') {
    return (
      <Layout>
        <div className="card mx-auto max-w-lg p-8 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 text-xl font-bold">Picks are private until the deadline</h1>
          <p className="mt-1 text-sm text-slate-500">
            To keep things fair, nobody can see anyone else’s bracket (not even the admin) until
            picks lock. Come back when the clock hits zero.
          </p>
          <div className="mt-5 flex justify-center">
            <Countdown deadline={deadline} />
          </div>
        </div>
      </Layout>
    );
  }

  if (state === 'error') {
    return (
      <Layout>
        <div className="card p-6 text-sm text-red-600">{error}</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <PageHero
          emoji="🏆"
          title="Leaderboard"
          subtitle="Standings update automatically as results come in. Tap a player to see their bracket."
        />

        {entries.length === 0 ? (
          <div className="card p-10 text-center text-slate-500">No submitted brackets.</div>
        ) : (
          <div className="space-y-3">
            {entries.map((e, i) => {
              const champ = e.picks?.final ? tournament?.teams[e.picks.final] : null;
              return (
              <div key={e.userId} className="card overflow-hidden">
                <button
                  onClick={() => setOpenId(openId === e.userId ? null : e.userId)}
                  className="flex w-full items-center gap-3 p-4 text-left"
                >
                  <span className="w-6 text-center font-bold text-slate-400">{i + 1}</span>
                  {e.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.picture} alt="" className="h-9 w-9 rounded-full" />
                  ) : (
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-200 dark:bg-slate-700">{e.name.charAt(0)}</span>
                  )}
                  <span className="flex-1 font-semibold">
                    {e.name} {user?.sub === e.userId && <span className="text-emerald-600">(you)</span>}
                  </span>
                  {/* Champion they picked — shown inline in the standings row. */}
                  <span className="hidden shrink-0 items-center gap-1 text-sm text-slate-500 sm:flex" title="Picked champion">
                    🏆 {champ ? <span className="font-semibold text-slate-700 dark:text-slate-200">{champ.flag} {champ.name}</span> : <span className="text-slate-400">—</span>}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {e.score} pts
                  </span>
                  <span className="text-slate-400">{openId === e.userId ? '▲' : '▼'}</span>
                </button>
                {openId === e.userId && tournament && (
                  <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                    <Bracket tournament={tournament} picks={e.picks} readOnly results={results} showStats={false} hideGroups />
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
