import { Layout } from '@/components/Layout';
import { PageHero } from '@/components/PageHero';
import { LiveStandings } from '@/components/LiveStandings';
import { useAppStore } from '@/store/appStore';

// Dedicated page for the real, live group tables (from ESPN).
export default function StandingsPage() {
  const { tournament } = useAppStore();
  const flags = tournament
    ? Object.fromEntries(Object.values(tournament.teams).map((t) => [t.code, t.flag]))
    : {};

  return (
    <Layout>
      <div className="space-y-4">
        <PageHero
          emoji="📊"
          title="Live Group Standings"
          subtitle="The real current group tables, updated from ESPN. Top 2 of each group advance, plus the 8 best third-placed teams."
        />
        <LiveStandings flags={flags} />
        <p className="px-1 text-center text-xs text-slate-400">
          Standings appear once the group stage is underway. Sorted by points, then goal difference.
        </p>
      </div>
    </Layout>
  );
}
