import type { NextApiRequest, NextApiResponse } from 'next';
import { requireUser } from '@/lib/session';
import { getEntry, saveDraft, submitEntry, hasDatabase } from '@/lib/db';
import { getTournament, isPastDeadline, resolvePool } from '@/lib/poolConfig';
import { SLOT_KEYS, isComplete, prunePicks, parseGoals } from '@/lib/bracket';
import type { Picks } from '@/lib/types';

// Accept any valid pick slot (group OR knockout) — both are editable until the
// deadline now (knockout is the main game; group picks are an optional fun tab).
// The client sends its full picks object, so this is the source of truth (which
// also lets a cleared slot drop out). prunePicks then keeps it consistent.
function sanitizePicks(input: unknown): Picks {
  const out: Picks = {};
  if (input && typeof input === 'object') {
    for (const k of SLOT_KEYS) {
      const v = (input as Record<string, unknown>)[k];
      if (typeof v !== 'string' || !v) continue;
      if (k.startsWith('sc-')) {
        // Goal counts: keep only valid 0–99 integers, normalized.
        const g = parseGoals(v);
        if (g != null) out[k] = String(g);
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = requireUser(req, res);
  if (!user) return;

  const t = await getTournament();

  if (!hasDatabase()) {
    // No DB: the browser owns persistence (localStorage). Report that so the
    // client knows to keep picks locally.
    if (req.method === 'GET')
      return res.status(200).json({ picks: {}, status: 'draft', unlocked: false, dbEnabled: false });
    return res.status(200).json({ ok: true, dbEnabled: false });
  }

  // Every call is scoped to one pool (a player has a separate bracket per pool).
  const poolCode = String((req.method === 'GET' ? req.query.pool : req.body?.pool) || '').trim().toUpperCase();
  if (!poolCode) return res.status(400).json({ error: 'Missing pool.' });
  const pool = await resolvePool(poolCode);
  if (!pool) return res.status(404).json({ error: 'Unknown pool.' });

  // Membership = an entry row. The player must have joined this pool first.
  const entry = await getEntry(user.sub, pool.code);
  if (!entry) {
    if (req.method === 'GET')
      return res.status(200).json({ picks: {}, status: 'draft', unlocked: false, dbEnabled: true, needsJoin: true });
    return res.status(403).json({ error: 'Join this pool before making picks.' });
  }

  // GET — owner always sees their own picks for this pool.
  if (req.method === 'GET') {
    return res.status(200).json({
      picks: entry.picks,
      status: entry.status,
      unlocked: entry.unlocked,
      submittedAt: entry.submitted_at,
      dbEnabled: true,
    });
  }

  // Picks (and re-submissions) are editable right up until the deadline — a
  // submitted bracket isn't hard-locked, so players get more time to tweak.
  if (isPastDeadline(t.deadline)) {
    return res.status(403).json({ error: 'The submission deadline has passed — picks are locked.' });
  }

  const picks = prunePicks(t, sanitizePicks(req.body?.picks));

  // PUT — save draft (partial allowed).
  if (req.method === 'PUT') {
    await saveDraft(user.sub, pool.code, picks);
    return res.status(200).json({ ok: true, saved: Object.keys(picks).length });
  }

  // POST — submit. Group predictions are optional ("just for fun", 0 points), so
  // only the knockout bracket must be complete to submit.
  if (req.method === 'POST') {
    if (t.phase === 'knockout' && !isComplete(t, picks)) {
      return res.status(400).json({
        error: 'Your bracket is incomplete — pick a winner for every knockout match first.',
      });
    }
    await submitEntry(user.sub, pool.code, picks);
    return res.status(200).json({ ok: true, submitted: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
