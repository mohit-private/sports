import { useState } from 'react';
import { api } from '@/lib/clientApi';
import type { SessionUser } from '@/lib/types';

// Name-only sign-in with device linking. New name claims the entry on this
// device. A name already in use on another device requires the rotating code
// shown there ("Add a device") to link this device too.
export function SignIn({ onSignedIn }: { onSignedIn: (user: SessionUser) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await api.loginLocal(name, needCode ? code : undefined);
      if (r.ok && r.user) {
        onSignedIn(r.user);
        return;
      }
      if (r.needsVerification) {
        setNeedCode(true);
        setError(r.error || null);
      } else {
        setError(r.error || 'Sign-in failed');
      }
    } catch (err: any) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-2">
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setNeedCode(false); setCode(''); }}
          placeholder="Enter your name"
          maxLength={40}
          autoFocus
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-900"
        />
        {!needCode && (
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="whitespace-nowrap rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? 'Joining…' : 'Join the pool'}
          </button>
        )}
      </div>

      {needCode && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-700/50 dark:bg-amber-900/20">
          <p className="text-xs text-amber-800 dark:text-amber-200">
            This name is already in use. On a device you’re already signed in on, open the menu →
            <strong> “Add a device”</strong> and type the 6-digit code shown there.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              autoFocus
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-lg font-bold tracking-widest outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="whitespace-nowrap rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Linking…' : 'Link device'}
            </button>
          </div>
        </div>
      )}

      {!needCode && (
        <p className="text-xs text-slate-500">
          Pick a name to join. Using a name from a new device? You’ll confirm with a code from your
          first device.
        </p>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
