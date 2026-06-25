import { useEffect, useState } from 'react';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

export function Countdown({ deadline }: { deadline: string | null }) {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!deadline) {
    return <span className="text-sm text-slate-500">Deadline not set yet</span>;
  }
  const target = Date.parse(deadline);
  if (Number.isNaN(target)) return <span className="text-sm text-slate-500">Invalid deadline</span>;

  const remaining = target - now;
  if (remaining <= 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">
        🔒 Picks locked
      </span>
    );
  }
  const { d, h, m, s } = parts(remaining);
  const box = (n: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className="tabular-nums text-xl font-bold leading-none">{String(n).padStart(2, '0')}</span>
      <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
    </div>
  );
  return (
    <div className="flex items-center gap-3">
      {box(d, 'days')}
      <span className="text-lg text-slate-400">:</span>
      {box(h, 'hrs')}
      <span className="text-lg text-slate-400">:</span>
      {box(m, 'min')}
      <span className="text-lg text-slate-400">:</span>
      {box(s, 'sec')}
    </div>
  );
}
