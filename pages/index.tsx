import Link from 'next/link';
import { useRouter } from 'next/router';
import { Layout } from '@/components/Layout';
import { PotBanner } from '@/components/PotBanner';
import { DeadlineBanner } from '@/components/DeadlineBanner';
import { QualifiedTeams } from '@/components/QualifiedTeams';
import { SignIn } from '@/components/SignIn';
import { useAppStore } from '@/store/appStore';

const POINTS = [
  { round: 'Round of 32', pts: 1, scorePts: null },
  { round: 'Round of 16', pts: 2, scorePts: 2 },
  { round: 'Quarter-Finals', pts: 3, scorePts: 2 },
  { round: 'Semi-Finals', pts: 5, scorePts: 2 },
  { round: 'Final', pts: 10, scorePts: 2 },
  { round: 'Third place', pts: 5, scorePts: 2 },
];

export default function Home() {
  const router = useRouter();
  const { user, tournament, setUser, entry } = useAppStore();

  return (
    <Layout>
      <div className="space-y-8">
        <DeadlineBanner />
        {/* Hero */}
        <section className="hero-stadium card relative overflow-hidden p-8 text-center sm:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-20 [background:repeating-linear-gradient(90deg,#ffffff_0_2px,transparent_2px_90px)]" />
          <div className="relative mx-auto max-w-3xl">
            <div className="animate-float text-6xl drop-shadow-lg sm:text-7xl">🏆</div>
            <div className="mt-2 text-2xl">⚽ 🇨🇦 🇲🇽 🇺🇸</div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight drop-shadow sm:text-6xl">
              FIFA World Cup 2026
            </h1>
            <p className="mt-1 text-lg font-semibold text-amber-300 drop-shadow sm:text-2xl">
              Bracket Prediction Pool
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-emerald-50/90 sm:text-lg">
              Predict the knockouts from the Round of 32 to the Final. Most points wins. Picks stay
              secret until the deadline - then it's on. 🔥
            </p>

            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {user ? (
                <Link
                  href="/play"
                  className="rounded-xl bg-amber-400 px-7 py-3.5 font-bold text-emerald-950 shadow-lg transition hover:bg-amber-300"
                >
                  {entry.status === 'submitted' ? 'View my bracket →' : 'Make my picks →'}
                </Link>
              ) : (
                <SignIn onSignedIn={(u) => { setUser(u); router.push('/play'); }} />
              )}
            </div>
          </div>
        </section>

        <PotBanner tournament={tournament} />

        <QualifiedTeams />

        {/* How it works */}
        <section className="grid gap-4 md:grid-cols-3">
          <div className="card p-5">
            <div className="text-2xl">📝</div>
            <h3 className="mt-2 font-bold">1. Pick a name & play</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Just enter your name to join - one entry per device - then fill your bracket from the
              Round of 32 up to the champion. Each match shows FIFA rank, recent form, and a
              suggested favorite (just a hint!).
            </p>
          </div>
          <div className="card p-5">
            <div className="text-2xl">🔒</div>
            <h3 className="mt-2 font-bold">2. Submit before the deadline</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              Once you submit, your bracket locks - nobody can see it (not even the admin) until the
              deadline. Need a fix? The admin can unlock you for a correction.
            </p>
          </div>
          <div className="card p-5">
            <div className="text-2xl">👕</div>
            <h3 className="mt-2 font-bold">3. Score &amp; win jerseys</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              As results come in, points add up automatically. Most points wins
              <strong> 2 official soccer jerseys</strong>; the runner-up takes <strong>1 jersey</strong>.
            </p>
          </div>
        </section>

        {/* Scoring */}
        <section className="card p-6">
          <h3 className="text-lg font-bold">Scoring</h3>
          <p className="mt-1 text-sm text-slate-500">
            The group stage is just for setting up your bracket - <strong>no points</strong>. Scoring
            starts at the Round of 32: you earn a round's points for every team you correctly picked
            to win in that round. No negative points - wrong picks just score zero.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {POINTS.map((p) => (
              <div key={p.round} className="rounded-xl border border-slate-200 p-3 text-center dark:border-slate-700">
                <div className="text-2xl font-extrabold text-emerald-600">{p.pts}</div>
                <div className="text-xs text-slate-500">{p.round}</div>
                {p.scorePts != null && (
                  <div className="mt-1.5 rounded-md bg-amber-50 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    🎯 +{p.scorePts} score
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-200">
            <span className="font-bold">🎯 Score prediction bonus</span> - From the Round of 16 onwards,
            predict the exact scoreline (before penalties) on each match. If your predicted winner advances{' '}
            <em>and</em> the score is right, you earn the bonus on top of the round points.
            Draws before a penalty shootout count - predict 1-1 and it goes to pens, that's a correct score.
          </div>
        </section>
      </div>
    </Layout>
  );
}
