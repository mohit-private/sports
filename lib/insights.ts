import type { Team } from './types';

// Lightweight, transparent "suggestion" helpers shown next to picks. These are
// hints only — never enforced — derived from FIFA rank + recent form.

export function formCounts(form: string): { w: number; d: number; l: number } {
  let w = 0,
    d = 0,
    l = 0;
  for (const c of (form || '').toUpperCase()) {
    if (c === 'W') w++;
    else if (c === 'D') d++;
    else if (c === 'L') l++;
  }
  return { w, d, l };
}

/** Points from last-5 form (3-1-0), as a quick momentum proxy. */
export function formPoints(form: string): number {
  const { w, d } = formCounts(form);
  return w * 3 + d;
}

/** A blended strength score: ranking weight + recent momentum. Higher = stronger. */
export function strength(team: Team): number {
  const rankScore = Math.max(0, 33 - team.rank); // 1 → 32, 32 → 1
  return rankScore + formPoints(team.form); // form adds up to +15
}

/** Which of two teams the model leans toward, and how strongly. */
export function suggestion(a: Team, b: Team): { favorite: string; margin: 'toss-up' | 'lean' | 'strong' } {
  const sa = strength(a);
  const sb = strength(b);
  const fav = sa >= sb ? a : b;
  const diff = Math.abs(sa - sb);
  const margin = diff <= 3 ? 'toss-up' : diff <= 10 ? 'lean' : 'strong';
  return { favorite: fav.code, margin };
}
