import type { Picks, Tournament } from './types';
import { buildBracket, prunePicks } from './bracket';

// Generates a complete, valid random bracket for the current phase. Used to
// auto-submit on behalf of registered players who never submitted before the
// deadline. Any picks they did make are preserved; only the gaps are filled.

function choice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomGroups(t: Tournament, base: Picks): Picks {
  const picks: Picks = { ...base };
  for (const g of t.groups) {
    const chosen = new Set<string>();
    for (const n of [1, 2, 3]) {
      const slot = `g-${g.id}-${n}`;
      const cur = picks[slot];
      if (cur && g.teams.includes(cur) && !chosen.has(cur)) {
        chosen.add(cur);
        continue;
      }
      const avail = g.teams.filter((c) => !chosen.has(c));
      if (!avail.length) continue;
      const pick = choice(avail);
      picks[slot] = pick;
      chosen.add(pick);
    }
  }
  return prunePicks(t, picks);
}

function randomKnockout(t: Tournament, base: Picks): Picks {
  let picks: Picks = { ...base };
  // Each pass resolves one more round (winners feed the next round's a/b), so a
  // handful of passes fills the whole bracket from R32 up to the final + 3rd.
  for (let pass = 0; pass < 8; pass++) {
    const b = buildBracket(t, picks);
    const matches = [...b.R32, ...b.R16, ...b.QF, ...b.SF, b.FINAL, b.THIRD];
    let changed = false;
    for (const m of matches) {
      if (m.winner) continue;
      const sides = [m.a, m.b].filter(Boolean) as string[];
      if (!sides.length) continue;
      picks[m.slot] = sides.length === 2 ? choice(sides) : sides[0];
      changed = true;
    }
    picks = prunePicks(t, picks);
    if (!changed) break;
  }
  return picks;
}

/** A complete random bracket for the current phase, keeping any existing picks. */
export function randomBracket(t: Tournament, base: Picks = {}): Picks {
  return t.phase === 'knockout' ? randomKnockout(t, base) : randomGroups(t, base);
}
