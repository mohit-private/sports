import { ReactNode, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ThemeSwitcher } from './ThemeSwitcher';
import { PoolSwitcher, refreshPoolMeta } from './PoolSwitcher';
import { useAppStore } from '@/store/appStore';
import { api } from '@/lib/clientApi';

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/play', label: 'My Bracket' },
  { href: '/standings', label: 'Live Standings' },
  { href: '/picks', label: 'Leaderboard' },
];

/** Loads session + memberships, then the active pool's tournament metadata. */
export function useBootstrap() {
  const { setUser, setMemberships, setDbEnabled, setLoadingSession } = useAppStore();
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const me = await api.me();
        if (!alive) return;
        setUser(me.user);
        setDbEnabled(!!me.dbEnabled);
        if (me.user) setMemberships(!!me.paid, me.pools || []);
        // Load pot/fee/currency for the active pool (null = global teams payload).
        const active = useAppStore.getState().activePool;
        await refreshPoolMeta(active);
      } catch {
        /* ignore — landing page still renders */
      } finally {
        if (alive) setLoadingSession(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function Layout({ children }: { children: ReactNode }) {
  useBootstrap();
  const router = useRouter();
  const { user, setUser } = useAppStore();

  const signOut = async () => {
    await api.logout().catch(() => {});
    setUser(null);
    router.push('/');
  };

  return (
    <div className="min-h-screen">
      <header className="app-header sticky top-0 z-30 text-white shadow-lg">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:gap-x-4 sm:px-5">
          {user && (
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">Welcome</span>
              <span className="text-sm font-bold text-white">{user.name}</span>
            </div>
          )}

          <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="text-2xl drop-shadow">🏆</span>
            <span className="hidden sm:inline drop-shadow">
              Novo FIFA <span className="text-amber-300">2026</span>
            </span>
          </Link>

          <nav className="ml-2 hidden items-center gap-1 md:flex">
            {NAV.map((n) => {
              const active = router.pathname === n.href;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    active
                      ? 'bg-white text-emerald-700 shadow-sm'
                      : 'text-white/85 hover:bg-white/15'
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
            <ThemeSwitcher />
            {user ? (
              <div className="flex items-center gap-2">
                <PoolSwitcher />
                <button
                  onClick={signOut}
                  className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-semibold text-white hover:bg-white/15"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        {/* mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-white/20 px-3 py-2 md:hidden">
          {NAV.map((n) => {
            const active = router.pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  active ? 'bg-white text-emerald-700' : 'text-white/85'
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>

      <footer className="mx-auto max-w-[1600px] px-4 py-10 text-center text-xs text-slate-400">
        Novo FIFA 2026 Pool · for fun &amp; bragging rights · predictions are private until the deadline
      </footer>
    </div>
  );
}
