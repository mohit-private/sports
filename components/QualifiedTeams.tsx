import { useEffect, useState } from 'react';
import { api } from '@/lib/clientApi';
import { useAppStore } from '@/store/appStore';

// Teams that have already clinched a Round-of-32 spot, derived from the live
// ESPN standings: in any group where all 4 teams have played their 3 games, the
// top 2 are through. (Best third-placed teams are only known once every group
// finishes, so they're not listed here.)
interface Row { code: string; name: string; played: number; pts: number }
interface Group { id: string; rows: Row[] }

export function QualifiedTeams() {
  const { tournament } = useAppStore();
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    let alive = true;
    api.standings()
      .then((d: any) => alive && setGroups(d.groups || []))
      .catch(() => alive && setGroups([]));
    return () => { alive = false; };
  }, []);

  if (!groups) return null;

  const flag = (code: string) => tournament?.teams[code]?.flag || '';
  const name = (code: string) => tournament?.teams[code]?.name || code;

  const qualified: { code: string; group: string; place: number }[] = [];
  for (const g of groups) {
    const rows = g.rows || [];
    const complete = rows.length >= 4 && rows.every((r) => r.played >= 3);
    if (!complete) continue;
    rows.slice(0, 2).forEach((r, i) => {
      if (r.code) qualified.push({ code: r.code, group: g.id, place: i + 1 });
    });
  }

  if (qualified.length === 0) {
    return (
      <div className="card p-4 text-center text-sm text-slate-500">
        ⚽ No teams have clinched a Round-of-32 spot yet — see the{' '}
        <span className="font-semibold">Live Standings</span> tab for current group tables.
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">✅ Already qualified for the Round of 32</h3>
        <span className="text-xs text-slate-400">live from ESPN</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {qualified.map((q) => (
          <span
            key={q.code}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm dark:border-emerald-800 dark:bg-emerald-900/30"
          >
            <span>{flag(q.code)}</span>
            <span className="font-medium">{name(q.code)}</span>
            <span className="text-[10px] uppercase text-slate-400">{q.group}{q.place}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
