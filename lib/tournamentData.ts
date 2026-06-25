import type { Team, Group, RoundDef, Tournament } from './types';

// ──────────────────────────────────────────────────────────────────────────
// SEED DATA — FIFA World Cup 2026 group stage.
//
// 32 teams in 8 groups of 4. Players predict the top 2 of every group; the
// real group standings then seed the Round of 16 (group winner vs another
// group's runner-up). Scoring, the bracket, and everything else are fully
// data-driven from this object, so editing it is safe.
//
// Ranks/form below are seed values — refresh them from fifa.com in the admin
// panel when you open the pool.
// ──────────────────────────────────────────────────────────────────────────

// The 48 qualified teams. FIFA world rankings are approximate-current values
// (the figure shown as "#rank" and used by the favourite-suggestion hint).
export const TEAMS: Record<string, Team> = {
  ARG: { code: 'ARG', name: 'Argentina', flag: '🇦🇷', rank: 1, form: 'WWWDW' },
  ESP: { code: 'ESP', name: 'Spain', flag: '🇪🇸', rank: 2, form: 'WWWWD' },
  FRA: { code: 'FRA', name: 'France', flag: '🇫🇷', rank: 3, form: 'WWDWL' },
  ENG: { code: 'ENG', name: 'England', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', rank: 4, form: 'WDWWW' },
  BRA: { code: 'BRA', name: 'Brazil', flag: '🇧🇷', rank: 5, form: 'WLWWD' },
  POR: { code: 'POR', name: 'Portugal', flag: '🇵🇹', rank: 6, form: 'WWDWW' },
  NED: { code: 'NED', name: 'Netherlands', flag: '🇳🇱', rank: 7, form: 'DWWLW' },
  BEL: { code: 'BEL', name: 'Belgium', flag: '🇧🇪', rank: 8, form: 'WDLWW' },
  GER: { code: 'GER', name: 'Germany', flag: '🇩🇪', rank: 9, form: 'WWLDW' },
  CRO: { code: 'CRO', name: 'Croatia', flag: '🇭🇷', rank: 10, form: 'DWWDL' },
  MAR: { code: 'MAR', name: 'Morocco', flag: '🇲🇦', rank: 11, form: 'WWWDL' },
  COL: { code: 'COL', name: 'Colombia', flag: '🇨🇴', rank: 12, form: 'WDWWD' },
  URU: { code: 'URU', name: 'Uruguay', flag: '🇺🇾', rank: 13, form: 'WWDLW' },
  JPN: { code: 'JPN', name: 'Japan', flag: '🇯🇵', rank: 14, form: 'WWWDW' },
  USA: { code: 'USA', name: 'USA', flag: '🇺🇸', rank: 15, form: 'WDLWW' },
  MEX: { code: 'MEX', name: 'Mexico', flag: '🇲🇽', rank: 16, form: 'DLWWD' },
  SEN: { code: 'SEN', name: 'Senegal', flag: '🇸🇳', rank: 17, form: 'WDWLW' },
  SUI: { code: 'SUI', name: 'Switzerland', flag: '🇨🇭', rank: 18, form: 'DDWLW' },
  IRN: { code: 'IRN', name: 'IR Iran', flag: '🇮🇷', rank: 19, form: 'WWDDW' },
  KOR: { code: 'KOR', name: 'Korea Republic', flag: '🇰🇷', rank: 20, form: 'WDWWL' },
  AUS: { code: 'AUS', name: 'Australia', flag: '🇦🇺', rank: 21, form: 'WLDWW' },
  ECU: { code: 'ECU', name: 'Ecuador', flag: '🇪🇨', rank: 22, form: 'DWWDL' },
  AUT: { code: 'AUT', name: 'Austria', flag: '🇦🇹', rank: 23, form: 'WWLWD' },
  TUR: { code: 'TUR', name: 'Türkiye', flag: '🇹🇷', rank: 24, form: 'WWDWL' },
  NOR: { code: 'NOR', name: 'Norway', flag: '🇳🇴', rank: 25, form: 'WWWWD' },
  EGY: { code: 'EGY', name: 'Egypt', flag: '🇪🇬', rank: 26, form: 'WDWLW' },
  CAN: { code: 'CAN', name: 'Canada', flag: '🇨🇦', rank: 27, form: 'LWWDW' },
  CIV: { code: 'CIV', name: "Côte d'Ivoire", flag: '🇨🇮', rank: 28, form: 'WWDLW' },
  PAN: { code: 'PAN', name: 'Panama', flag: '🇵🇦', rank: 29, form: 'WDLDW' },
  PAR: { code: 'PAR', name: 'Paraguay', flag: '🇵🇾', rank: 30, form: 'DDWLD' },
  SCO: { code: 'SCO', name: 'Scotland', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', rank: 31, form: 'WDWWL' },
  SWE: { code: 'SWE', name: 'Sweden', flag: '🇸🇪', rank: 32, form: 'WDLWW' },
  ALG: { code: 'ALG', name: 'Algeria', flag: '🇩🇿', rank: 33, form: 'WWDWL' },
  TUN: { code: 'TUN', name: 'Tunisia', flag: '🇹🇳', rank: 34, form: 'WDLDW' },
  CZE: { code: 'CZE', name: 'Czechia', flag: '🇨🇿', rank: 35, form: 'WLWDW' },
  KSA: { code: 'KSA', name: 'Saudi Arabia', flag: '🇸🇦', rank: 36, form: 'DWLDW' },
  COD: { code: 'COD', name: 'DR Congo', flag: '🇨🇩', rank: 37, form: 'WDWLD' },
  UZB: { code: 'UZB', name: 'Uzbekistan', flag: '🇺🇿', rank: 38, form: 'WWDLW' },
  QAT: { code: 'QAT', name: 'Qatar', flag: '🇶🇦', rank: 39, form: 'LDWLD' },
  IRQ: { code: 'IRQ', name: 'Iraq', flag: '🇮🇶', rank: 40, form: 'DWDWL' },
  JOR: { code: 'JOR', name: 'Jordan', flag: '🇯🇴', rank: 41, form: 'DWWDL' },
  RSA: { code: 'RSA', name: 'South Africa', flag: '🇿🇦', rank: 42, form: 'WDLWW' },
  CPV: { code: 'CPV', name: 'Cabo Verde', flag: '🇨🇻', rank: 43, form: 'WDWWL' },
  BIH: { code: 'BIH', name: 'Bosnia & Herzegovina', flag: '🇧🇦', rank: 44, form: 'WWDLW' },
  NZL: { code: 'NZL', name: 'New Zealand', flag: '🇳🇿', rank: 45, form: 'WWDWW' },
  CUW: { code: 'CUW', name: 'Curaçao', flag: '🇨🇼', rank: 46, form: 'WDDWL' },
  HAI: { code: 'HAI', name: 'Haiti', flag: '🇭🇹', rank: 47, form: 'LDWLW' },
  GHA: { code: 'GHA', name: 'Ghana', flag: '🇬🇭', rank: 48, form: 'LWDWL' },
};

// The real 2026 FIFA World Cup draw (Washington DC, 5 Dec 2025). 12 groups of 4
// listed in seeding/pot order (the seeded team first). The R32 seeding template
// below keeps the winners of Groups A and B (hosts Mexico & Canada) in opposite
// halves so they can only meet in the Final.
export const GROUPS: Group[] = [
  { id: 'A', teams: ['MEX', 'KOR', 'RSA', 'CZE'] },
  { id: 'B', teams: ['CAN', 'SUI', 'QAT', 'BIH'] },
  { id: 'C', teams: ['BRA', 'MAR', 'SCO', 'HAI'] },
  { id: 'D', teams: ['USA', 'AUS', 'PAR', 'TUR'] },
  { id: 'E', teams: ['GER', 'ECU', 'CIV', 'CUW'] },
  { id: 'F', teams: ['NED', 'JPN', 'TUN', 'SWE'] },
  { id: 'G', teams: ['BEL', 'IRN', 'EGY', 'NZL'] },
  { id: 'H', teams: ['ESP', 'URU', 'KSA', 'CPV'] },
  { id: 'I', teams: ['FRA', 'SEN', 'NOR', 'IRQ'] },
  { id: 'J', teams: ['ARG', 'AUT', 'ALG', 'JOR'] },
  { id: 'K', teams: ['POR', 'COL', 'UZB', 'COD'] },
  { id: 'L', teams: ['ENG', 'CRO', 'PAN', 'GHA'] },
];

// Round-of-32 fixture template, resolved to real teams when the admin finalizes
// the groups (see lib/knockout.ts). Each side is a seed slot:
//   'W<G>' group winner · 'R<G>' group runner-up · 'T' one of the 8 best thirds.
// 12 winners + 12 runners-up + 8 thirds = 32 teams across 16 fixtures. Halves
// are arranged so the top seeds (winners of A and B) can only meet in the Final.
// Source: Official FIFA 2026 draw + ESPN bracket (espn.com/soccer/bracket/_/season/2026/league/fifa.world)
// Dates are ET kickoff times. Left half (m1-m8) and right half (m9-m16) fan out from the Final.
// WA/WB = host nations Mexico/Canada are in opposite halves — they can only meet in the Final.
export const R32_TEMPLATE: Array<{ id: string; a: string; b: string; date: string }> = [
  { id: 'm1',  a: 'RA', b: 'RB', date: '2026-06-28T15:00' }, // ┐ r16-1  (ESPN m73)
  { id: 'm2',  a: 'WF', b: 'RC', date: '2026-06-29T21:00' }, // ┘         (ESPN m75)
  { id: 'm3',  a: 'WE', b: 'T',  date: '2026-06-29T16:30' }, // ┐ r16-2  (ESPN m74)
  { id: 'm4',  a: 'WI', b: 'T',  date: '2026-06-30T17:00' }, // ┘         (ESPN m77)
  { id: 'm5',  a: 'WC', b: 'RF', date: '2026-06-29T13:00' }, // ┐ r16-3  (ESPN m76)
  { id: 'm6',  a: 'RE', b: 'RI', date: '2026-06-30T13:00' }, // ┘         (ESPN m78)
  { id: 'm7',  a: 'WA', b: 'T',  date: '2026-06-30T21:00' }, // ┐ r16-4  (ESPN m79) — Mexico
  { id: 'm8',  a: 'WL', b: 'T',  date: '2026-07-01T12:00' }, // ┘         (ESPN m80)
  { id: 'm9',  a: 'WD', b: 'T',  date: '2026-07-01T20:00' }, // ┐ r16-5  (ESPN m81) — USA
  { id: 'm10', a: 'WG', b: 'T',  date: '2026-07-01T16:00' }, // ┘         (ESPN m82)
  { id: 'm11', a: 'RK', b: 'RL', date: '2026-07-02T19:00' }, // ┐ r16-6  (ESPN m83)
  { id: 'm12', a: 'WH', b: 'RJ', date: '2026-07-02T15:00' }, // ┘         (ESPN m84)
  { id: 'm13', a: 'WB', b: 'T',  date: '2026-07-02T23:00' }, // ┐ r16-7  (ESPN m85) — Switzerland
  { id: 'm14', a: 'WK', b: 'T',  date: '2026-07-03T21:30' }, // ┘         (ESPN m87)
  { id: 'm15', a: 'WJ', b: 'RH', date: '2026-07-03T18:00' }, // ┐ r16-8  (ESPN m86) — Argentina
  { id: 'm16', a: 'RD', b: 'RG', date: '2026-07-03T14:00' }, // ┘         (ESPN m88)
];

export const ROUNDS: RoundDef[] = [
  { id: 'GROUP', name: 'Group Stage', points: 0 }, // no points — scoring starts at R32
  { id: 'R32', name: 'Round of 32', points: 1 },
  // From R16 on, an exact-scoreline bonus (escalating) is added to break ties.
  { id: 'R16', name: 'Round of 16', points: 2, scorePoints: 2 },
  { id: 'QF', name: 'Quarter-Finals', points: 3, scorePoints: 2 },
  { id: 'SF', name: 'Semi-Finals', points: 5, scorePoints: 2 },
  { id: 'FINAL', name: 'Final', points: 10, scorePoints: 2 },
  { id: 'THIRD', name: 'Third Place', points: 5, scorePoints: 2 },
];

export const DEFAULT_TOURNAMENT: Tournament = {
  season: 'FIFA World Cup 2026',
  teams: TEAMS,
  groups: GROUPS,
  rounds: ROUNDS,
  entryFee: 10,
  payout: { winner: 0.8, runnerUp: 0.2, drawSplit: 0.5 },
  prizes: { winner: '2 Official Soccer Jerseys', runnerUp: '1 Official Soccer Jersey' },
  deadline: null,
  knockout: null,
  phase: 'groups',
  liveStandings: null,
};
