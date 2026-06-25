#!/usr/bin/env tsx
/**
 * setup-db.mts — explicit database setup for novo-fifa.
 *
 * Creates the `players` and `app_config` tables. Idempotent — safe to re-run.
 *
 * Usage:
 *   npm run setup:db
 *
 * Requires DATABASE_URL in .env.local (or the shell env).
 */
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '..', '.env.local') });

if (!process.env.DATABASE_URL) {
  console.error('✗ DATABASE_URL is not set. Add it to .env.local first.');
  process.exit(1);
}

const { ensureSchema } = await import('../lib/db.ts');

console.log('→ Running migrations against', maskDbUrl(process.env.DATABASE_URL));
await ensureSchema();
console.log('✓ Schema is up to date (players, app_config).');
process.exit(0);

function maskDbUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '<invalid DATABASE_URL>';
  }
}
