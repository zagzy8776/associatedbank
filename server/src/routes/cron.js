/**
 * External cron endpoints (cron-job.org, EasyCron, etc.)
 * Set CRON_SECRET in env. Call with:
 *   Authorization: Bearer <CRON_SECRET>
 *   or header x-cron-secret: <CRON_SECRET>
 *
 * Example daily job:
 *   POST https://www.rubiconcapital.org/api/cron/daily-digest
 */
import { Router } from 'express';
import { query } from '../db.js';
import { emailAdminDigest } from '../email.js';

const router = Router();

function authorizeCron(req, res, next) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) {
    return res.status(503).json({ error: 'CRON_SECRET not configured on server' });
  }
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const alt = req.headers['x-cron-secret'];
  if (bearer === secret || alt === secret) return next();
  return res.status(401).json({ error: 'Unauthorized cron request' });
}

router.post('/api/cron/daily-digest', authorizeCron, async (req, res) => {
  try {
    const to = (req.body?.to || process.env.ADMIN_EMAIL || process.env.SUPPORT_EMAIL || '').toLowerCase();
    if (!to) return res.status(400).json({ error: 'No ADMIN_EMAIL configured' });

    const deposits = await query(
      `SELECT dr.*, p.full_name as customer_name, p.email as customer_email
       FROM deposit_requests dr
       LEFT JOIN profiles p ON p.id = dr.customer_id
       WHERE dr.status = 'pending'
       ORDER BY dr.created_at ASC LIMIT 50`
    ).catch(() => ({ rows: [] }));

    const pendingReq = await query(
      `SELECT COUNT(*)::int as c FROM account_requests WHERE status = 'pending'`
    ).catch(() => ({ rows: [{ c: 0 }] }));

    const locked = await query(
      `SELECT COUNT(*)::int as c FROM accounts WHERE is_locked = true OR status IN ('blocked','closed')`
    ).catch(() => ({ rows: [{ c: 0 }] }));

    await emailAdminDigest({
      to,
      pendingDeposits: deposits.rows,
      pendingRequests: pendingReq.rows[0]?.c || 0,
      lockedAccounts: locked.rows[0]?.c || 0,
      when: new Date().toUTCString(),
    });

    res.json({
      success: true,
      sent_to: to,
      pending_deposits: deposits.rows.length,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('cron digest:', err);
    res.status(500).json({ error: 'Digest failed' });
  }
});

router.get('/api/cron/health', authorizeCron, (req, res) => {
  res.json({ ok: true, service: 'rubicon-cron' });
});

export default router;
