import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/clientApi';

// Shown on a signed-in (linked) device. Reveals the rotating 6-digit code the
// owner types on a NEW device to link it to the same entry. Auto-refreshes when
// the code rolls over.
export function AddDevice() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [secsLeft, setSecsLeft] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    async function load() {
      try {
        const r = await api.linkCode();
        if (!alive) return;
        setCode(r.code);
        setErr(null);
        const ms = r.expiresInMs ?? 60000;
        setSecsLeft(Math.ceil(ms / 1000));
        timer.current = setTimeout(load, ms + 300);
      } catch (e: any) {
        if (alive) setErr(e.message || 'Could not load code');
      }
    }
    load();
    tick.current = setInterval(() => setSecsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => {
      alive = false;
      if (timer.current) clearTimeout(timer.current);
      if (tick.current) clearInterval(tick.current);
    };
  }, [open]);

  return (
    <div className="card overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 p-4 text-left">
        <span className="text-lg">📱</span>
        <span className="font-bold">Add another device</span>
        <span className="ml-auto text-slate-400">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4 text-center dark:border-slate-800">
          <p className="text-sm text-slate-500">
            On your other device, enter your name, then type this code to link it:
          </p>
          {err ? (
            <p className="mt-2 text-sm text-red-600">{err}</p>
          ) : (
            <>
              <div className="mt-3 text-4xl font-extrabold tracking-[0.3em] text-emerald-600">
                {code ?? '••••••'}
              </div>
              <div className="mt-1 text-xs text-slate-400">refreshes in {secsLeft}s</div>
            </>
          )}
          <p className="mt-3 text-[11px] text-slate-400">
            Only share this with your own devices — anyone with the code can open your bracket.
          </p>
        </div>
      )}
    </div>
  );
}
