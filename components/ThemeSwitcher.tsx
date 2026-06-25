import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'theme';

function applyTheme(theme: Theme) {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

export const ThemeSwitcher = () => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as Theme | null) || 'dark';
    setTheme(saved);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [mounted, theme]);

  const choose = (next: Theme) => {
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  };

  if (!mounted) return <div className="inline-flex h-8 w-[96px]" aria-hidden />;

  const options: Array<{ value: Theme; icon: string; label: string }> = [
    { value: 'light', icon: '☀️', label: 'Light' },
    { value: 'dark', icon: '🌙', label: 'Dark' },
    { value: 'system', icon: '🖥️', label: 'System' },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-lg border border-slate-300/60 bg-white/60 p-0.5 text-xs backdrop-blur dark:border-slate-700 dark:bg-slate-800/60"
    >
      {options.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => choose(opt.value)}
            title={opt.label}
            className={`flex items-center gap-1 rounded-md px-2 py-1 font-medium transition ${
              active
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10'
            }`}
          >
            <span aria-hidden>{opt.icon}</span>
          </button>
        );
      })}
    </div>
  );
};
