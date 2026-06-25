import type { Picks, Results, Tournament, RoundId } from './types';
import { predictedWinnersByRound, buildBracket, DerivedMatch } from './bracket';

export interface RoundScore {
  round: RoundId;
  name: string;
  points: number;       // points per correct pick this round
  correct: number;      // number of correct advancement picks
  earned: number;       // advancement points + correct-score bonus
  scoreCorrect: number; // matches where the exact scoreline was predicted
}

export interface ScoreBreakdown {
  total: number;
  correct: number;      // total correct picks across all rounds
  byRound: RoundScore[];
}

/**
 * Scoring = advancement + exact-score bonus.
 *  • Advancement: for each round, the round's points for every team a player
 *    predicted to win that round which actually advanced.
 *  • Exact-score bonus (R16 onward): if they picked the team that advanced AND
 *    predicted that team's exact scoreline (its goals + goals conceded, excl.
 *    penalties — a draw counts as a draw), add the round's scorePoints.
 * No negative points; both decouple from bracket-path divergence.
 */
export function scorePicks(
  tournament: Tournament,
  picks: Picks,
  results: Results
): ScoreBreakdown {
  const predicted = predictedWinnersByRound(tournament, picks);
  const bracket = buildBracket(tournament, picks);
  const matchesByRound: Record<string, DerivedMatch[]> = {
    R32: bracket.R32, R16: bracket.R16, QF: bracket.QF, SF: bracket.SF,
    FINAL: [bracket.FINAL], THIRD: [bracket.THIRD], GROUP: [],
  };
  const actualScores = results.scores || {};

  const byRound: RoundScore[] = tournament.rounds.map((rd) => {
    const actual = new Set((results[rd.id] || []).filter(Boolean));
    const mine = predicted[rd.id] || [];
    const correct = mine.filter((code) => actual.has(code)).length;

    // Exact-score bonus: only for matches whose winner pick actually advanced.
    let scoreCorrect = 0;
    const sp = rd.scorePoints || 0;
    if (sp > 0) {
      for (const m of matchesByRound[rd.id] || []) {
        const w = m.winner;
        if (!w || !actual.has(w) || m.scoreA == null || m.scoreB == null) continue;
        const winnerGoals = w === m.a ? m.scoreA : m.scoreB;
        const oppGoals = w === m.a ? m.scoreB : m.scoreA;
        const real = actualScores[`${rd.id}:${w}`];
        if (real && real[0] === winnerGoals && real[1] === oppGoals) scoreCorrect++;
      }
    }

    return {
      round: rd.id,
      name: rd.name,
      points: rd.points,
      correct,
      scoreCorrect,
      earned: correct * rd.points + scoreCorrect * sp,
    };
  });
  return {
    total: byRound.reduce((s, r) => s + r.earned, 0),
    correct: byRound.reduce((s, r) => s + r.correct, 0),
    byRound,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Pot + payouts
// ──────────────────────────────────────────────────────────────────────────

export interface StandingRow {
  userId: string;
  score: number;
  rank: number;        // 1-based, ties share a rank
}

export interface PayoutResult {
  pot: number;
  /** userId -> amount won. Empty until there are scores to rank. */
  awards: Record<string, number>;
  /** Human summary lines for the UI. */
  notes: string[];
}

/**
 * Split a fixed prize pot among the standings.
 *
 * Rules:
 *  - Winner (1st) gets 80% of the prize, runner-up (2nd) gets 20%.
 *  - On a tie for 1st, the tied winners split 50% each and the 20% runner-up
 *    prize is void (nobody gets it).
 *  - A tie for 2nd splits the 20% evenly among those tied.
 */
export function computePayouts(
  standings: StandingRow[],
  pot: number,
  payout: { winner: number; runnerUp: number; drawSplit: number }
): PayoutResult {
  const awards: Record<string, number> = {};
  const notes: string[] = [];

  const ranked = standings.filter((s) => s.score > 0);
  if (pot <= 0 || ranked.length === 0) {
    return { pot, awards, notes: ['No payouts yet.'] };
  }

  const firsts = ranked.filter((s) => s.rank === 1);

  if (firsts.length >= 2) {
    // Tie for first → split 50/50 (drawSplit each), no runner-up prize.
    const share = (pot * payout.drawSplit) / firsts.length;
    firsts.forEach((s) => (awards[s.userId] = round2(share)));
    notes.push(
      `Tie for 1st (${firsts.length} players) — each takes ${pct(payout.drawSplit)} of the prize. No runner-up prize.`
    );
    return { pot, awards, notes };
  }

  // Clear winner.
  awards[firsts[0].userId] = round2(pot * payout.winner);
  notes.push(`1st place takes ${pct(payout.winner)} of the prize.`);

  const seconds = ranked.filter((s) => s.rank === 2);
  if (seconds.length === 1) {
    awards[seconds[0].userId] = round2(pot * payout.runnerUp);
    notes.push(`Runner-up takes ${pct(payout.runnerUp)}.`);
  } else if (seconds.length > 1) {
    const share = (pot * payout.runnerUp) / seconds.length;
    seconds.forEach((s) => (awards[s.userId] = round2(share)));
    notes.push(`Tie for 2nd (${seconds.length} players) — split the ${pct(payout.runnerUp)} runner-up prize.`);
  }

  return { pot, awards, notes };
}

/** Assign 1-based ranks to scores, ties sharing a rank (standard competition ranking). */
export function rankScores(rows: { userId: string; score: number }[]): StandingRow[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const out: StandingRow[] = [];
  let lastScore: number | null = null;
  let lastRank = 0;
  sorted.forEach((row, i) => {
    const rank = lastScore !== null && row.score === lastScore ? lastRank : i + 1;
    out.push({ userId: row.userId, score: row.score, rank });
    lastScore = row.score;
    lastRank = rank;
  });
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function pct(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}
