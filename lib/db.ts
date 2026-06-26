import postgres from 'postgres';
import type { Picks, EntryStatus, Results } from './types';
import { newLinkSecret } from './deviceLink';

function parseDevices(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Cached connection — postgres.js pools internally, so reusing the instance
// avoids opening fresh sockets on every query (matters under dev hot-reload).
let cachedSql: ReturnType<typeof postgres> | null = null;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Add your Postgres / Neon connection string to env.');
  }
  if (cachedSql) return cachedSql;
  // SSL is auto-detected from the URL (?sslmode=require for Neon).
  cachedSql = postgres(url, { max: 5, idle_timeout: 20 });
  return cachedSql;
}

/** True if DATABASE_URL is set and looks like a Postgres URL. */
export function hasDatabase(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url || !url.trim()) return false;
  return /^postgres(ql)?:\/\//.test(url.trim());
}

export interface PlayerRow {
  user_id: string;
  email: string;
  name: string;
  picture: string | null;
  paid: boolean;
  status: EntryStatus;
  unlocked: boolean;
  picks: Picks;
  submitted_at: string | null;
  pool_code: string | null;
  device_id: string | null;
  link_secret: string | null;
  linked_devices: string[];
  created_at: string;
  updated_at: string;
}

export interface Pool {
  code: string;
  name: string;
  fee?: number;      // entry fee in `currency`; 0/undefined = free (payment UI hidden)
  currency?: string; // ISO 4217; defaults to USD
}

/** A per-pool bracket entry, optionally joined with the owning player's
 *  identity + global paid flag (for leaderboard/admin rosters). */
export interface EntryRow {
  user_id: string;
  pool_code: string;
  status: EntryStatus;
  unlocked: boolean;
  picks: Picks;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  // Present when joined against players:
  name?: string;
  picture?: string | null;
  email?: string;
  paid?: boolean;
}

let initPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS players (
        user_id       TEXT PRIMARY KEY,
        email         TEXT NOT NULL,
        name          TEXT NOT NULL,
        picture       TEXT,
        paid          BOOLEAN NOT NULL DEFAULT FALSE,
        status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
        unlocked      BOOLEAN NOT NULL DEFAULT FALSE,
        picks         JSONB NOT NULL DEFAULT '{}'::jsonb,
        submitted_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS app_config (
        key         TEXT PRIMARY KEY,
        value       JSONB NOT NULL,
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    // Device-lock column on the player (one name per device). pool_code is
    // legacy (single-pool era) — kept only so we can migrate old rows below.
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS pool_code TEXT`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS device_id TEXT`;

    // Device linking: a per-player secret (for the rotating add-a-device code)
    // and the set of devices authorized to act as this player.
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS link_secret TEXT`;
    await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS linked_devices JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await sql`UPDATE players SET link_secret = md5(random()::text || user_id || clock_timestamp()::text) WHERE link_secret IS NULL`;
    // Seed the first claiming device into the linked set.
    await sql`UPDATE players SET linked_devices = jsonb_build_array(device_id) WHERE device_id IS NOT NULL AND linked_devices = '[]'::jsonb`;

    // Per-(player, pool) entry: a player has a SEPARATE bracket in each pool
    // they join. Membership = an entry row exists. Identity + the global `paid`
    // flag stay on `players`.
    await sql`
      CREATE TABLE IF NOT EXISTS entries (
        user_id       TEXT NOT NULL,
        pool_code     TEXT NOT NULL,
        status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
        unlocked      BOOLEAN NOT NULL DEFAULT FALSE,
        picks         JSONB NOT NULL DEFAULT '{}'::jsonb,
        submitted_at  TIMESTAMPTZ,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, pool_code)
      )
    `;

    // One-time backfill: migrate each legacy single-pool player into an entry.
    await sql`
      INSERT INTO entries (user_id, pool_code, status, unlocked, picks, submitted_at)
      SELECT user_id, pool_code, status, unlocked, picks, submitted_at
        FROM players
       WHERE pool_code IS NOT NULL
      ON CONFLICT (user_id, pool_code) DO NOTHING
    `;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

// ── Config (JSONB key/value): deadline, results, tournament overrides ──────

export async function getConfig<T = unknown>(key: string): Promise<T | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT value FROM app_config WHERE key = ${key}`) as unknown as { value: unknown }[];
  const raw = rows[0]?.value;
  if (raw == null) return null;
  // postgres.js returns JSONB as a string — parse so callers get a real object.
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
  return raw as T;
}

export async function setConfig(key: string, value: unknown): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export async function getResults(): Promise<Results> {
  return (await getConfig<Results>('results')) || {};
}

// ── Players ─────────────────────────────────────────────────────────────

function parsePicks(raw: unknown): Picks {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Picks;
    } catch {
      return {};
    }
  }
  return raw as Picks;
}

export async function upsertPlayer(input: {
  userId: string;
  email: string;
  name: string;
  picture: string | null;
  deviceId?: string | null;
}): Promise<PlayerRow> {
  await ensureSchema();
  const sql = getSql();
  const initialDevices = JSON.stringify(input.deviceId ? [input.deviceId] : []);
  const rows = (await sql`
    INSERT INTO players (user_id, email, name, picture, device_id, link_secret, linked_devices)
    VALUES (${input.userId}, ${input.email}, ${input.name}, ${input.picture}, ${input.deviceId ?? null},
            ${newLinkSecret()}, ${initialDevices}::jsonb)
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      picture = COALESCE(EXCLUDED.picture, players.picture),
      -- Bind the first device to claim this entry; never overwrite it once set.
      device_id = COALESCE(players.device_id, EXCLUDED.device_id),
      updated_at = NOW()
    RETURNING *
  `) as unknown as PlayerRow[];
  const row = rows[0];
  row.picks = parsePicks(row.picks);
  row.linked_devices = parseDevices(row.linked_devices);
  return row;
}

export async function getPlayer(userId: string): Promise<PlayerRow | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM players WHERE user_id = ${userId}`) as unknown as PlayerRow[];
  if (!rows[0]) return null;
  rows[0].picks = parsePicks(rows[0].picks);
  rows[0].linked_devices = parseDevices(rows[0].linked_devices);
  return rows[0];
}

export async function getAllPlayers(poolCode?: string): Promise<PlayerRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (poolCode
    ? await sql`SELECT * FROM players WHERE pool_code = ${poolCode} ORDER BY created_at ASC`
    : await sql`SELECT * FROM players ORDER BY created_at ASC`) as unknown as PlayerRow[];
  return rows.map((r) => ({ ...r, picks: parsePicks(r.picks) }));
}

// ── Entries (per player, per pool) ─────────────────────────────────────────

/** Join a pool: create a draft entry if the player isn't already in it.
 *  Additive — never touches other memberships. Returns the entry. */
export async function ensureEntry(userId: string, poolCode: string): Promise<EntryRow> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO entries (user_id, pool_code)
    VALUES (${userId}, ${poolCode})
    ON CONFLICT (user_id, pool_code) DO UPDATE SET updated_at = entries.updated_at
    RETURNING *
  `) as unknown as EntryRow[];
  rows[0].picks = parsePicks(rows[0].picks);
  return rows[0];
}

/** A player's entry in one pool, or null if they haven't joined it. */
export async function getEntry(userId: string, poolCode: string): Promise<EntryRow | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM entries WHERE user_id = ${userId} AND pool_code = ${poolCode}
  `) as unknown as EntryRow[];
  if (!rows[0]) return null;
  rows[0].picks = parsePicks(rows[0].picks);
  return rows[0];
}

/** All pools a player has joined (their per-pool entry state). */
export async function getMemberships(userId: string): Promise<EntryRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM entries WHERE user_id = ${userId} ORDER BY created_at ASC
  `) as unknown as EntryRow[];
  return rows.map((r) => ({ ...r, picks: parsePicks(r.picks) }));
}

/** Admin: delete a player's entry (and its picks) in one pool. If that was the
 *  player's last pool, also remove the player record and free their device lock
 *  so the name/device can be reused. */
export async function deletePlayerEntry(userId: string, poolCode: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM entries WHERE user_id = ${userId} AND pool_code = ${poolCode}`;
  const rest = (await sql`SELECT 1 FROM entries WHERE user_id = ${userId} LIMIT 1`) as unknown as unknown[];
  if (rest.length === 0) {
    await sql`DELETE FROM players WHERE user_id = ${userId}`;
  }
}

/** Delete all entries for a pool, then prune any players who no longer belong
 *  to any pool (no remaining entries). */
export async function deletePoolEntries(poolCode: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM entries WHERE pool_code = ${poolCode}`;
  await sql`
    DELETE FROM players
     WHERE user_id NOT IN (SELECT DISTINCT user_id FROM entries)
  `;
}

/** Every not-yet-submitted entry across all pools — used to auto-fill a random
 *  bracket on behalf of registered no-shows once the deadline passes. */
export async function getDraftEntries(): Promise<EntryRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`SELECT * FROM entries WHERE status = 'draft'`) as unknown as EntryRow[];
  return rows.map((r) => ({ ...r, picks: parsePicks(r.picks) }));
}

/** All entries in a pool, joined with player identity + global paid flag. */
export async function getPoolEntries(poolCode: string): Promise<EntryRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT e.*, p.name, p.picture, p.email, p.paid
      FROM entries e
      JOIN players p ON p.user_id = e.user_id
     WHERE e.pool_code = ${poolCode}
     ORDER BY e.created_at ASC
  `) as unknown as EntryRow[];
  return rows.map((r) => ({ ...r, picks: parsePicks(r.picks) }));
}

/** Any entry already bound to a device, regardless of status — used at sign-in
 *  to enforce one entry per machine. */
export async function findDeviceEntry(deviceId: string): Promise<{ user_id: string; name: string } | null> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT user_id, name FROM players
     WHERE device_id = ${deviceId}
     LIMIT 1
  `) as unknown as { user_id: string; name: string }[];
  return rows[0] || null;
}

/** Is this device authorized to act as the player? */
export function isDeviceLinked(player: PlayerRow, deviceId: string | undefined): boolean {
  if (!deviceId) return false;
  return (player.linked_devices || []).includes(deviceId) || player.device_id === deviceId;
}

/** Add a device to a player's linked set (idempotent). */
export async function linkDevice(userId: string, deviceId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE players
       SET linked_devices = CASE WHEN linked_devices ? ${deviceId}
                                 THEN linked_devices
                                 ELSE linked_devices || to_jsonb(${deviceId}::text) END,
           device_id = COALESCE(device_id, ${deviceId}),
           updated_at = NOW()
     WHERE user_id = ${userId}
  `;
}

/** Clear device links for one player (admin) — lets the real owner re-claim a
 *  name that got claimed by the wrong device. */
export async function resetPlayerDevices(userId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE players SET device_id = NULL, linked_devices = '[]'::jsonb WHERE user_id = ${userId}`;
}

/** Clear all device links (admin escape hatch / new round of testing). */
export async function resetDeviceLocks(): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE players SET device_id = NULL, linked_devices = '[]'::jsonb`;
}

// ── Pools (stored in app_config; default single "MAIN" pool) ──────────────

export async function getPools(): Promise<Pool[]> {
  const pools = await getConfig<Pool[]>('pools');
  if (pools && pools.length) return pools;
  return [{ code: 'MAIN', name: 'Main Pool', fee: 0, currency: 'USD' }];
}

export async function setPools(pools: Pool[]): Promise<void> {
  await setConfig('pools', pools);
}

/** Save a draft for one pool entry (only allowed while it isn't locked). */
export async function saveDraft(userId: string, poolCode: string, picks: Picks): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE entries
       SET picks = ${JSON.stringify(picks)}::jsonb, updated_at = NOW()
     WHERE user_id = ${userId} AND pool_code = ${poolCode}
  `;
}

/** Submit (lock) one pool entry: persist picks, mark submitted, clear unlock. */
export async function submitEntry(userId: string, poolCode: string, picks: Picks): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    UPDATE entries
       SET picks = ${JSON.stringify(picks)}::jsonb,
           status = 'submitted',
           unlocked = FALSE,
           submitted_at = NOW(),
           updated_at = NOW()
     WHERE user_id = ${userId} AND pool_code = ${poolCode}
  `;
}

/** The global per-player paid flag (single payment, regardless of pool count). */
export async function setPaid(userId: string, paid: boolean): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE players SET paid = ${paid}, updated_at = NOW() WHERE user_id = ${userId}`;
}

/** Admin grants a correction: allow one more edit of a submitted pool entry. */
export async function setUnlocked(userId: string, poolCode: string, unlocked: boolean): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  // Unlocking flips status back to 'draft' so the player can edit & resubmit.
  await sql`
    UPDATE entries
       SET unlocked = ${unlocked},
           status = ${unlocked ? 'draft' : 'submitted'},
           updated_at = NOW()
     WHERE user_id = ${userId} AND pool_code = ${poolCode}
  `;
}

/** When the admin finalizes the group stage, reopen every entry so players can
 *  now make their knockout-bracket picks (group picks stay stored and locked,
 *  enforced by the picks API's phase gating). */
export async function reopenAllForKnockout(): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`UPDATE entries SET status = 'draft', unlocked = TRUE, submitted_at = NULL, updated_at = NOW()`;
}
