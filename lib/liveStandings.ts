import { getTournament } from './poolConfig';
import type { Team } from './types';

// Fetches today's live group standings from ESPN's public FIFA World Cup API,
// maps them onto our groups/teams, and caches the result briefly (standings
// change only as matches finish). Used by both the player-facing "live group
// standings" display and the admin's autofill.

const ESPN_URL = 'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';
const TTL_MS = 60_000;

export interface LiveRow {
  code: string;        // our team code (or '' if unmapped)
  name: string;        // our display name
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}
export interface LiveGroup {
  id: string;
  rows: LiveRow[]; // ordered by current standing (1st → 4th)
}
export interface LiveTable {
  groups: LiveGroup[];
  source: string;
  fetchedAt: string;
}

let cache: { table: LiveTable; at: number } | null = null;

const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s: string) => stripDiacritics(s || '').toLowerCase().replace(/[^a-z]/g, '');

// Collapse common name variants so ESPN's naming matches our seed regardless of
// which spelling either side uses (e.g. "Korea Republic" vs "South Korea").
const ALIASES: Record<string, string> = {
  southkorea: 'korea', republicofkorea: 'korea', koreareublic: 'korea', koreareplublic: 'korea', kor: 'korea',
  czechrepublic: 'czechia', czech: 'czechia',
  unitedstates: 'usa', unitedstatesofamerica: 'usa', us: 'usa', ussoccer: 'usa',
  ivorycoast: 'cotedivoire',
  iriran: 'iran', islamicrepublicofiran: 'iran',
  turkiye: 'turkey',
  bosniaandherzegovina: 'bosnia',
  capeverde: 'caboverde',
  northmacedonia: 'macedonia',
  drcongo: 'congodr', democraticrepublicofthecongo: 'congodr',
};
const canon = (s: string) => {
  const n = norm(s);
  return ALIASES[n] || n;
};

function matchCode(
  team: { abbreviation?: string; displayName?: string; location?: string; name?: string; shortDisplayName?: string },
  codes: string[],
  teams: Record<string, Team>,
  used: Set<string>
): string | null {
  // 1) FIFA 3-letter abbreviation — the most reliable signal.
  const ab = (team.abbreviation || '').toUpperCase();
  if (codes.includes(ab) && !used.has(ab)) {
    used.add(ab);
    return ab;
  }
  // 2) Canonicalized name match (diacritics + spelling variants folded).
  const theirs = [team.displayName, team.location, team.name, team.shortDisplayName, team.abbreviation]
    .map((x) => canon(x || ''))
    .filter(Boolean);
  for (const c of codes) {
    if (used.has(c)) continue;
    const ours = [c, teams[c]?.name || ''].map((x) => canon(x)).filter(Boolean);
    if (ours.some((o) => theirs.includes(o))) {
      used.add(c);
      return c;
    }
  }
  return null;
}

export async function getLiveTable(): Promise<LiveTable> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.table;

  const t = await getTournament();
  const r = await fetch(ESPN_URL, { headers: { 'User-Agent': 'novo-fifa/1.0' } });
  if (!r.ok) throw new Error(`ESPN returned ${r.status}`);
  const espn: any = await r.json();

  const byGroup: Record<string, any> = {};
  for (const c of espn.children || []) byGroup[c.name] = c;

  const groups: LiveGroup[] = [];
  for (const g of t.groups) {
    const ch = byGroup[`Group ${g.id}`];
    const entries: any[] = ch?.standings?.entries || [];
    if (entries.length < 4) continue;

    const used = new Set<string>();
    const codes: (string | null)[] = entries.map((e) => matchCode(e.team, g.teams, t.teams, used));
    // Only auto-assign the remaining code when there's exactly ONE gap and ONE
    // leftover (unambiguous). Never guess across multiple unmatched rows — that
    // silently mislabels the standing order. Unmatched rows keep code '' (the
    // ESPN display name still shows) so the admin can map them by hand.
    const gaps = codes.filter((c) => !c).length;
    const leftover = g.teams.filter((c) => !codes.includes(c));
    if (gaps === 1 && leftover.length === 1) {
      for (let i = 0; i < codes.length; i++) if (!codes[i]) codes[i] = leftover[0];
    }

    const stat = (e: any, n: string) => Number(e?.stats?.find((s: any) => s.name === n)?.value ?? 0);
    const rows: LiveRow[] = entries.map((e, i) => {
      const code = codes[i] || '';
      return {
        code,
        name: t.teams[code]?.name || e.team.displayName || code,
        played: stat(e, 'gamesPlayed'),
        w: stat(e, 'wins'),
        d: stat(e, 'ties'),
        l: stat(e, 'losses'),
        gf: stat(e, 'pointsFor'),
        ga: stat(e, 'pointsAgainst'),
        gd: stat(e, 'pointDifferential'),
        pts: stat(e, 'points'),
      };
    });
    // Order the table by the standings rules we use: most points first, then
    // goal difference, then goals scored. (Don't rely on the feed's order.)
    rows.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
    groups.push({ id: g.id, rows });
  }

  const table: LiveTable = { groups, source: 'ESPN', fetchedAt: new Date().toISOString() };
  cache = { table, at: Date.now() };
  return table;
}

/** Derive the admin autofill payload (each group's 1/2/3 + 8 best thirds). */
export function deriveAutofill(table: LiveTable) {
  const standings: Record<string, { first: string; second: string; third: string }> = {};
  const thirds: { code: string; pts: number; gd: number; gf: number }[] = [];
  for (const g of table.groups) {
    if (g.rows.length < 3) continue;
    standings[g.id] = { first: g.rows[0].code, second: g.rows[1].code, third: g.rows[2].code };
    const x = g.rows[2];
    if (x.code) thirds.push({ code: x.code, pts: x.pts, gd: x.gd, gf: x.gf });
  }
  const advancingThirds = thirds
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
    .slice(0, 8)
    .map((x) => x.code);
  return { standings, advancingThirds, matchedGroups: table.groups.length };
}
