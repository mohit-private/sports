import type { Group, R32Match } from './types';
import { R32_TEMPLATE } from './tournamentData';

// Resolves the real Round-of-32 bracket once the admin finalizes the group
// stage. Inputs are the actual finishing order of each group and which 8 of the
// 12 third-placed teams advanced; the R32_TEMPLATE seed slots ('W<G>', 'R<G>',
// 'T') are filled with concrete team codes.

export interface GroupStanding {
  first: string;   // group winner
  second: string;  // runner-up
  third: string;   // third place
}

export type GroupStandings = Record<string, GroupStanding>; // groupId -> standing

export interface FinalizeResult {
  r32: R32Match[];
  qualifiers: string[]; // the 32 teams that advanced (24 top-2 + 8 thirds)
}

/** Resolve a non-third seed slot ('W<G>' / 'R<G>') to a team code. */
function resolveFixedSlot(slot: string, standings: GroupStandings): string {
  const type = slot[0]; // 'W' or 'R'
  const s = standings[slot.slice(1)];
  if (!s) return '';
  return type === 'W' ? s.first : s.second;
}

/** Assign each advancing third to a 'T' slot such that no third meets a team
 *  from its own group in the Round of 32. Backtracks for a conflict-free
 *  matching; falls back to in-order if none exists. */
function assignThirds(
  forbiddenGroups: string[], // forbidden group per T slot (the opponent's group)
  thirds: Array<{ code: string; group: string }>
): string[] {
  const out: string[] = new Array(forbiddenGroups.length).fill('');
  const used = new Array(thirds.length).fill(false);

  const solve = (slot: number): boolean => {
    if (slot >= forbiddenGroups.length) return true;
    for (let i = 0; i < thirds.length; i++) {
      if (used[i] || thirds[i].group === forbiddenGroups[slot]) continue;
      used[i] = true;
      out[slot] = thirds[i].code;
      if (solve(slot + 1)) return true;
      used[i] = false;
      out[slot] = '';
    }
    return false;
  };

  if (solve(0)) return out;
  return thirds.map((t) => t.code); // fallback: original order
}

export function buildKnockout(
  groups: Group[],
  standings: GroupStandings,
  advancingThirds: string[]
): FinalizeResult {
  // Which group each advancing third came from.
  const thirdGroup = new Map<string, string>();
  for (const g of groups) {
    const third = standings[g.id]?.third;
    if (third) thirdGroup.set(third, g.id);
  }
  const thirds = advancingThirds.map((code) => ({ code, group: thirdGroup.get(code) || '' }));

  // The T slots, in template order, with the group of their (fixed) opponent.
  const tSlots = R32_TEMPLATE.flatMap((m) => {
    if (m.a === 'T') return [{ id: m.id, opponent: m.b }];
    if (m.b === 'T') return [{ id: m.id, opponent: m.a }];
    return [];
  });
  const forbidden = tSlots.map((s) => s.opponent.slice(1)); // group letter of W</R<
  const thirdByTSlot = assignThirds(forbidden, thirds);
  const tQueue = [...thirdByTSlot];

  const r32: R32Match[] = R32_TEMPLATE.map((m) => ({
    id: m.id,
    a: m.a === 'T' ? tQueue.shift() || '' : resolveFixedSlot(m.a, standings),
    b: m.b === 'T' ? tQueue.shift() || '' : resolveFixedSlot(m.b, standings),
    date: m.date,
  }));

  const topTwo = groups.flatMap((g) => {
    const s = standings[g.id];
    return s ? [s.first, s.second] : [];
  });
  const qualifiers = [...topTwo, ...advancingThirds].filter(Boolean);

  return { r32, qualifiers };
}

/** Validate a finalize request: every group needs a distinct 1/2/3 drawn from
 *  its own teams, and exactly 8 advancing thirds chosen from the group thirds. */
export function validateFinalize(
  groups: Group[],
  standings: GroupStandings,
  advancingThirds: string[]
): string | null {
  for (const g of groups) {
    const s = standings[g.id];
    if (!s || !s.first || !s.second || !s.third) {
      return `Group ${g.id}: set the 1st, 2nd and 3rd place teams.`;
    }
    const picks = [s.first, s.second, s.third];
    if (new Set(picks).size !== 3) return `Group ${g.id}: 1st, 2nd and 3rd must be different teams.`;
    for (const code of picks) {
      if (!g.teams.includes(code)) return `Group ${g.id}: ${code} is not in this group.`;
    }
  }
  if (advancingThirds.length !== 8) {
    return `Exactly 8 third-placed teams advance — you selected ${advancingThirds.length}.`;
  }
  const allThirds = new Set(groups.map((g) => standings[g.id]?.third).filter(Boolean));
  for (const code of advancingThirds) {
    if (!allThirds.has(code)) return `${code} is not a third-placed team.`;
  }
  return null;
}
