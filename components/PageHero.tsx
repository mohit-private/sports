import { ReactNode } from 'react';

// A compact stadium-photo banner used at the top of inner pages, so every page
// carries the World Cup look (photo over a gradient wash — degrades gracefully
// to the gradient if the image can't load).
export function PageHero({
  title,
  subtitle,
  emoji,
  children,
}: {
  title: string;
  subtitle?: string;
  emoji?: string;
  children?: ReactNode;
}) {
  return (
    <div className="hero-stadium card relative overflow-hidden p-6 text-center sm:p-8">
      <div className="pointer-events-none absolute inset-0 opacity-15 [background:repeating-linear-gradient(90deg,#ffffff_0_2px,transparent_2px_80px)]" />
      <div className="relative">
        {emoji && <div className="text-4xl drop-shadow sm:text-5xl">{emoji}</div>}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight drop-shadow sm:text-3xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-1 max-w-2xl text-sm text-emerald-50/90">{subtitle}</p>}
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}
