import type { Group, Picks, RoundId, Tournament, R32Match } from './types';
import { buildKnockout, GroupStandings } from './knockout';

// Pure bracket math shared by the UI and the scoring engine, across both
// phases of the pool:
//
//  • GROUP phase — players predict each group's finishing order (1st/2nd/3rd).
//  • KNOCKOUT phase — once the admin finalizes the groups, the real Round of 32
//    is known (tournament.knockout.r32) and players predict the bracket. A pick
//    at a slot advances that team into the next round's fixture, so later rounds
//    derive from the player's own earlier picks.

export interface DerivedMatch {
  slot: string;          // pick key, e.g. "m3" or "r16-1"
  round: RoundId;
  a: string | null;      // team code feeding side A (null until upstream resolved)
  b: string | null;
  winner: string | null; // the player's pick for this slot (must be a or b)
  scoreA: number | null; // predicted goals for side A (R16+ only), excl. penalties
  scoreB: number | null; // predicted goals for side B
  date?: string;         // ISO kickoff time (R32 only, sourced from official draw)
}

/** A group with the player's predicted top 3 (the GROUP "round"). */
export interface DerivedGroup {
  id: string;
  teams: string[];
  first: string | null;   // pick slot g-<id>-1
  second: string | null;  // pick slot g-<id>-2
  third: string | null;   // pick slot g-<id>-3
}

export const GROUP_IDS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** Knockout match slots that carry an exact-scoreline prediction (R16 → Final
 *  + 3rd). R32 (m1..m16) is winner-only. */
export const SCORED_SLOTS: string[] = [
  ...Array.from({ length: 8 }, (_, i) => `r16-${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `qf-${i + 1}`),
  ...Array.from({ length: 2 }, (_, i) => `sf-${i + 1}`),
  'final',
  'third',
];
/** Score pick keys: two per scored slot (`sc-<slot>-a`, `sc-<slot>-b`). */
export const SCORE_KEYS: string[] = SCORED_SLOTS.flatMap((s) => [`sc-${s}-a`, `sc-${s}-b`]);

/** Ordered list of every possible pick slot across both phases. */
export const SLOT_KEYS: string[] = [
  ...GROUP_IDS.flatMap((g) => [`g-${g}-1`, `g-${g}-2`, `g-${g}-3`]),
  ...Array.from({ length: 16 }, (_, i) => `m${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `r16-${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `qf-${i + 1}`),
  ...Array.from({ length: 2 }, (_, i) => `sf-${i + 1}`),
  'final',
  'third',
  ...SCORE_KEYS,
];

/** Slots editable in each phase. */
export const GROUP_SLOTS = GROUP_IDS.flatMap((g) => [`g-${g}-1`, `g-${g}-2`, `g-${g}-3`]);
export const KNOCKOUT_SLOTS = SLOT_KEYS.filter((k) => !k.startsWith('g-'));

/** Parse a stored goal count (0–99) or null. */
export function parseGoals(v: string | undefined): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

function loserOf(a: string | null, b: string | null, winner: string | null): string | null {
  if (!a || !b || !winner) return null;
  return winner === a ? b : a;
}

/** Validated top-3 selection for a group: each must be in the group and the
 *  three must be distinct. */
function groupSelection(group: Group, picks: Picks) {
  const f = picks[`g-${group.id}-1`];
  const s = picks[`g-${group.id}-2`];
  const t = picks[`g-${group.id}-3`];
  const first = f && group.teams.includes(f) ? f : null;
  const second = s && group.teams.includes(s) && s !== first ? s : null;
  const third = t && group.teams.includes(t) && t !== first && t !== second ? t : null;
  return { first, second, third };
}

/** Teams of a group ordered by FIFA rank (best first) — the default standings. */
function rankedTeams(t: Tournament, g: Group): string[] {
  return [...g.teams].sort((a, b) => (t.teams[a]?.rank ?? 99) - (t.teams[b]?.rank ?? 99));
}

/**
 * The Round-of-32 seeded from THIS player's group predictions: their predicted
 * 1st/2nd/3rd per group (gaps filled by FIFA rank), with the 8 best predicted
 * third-placed teams (by rank) advancing. This makes a player's group picks the
 * source of their own bracket. Used while the draw is still projected; once the
 * admin finalizes the real draw, the real R32 is used for everyone instead.
 */
export function playerR32(t: Tournament, picks: Picks): R32Match[] {
  const standings: GroupStandings = {};
  for (const g of t.groups) {
    const sel = groupSelection(g, picks);
    const used = new Set([sel.first, sel.second, sel.third].filter(Boolean) as string[]);
    // Fill gaps: live standings first (if admin published), then FIFA rank.
    // This mirrors what the Groups section shows — picks override, rest fills by rank.
    const liveOrder = (t.liveStandings?.[g.id] || []).filter((c) => !used.has(c));
    const rankPool = rankedTeams(t, g).filter((c) => !used.has(c) && !liveOrder.includes(c));
    const pool = liveOrder.length ? liveOrder : rankPool;
    const take = () => pool.shift() || '';
    standings[g.id] = {
      first: sel.first || take(),
      second: sel.second || take(),
      third: sel.third || take(),
    };
  }
  const thirds = t.groups
    .map((g) => standings[g.id].third)
    .filter(Boolean)
    .sort((a, b) => (t.teams[a]?.rank ?? 99) - (t.teams[b]?.rank ?? 99))
    .slice(0, 8);
  return buildKnockout(t.groups, standings, thirds).r32;
}

/**
 * Build the full prediction surface for a set of picks: the group stage plus
 * the knockout bracket. While the draw is projected, the knockout fixtures come
 * from the player's own group picks (FIFA-rank default); after finalization
 * they come from the real draw. Slots without both teams resolved have a/b=null.
 */
export function buildBracket(tournament: Tournament, picks: Picks) {
  const groups = tournament.groups;
  const sc = (slot: string, side: 'a' | 'b') => parseGoals(picks[`sc-${slot}-${side}`]);

  // GROUP stage — the player's predicted top 3 per group.
  const GROUPS: DerivedGroup[] = groups.map((g) => {
    const { first, second, third } = groupSelection(g, picks);
    return { id: g.id, teams: g.teams, first, second, third };
  });

  // R32 fixtures: seeded from the player's own group picks while projected
  // (gaps filled by FIFA rank), then the real finalized draw for everyone.
  const fixtures = tournament.knockout?.projected
    ? playerR32(tournament, picks)
    : tournament.knockout?.r32 || [];
  const R32: DerivedMatch[] = fixtures.map((m) => {
    const w = picks[m.id];
    return {
      slot: m.id,
      round: 'R32' as RoundId,
      a: m.a || null,
      b: m.b || null,
      winner: w && (w === m.a || w === m.b) ? w : null,
      scoreA: null,
      scoreB: null,
      date: m.date,
    };
  });

  const R16: DerivedMatch[] = Array.from({ length: 8 }, (_, i) => {
    const a = R32[2 * i]?.winner ?? null;
    const b = R32[2 * i + 1]?.winner ?? null;
    const slot = `r16-${i + 1}`;
    const w = picks[slot];
    return { slot, round: 'R16' as RoundId, a, b, winner: w === a || w === b ? w : null, scoreA: sc(slot, 'a'), scoreB: sc(slot, 'b') };
  });

  const QF: DerivedMatch[] = Array.from({ length: 4 }, (_, i) => {
    const a = R16[2 * i]?.winner ?? null;
    const b = R16[2 * i + 1]?.winner ?? null;
    const slot = `qf-${i + 1}`;
    const w = picks[slot];
    return { slot, round: 'QF' as RoundId, a, b, winner: w === a || w === b ? w : null, scoreA: sc(slot, 'a'), scoreB: sc(slot, 'b') };
  });

  const SF: DerivedMatch[] = Array.from({ length: 2 }, (_, i) => {
    const a = QF[2 * i]?.winner ?? null;
    const b = QF[2 * i + 1]?.winner ?? null;
    const slot = `sf-${i + 1}`;
    const w = picks[slot];
    return { slot, round: 'SF' as RoundId, a, b, winner: w === a || w === b ? w : null, scoreA: sc(slot, 'a'), scoreB: sc(slot, 'b') };
  });

  const finalA = SF[0]?.winner ?? null;
  const finalB = SF[1]?.winner ?? null;
  const finalW = picks['final'];
  const FINAL: DerivedMatch = {
    slot: 'final',
    round: 'FINAL',
    a: finalA,
    b: finalB,
    winner: finalW === finalA || finalW === finalB ? finalW : null,
    scoreA: sc('final', 'a'),
    scoreB: sc('final', 'b'),
  };

  const thirdA = loserOf(SF[0]?.a ?? null, SF[0]?.b ?? null, SF[0]?.winner ?? null);
  const thirdB = loserOf(SF[1]?.a ?? null, SF[1]?.b ?? null, SF[1]?.winner ?? null);
  const thirdW = picks['third'];
  const THIRD: DerivedMatch = {
    slot: 'third',
    round: 'THIRD',
    a: thirdA,
    b: thirdB,
    winner: thirdW === thirdA || thirdW === thirdB ? thirdW : null,
    scoreA: sc('third', 'a'),
    scoreB: sc('third', 'b'),
  };

  return { GROUPS, R32, R16, QF, SF, FINAL, THIRD };
}

/** True when every group has a distinct top 3 chosen. */
export function isGroupsComplete(tournament: Tournament, picks: Picks): boolean {
  const b = buildBracket(tournament, picks);
  return b.GROUPS.every((g) => g.first && g.second && g.third);
}

/** True when every knockout slot has a winner chosen. */
export function isKnockoutComplete(tournament: Tournament, picks: Picks): boolean {
  const b = buildBracket(tournament, picks);
  const all = [...b.R32, ...b.R16, ...b.QF, ...b.SF, b.FINAL, b.THIRD];
  return b.R32.length > 0 && all.every((m) => m.winner != null);
}

/** Completeness for the submit gate — all knockout slots must be picked.
 *  Group picks are for fun only and are not required. */
export function isComplete(tournament: Tournament, picks: Picks): boolean {
  if (tournament.phase !== 'knockout') return isGroupsComplete(tournament, picks);
  return isKnockoutComplete(tournament, picks);
}

/** Progress for the submit gate: { count, total } across every required category. */
export function phaseProgress(tournament: Tournament, picks: Picks): { count: number; total: number } {
  const b = buildBracket(tournament, picks);
  const groupCount = b.GROUPS.reduce(
    (n, g) => n + (g.first ? 1 : 0) + (g.second ? 1 : 0) + (g.third ? 1 : 0),
    0
  );
  const groupTotal = b.GROUPS.length * 3;

  if (tournament.phase !== 'knockout') return { count: groupCount, total: groupTotal };

  const all = [...b.R32, ...b.R16, ...b.QF, ...b.SF, b.FINAL, b.THIRD];
  const koCount = all.filter((m) => m.winner != null).length;
  const koTotal = all.length;
  return { count: koCount, total: koTotal };
}

/**
 * Drop any stale picks so the stored prediction stays internally consistent:
 * invalid group selections, and knockout winners no longer present in their
 * (derived) fixture.
 */
export function prunePicks(tournament: Tournament, picks: Picks): Picks {
  let current: Picks = { ...picks };

  for (let i = 0; i < 8; i++) {
    let changed = false;
    const next: Picks = { ...current };

    // Group slots.
    for (const g of tournament.groups) {
      const { first, second, third } = groupSelection(g, current);
      const want: Record<string, string | null> = {
        [`g-${g.id}-1`]: first,
        [`g-${g.id}-2`]: second,
        [`g-${g.id}-3`]: third,
      };
      for (const [slot, valid] of Object.entries(want)) {
        if (current[slot] && current[slot] !== valid) {
          delete next[slot];
          changed = true;
        }
      }
    }

    // Knockout slots.
    const b = buildBracket(tournament, next);
    const knockout = [...b.R32, ...b.R16, ...b.QF, ...b.SF, b.FINAL, b.THIRD];
    for (const m of knockout) {
      const chosen = next[m.slot];
      if (chosen && chosen !== m.a && chosen !== m.b) {
        delete next[m.slot];
        changed = true;
      }
    }

    current = next;
    if (!changed) break;
  }
  return current;
}

/** The set of team codes a player predicts to *advance* in each round.
 *  GROUP = the teams tipped to finish top 3 (i.e. to make the Round of 32). */
export function predictedWinnersByRound(tournament: Tournament, picks: Picks): Record<RoundId, string[]> {
  const b = buildBracket(tournament, picks);
  return {
    GROUP: b.GROUPS.flatMap((g) => [g.first, g.second, g.third]).filter(Boolean) as string[],
    R32: b.R32.map((m) => m.winner).filter(Boolean) as string[],
    R16: b.R16.map((m) => m.winner).filter(Boolean) as string[],
    QF: b.QF.map((m) => m.winner).filter(Boolean) as string[],
    SF: b.SF.map((m) => m.winner).filter(Boolean) as string[],
    FINAL: b.FINAL.winner ? [b.FINAL.winner] : [],
    THIRD: b.THIRD.winner ? [b.THIRD.winner] : [],
  };
}
