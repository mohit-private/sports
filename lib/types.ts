// Shared domain types for the FIFA 2026 prediction pool.

export interface Team {
  code: string;        // 3-letter code, stable id (e.g. "ARG")
  name: string;        // display name
  flag: string;        // emoji flag
  rank: number;        // FIFA world ranking (lower = stronger)
  /** Recent form, most-recent-first, each char in W|D|L. */
  form: string;        // e.g. "WWDLW"
}

/** A group in the group stage — 4 teams. Top 2 advance, plus the 8 best
 *  third-placed teams across all 12 groups. */
export interface Group {
  id: string;          // "A".."L"
  teams: string[];     // 4 team codes, seed order (pot 1 → pot 4)
}

/** A resolved Round-of-32 fixture (concrete teams), built when the admin
 *  finalizes the group stage. Array order = bracket position m1..m16. */
export interface R32Match {
  id: string;          // "m1".."m16" — also the knockout pick slot key
  a: string;           // team code
  b: string;           // team code
  date?: string;       // ISO date string for the match
}

/** The real knockout bracket, resolved at group-stage finalization. Its
 *  presence flips the pool from the "groups" phase to the "knockout" phase. */
export interface Knockout {
  r32: R32Match[];     // 16 concrete fixtures
  finalizedAt: string; // ISO timestamp ('' while only projected)
  projected?: boolean; // true = seeded from projected standings, not the real draw
}

export interface RoundDef {
  id: RoundId;
  name: string;
  points: number;       // points for correctly picking the winner (advancement)
  /** Bonus for also predicting the exact scoreline (excl. penalties). Only set
   *  from the Round of 16 onwards; escalates each round to break ties. */
  scorePoints?: number;
}

export type RoundId = 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL' | 'THIRD';

export type Phase = 'groups' | 'knockout';

export interface Tournament {
  season: string;            // "FIFA World Cup 2026"
  teams: Record<string, Team>;
  groups: Group[];           // 12 groups of 4
  rounds: RoundDef[];
  entryFee: number;          // dollars per entry
  payout: { winner: number; runnerUp: number; drawSplit: number }; // fractions
  /** What the winner & runner-up actually win (physical prizes, not money). */
  prizes: { winner: string; runnerUp: string };
  deadline: string | null;   // ISO; null = not set yet
  knockout: Knockout | null; // null until the admin finalizes the groups
  phase: Phase;              // derived: 'knockout' once `knockout` is set
  /** Real current group standings published by the organizer (group id →
   *  [1st, 2nd, 3rd] team codes, partial allowed). Powers the player-side
   *  "autofill by current group standings" shortcut. Null until published. */
  liveStandings: Record<string, string[]> | null;
}

/**
 * A player's predictions. Keys:
 *   GROUP PHASE (predict each group's finishing order):
 *     g-A-1..g-L-1 → predicted winner (1st)
 *     g-A-2..g-L-2 → predicted runner-up (2nd)
 *     g-A-3..g-L-3 → predicted third place (3rd)
 *   KNOCKOUT PHASE (predict the real bracket, once finalized):
 *     m1..m16  → winner of each Round-of-32 fixture
 *     r16-1..8 → winner of each Round-of-16 fixture
 *     qf-1..4  → winner of each Quarter-Final
 *     sf-1..2  → winner of each Semi-Final
 *     final    → champion
 *     third    → winner of the 3rd-place playoff (the two SF losers)
 * Value is always a team code.
 */
export type Picks = Record<string, string>;

export type EntryStatus = 'draft' | 'submitted';

/** A pool a player has joined, carrying that pool's economics and the player's
 *  per-pool entry state. A `fee` of 0 hides all payment/pot UI for the pool. */
export interface PoolMembership {
  code: string;
  name: string;
  fee: number;        // entry fee in `currency`; 0 = free / payment UI hidden
  currency: string;   // ISO 4217 code
  status: EntryStatus;
  unlocked: boolean;
  submittedAt: string | null;
}

export interface PlayerPublic {
  userId: string;
  name: string;
  email: string;
  picture: string | null;
  paid: boolean;
  status: EntryStatus;
  unlocked: boolean;
  submittedAt: string | null;
  score: number;          // computed from results
  correct: number;        // count of correct advancement picks
}

/** Actual results, filled in by the admin as the tournament progresses. */
export interface Results {
  GROUP?: string[]; // the 32 teams that advanced (24 top-2 + 8 best thirds)
  R32?: string[]; // up to 16 Round-of-32 winners
  R16?: string[]; // up to 8
  QF?: string[];  // up to 4
  SF?: string[];  // up to 2
  FINAL?: string[]; // 1 (champion)
  THIRD?: string[]; // 1 (3rd-place winner)
  /** Actual scorelines (excl. penalties) for knockout matches, keyed by
   *  `${round}:${teamCode}` → [team's goals, opponent's goals] for the team
   *  that ADVANCED. A draw (equal goals, decided on penalties) is stored as the
   *  drawn score. Used to award the correct-score bonus. */
  scores?: Record<string, [number, number]>;
}

export interface SessionUser {
  sub: string;        // synthetic identity from the name slug: `local:<slug>`
  email: string;      // synthetic `<slug>@local` (no real email — name-only auth)
  name: string;
  picture: string | null; // always null (kept for shape compatibility)
}
