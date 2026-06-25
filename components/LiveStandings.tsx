import { useEffect, useState } from 'react';
import { api } from '@/lib/clientApi';

// Player-facing live group standings (real current tables from ESPN). Collapsible
// so it doesn't crowd the picker. Top 2 are shaded green (qualify), 3rd amber
// (in the hunt for a best-third spot).
interface Row {
  code: string;
  name: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gd: number;
  pts: number;
}
interface Group {
  id: string;
  rows: Row[];
}

export function LiveStandings({ flags }: { flags?: Record<string, string> }) {
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .standings()
      .then((d: any) => {
        if (!alive) return;
        setGroups(d.groups || []);
        setFetchedAt(d.fetchedAt || null);
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
    };
  }, []);

  if (err || (groups && groups.length === 0)) return null; // nothing to show yet

  return (
    <section className="card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 p-4 text-left"
      >
        <span className="text-lg">📊</span>
        <span className="font-bold">Live group standings</span>
        {fetchedAt && (
          <span className="text-[11px] text-slate-400">
            updated {new Date(fetchedAt).toLocaleTimeString()}
          </span>
        )}
        <span className="ml-auto text-slate-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800">
          {!groups ? (
            <div className="text-sm text-slate-400">Loading live standings…</div>
          ) : (
            groups.map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                <div className="mb-1 text-xs font-bold">Group {g.id}</div>
                <table className="w-full text-[12px]">
                  <thead className="text-[10px] uppercase text-slate-400">
                    <tr>
                      <th className="w-4 text-left font-semibold"></th>
                      <th className="text-left font-semibold">Team</th>
                      <th className="w-6 text-center font-semibold">P</th>
                      <th className="w-7 text-center font-semibold">GD</th>
                      <th className="w-6 text-center font-semibold">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr
                        key={r.code || i}
                        className={
                          i < 2
                            ? 'bg-emerald-50 dark:bg-emerald-900/20'
                            : i === 2
                            ? 'bg-amber-50 dark:bg-amber-900/15'
                            : ''
                        }
                      >
                        <td className="text-slate-400">{i + 1}</td>
                        <td className="truncate py-0.5 font-medium">
                          {flags?.[r.code] ? `${flags[r.code]} ` : ''}
                          {r.name}
                        </td>
                        <td className="text-center text-slate-500">{r.played}</td>
                        <td className="text-center text-slate-500">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                        <td className="text-center font-bold">{r.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      )}
      <div className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-800">
        🟩 top 2 advance · 🟨 3rd (8 best 3rd-placed also advance) · live data from ESPN
      </div>
    </section>
  );
}
