import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/adminAuth';
import { getPools, setPools, getPoolEntries, deletePoolEntries, hasDatabase } from '@/lib/db';
import type { Pool } from '@/lib/db';
import { isSupportedCurrency, DEFAULT_CURRENCY } from '@/lib/currency';

/**
 * Manage the pools players can join by code. Codes are upper-cased and unique.
 * Each pool carries its own entry fee + currency (fee 0 = free / payment hidden).
 *
 * GET    → pools (with fee/currency) + member + submitted counts
 * POST   → { code, name, fee?, currency? } create a pool
 * PUT    → { code, name?, fee?, currency? } edit an existing pool
 * DELETE → { code } remove a pool (entries in it are left as-is)
 */
function normalizeFee(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return;
  if (!hasDatabase()) return res.status(400).json({ error: 'No database configured.' });

  if (req.method === 'GET') {
    const pools = await getPools();
    const withCounts = await Promise.all(
      pools.map(async (p) => {
        const entries = await getPoolEntries(p.code);
        return {
          ...p,
          fee: typeof p.fee === 'number' ? p.fee : 0,
          currency: p.currency || DEFAULT_CURRENCY,
          memberCount: entries.length,
          submittedCount: entries.filter((x) => x.status === 'submitted').length,
        };
      })
    );
    return res.status(200).json({ pools: withCounts });
  }

  if (req.method === 'POST') {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const name = String(req.body?.name || '').trim() || code;
    if (!code) return res.status(400).json({ error: 'Pool code is required.' });
    if (!/^[A-Z0-9-]{2,20}$/.test(code)) {
      return res.status(400).json({ error: 'Code must be 2–20 chars: letters, numbers or dashes.' });
    }
    const fee = normalizeFee(req.body?.fee) ?? 0;
    const currency = isSupportedCurrency(req.body?.currency) ? String(req.body.currency) : DEFAULT_CURRENCY;
    const pools = await getPools();
    if (pools.some((p) => p.code.toUpperCase() === code)) {
      return res.status(409).json({ error: 'A pool with that code already exists.' });
    }
    const next: Pool[] = [...pools, { code, name, fee, currency }];
    await setPools(next);
    return res.status(200).json({ ok: true, pools: next });
  }

  if (req.method === 'PUT') {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const pools = await getPools();
    const idx = pools.findIndex((p) => p.code.toUpperCase() === code);
    if (idx < 0) return res.status(404).json({ error: 'No pool with that code.' });
    const cur = pools[idx];
    const fee = normalizeFee(req.body?.fee);
    const next: Pool = {
      ...cur,
      name: req.body?.name != null ? String(req.body.name).trim() || cur.name : cur.name,
      fee: fee !== undefined ? fee : (typeof cur.fee === 'number' ? cur.fee : 0),
      currency: isSupportedCurrency(req.body?.currency) ? String(req.body.currency) : cur.currency || DEFAULT_CURRENCY,
    };
    const updated = [...pools];
    updated[idx] = next;
    await setPools(updated);
    return res.status(200).json({ ok: true, pools: updated });
  }

  if (req.method === 'DELETE') {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const pools = await getPools();
    const next = pools.filter((p) => p.code.toUpperCase() !== code);
    await deletePoolEntries(code);
    await setPools(next.length ? next : [{ code: 'MAIN', name: 'Main Pool', fee: 0, currency: DEFAULT_CURRENCY }]);
    return res.status(200).json({ ok: true, pools: next });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
