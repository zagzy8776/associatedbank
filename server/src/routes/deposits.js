/**
 * Deposit request routes — customer submits, admin approves.
 * Hardened for NOT NULL user_id and optional available_balance.
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { createNotification, createAuditLog } from '../helpers.js';

const router = Router();

// Customer: submit deposit request
router.post('/api/deposits', authMiddleware, async (req, res) => {
  try {
    const { account_id, amount, reference } = req.body || {};
    if (!account_id || amount === undefined) {
      return res.status(400).json({ error: 'Account and amount are required' });
    }
    const amt = parseFloat(typeof amount === 'string' ? String(amount).replace(/,/g, '') : amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const acctRes = await query(
      `SELECT id, currency, status, is_locked FROM accounts WHERE id = $1 AND user_id = $2`,
      [account_id, req.user.id]
    );
    if (!acctRes.rows.length) return res.status(404).json({ error: 'Account not found' });
    const acct = acctRes.rows[0];
    if (acct.is_locked || acct.status === 'blocked' || acct.status === 'closed') {
      return res.status(403).json({ error: 'Account is not eligible for deposits' });
    }

    const { rows } = await query(
      `INSERT INTO deposit_requests (account_id, customer_id, amount, currency, reference)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [account_id, req.user.id, amt, acct.currency, reference || null]
    );

    await query(
      `INSERT INTO activity_log (user_id, action, description, metadata)
       VALUES ($1, 'deposit_request', 'Deposit request submitted', $2)`,
      [req.user.id, JSON.stringify({ deposit_request_id: rows[0].id, amount: amt })]
    ).catch(() => {});

    res.status(201).json({ deposit_request: rows[0] });
  } catch (err) {
    console.error('create deposit request:', err);
    res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

// Customer: list own deposit requests
router.get('/api/deposits', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT dr.*, a.account_number, a.account_name
       FROM deposit_requests dr JOIN accounts a ON a.id = dr.account_id
       WHERE dr.customer_id = $1 ORDER BY dr.created_at DESC`,
      [req.user.id]
    );
    res.json({ deposits: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch deposits' });
  }
});

// Admin: list all deposit requests
router.get('/api/admin/deposits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const status = req.query.status;
    let sql = `SELECT dr.*, a.account_number, p.full_name as customer_name, p.email as customer_email
               FROM deposit_requests dr
               JOIN accounts a ON a.id = dr.account_id
               JOIN profiles p ON p.id = dr.customer_id`;
    const params = [];
    if (status && status !== 'all') {
      sql += ` WHERE dr.status = $1`;
      params.push(status);
    }
    sql += ` ORDER BY dr.created_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json({ deposits: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch deposit requests' });
  }
});

// Admin: approve or reject deposit
router.patch('/api/admin/deposits/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, admin_note } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const result = await withTransaction(async (client) => {
      const depRes = await client.query(
        `SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (!depRes.rows.length) throw new Error('Deposit request not found');
      const dep = depRes.rows[0];
      if (dep.status !== 'pending') throw new Error('Request already reviewed');

      // admin_id may be UUID-only; skip if env admin has non-UUID id
      try {
        await client.query(
          `UPDATE deposit_requests SET status = $1, admin_note = $2, reviewed_at = now() WHERE id = $3`,
          [status, admin_note || null, req.params.id]
        );
      } catch (_
      ) {
        await client.query(
          `UPDATE deposit_requests SET status = $1 WHERE id = $2`,
          [status, req.params.id]
        );
      }

      if (status === 'approved') {
        const amt = parseFloat(dep.amount);
        await client.query(
          `UPDATE accounts SET balance = balance + $1 WHERE id = $2`,
          [amt, dep.account_id]
        );
        try {
          await client.query(
            `UPDATE accounts SET available_balance = COALESCE(available_balance, balance) + $1 WHERE id = $2`,
            [amt, dep.account_id]
          );
        } catch (_) {}

        // Ledger with user_id (required)
        try {
          await client.query(
            `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference, status)
             VALUES ($1, $2, 'deposit', $3, $4, 'Admin-approved deposit', $5, 'completed')`,
            [dep.account_id, dep.customer_id, amt, dep.currency, `DEP-${String(dep.id).slice(0, 8)}`]
          );
        } catch (_) {
          await client.query(
            `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference)
             VALUES ($1, $2, 'deposit', $3, $4, 'Admin-approved deposit', $5)`,
            [dep.account_id, dep.customer_id, amt, dep.currency, `DEP-${String(dep.id).slice(0, 8)}`]
          );
        }

        await createNotification(
          dep.customer_id,
          'deposit_approved',
          'Deposit approved',
          `${amt.toLocaleString('en-GB')} ${dep.currency} has been credited to your account.`,
          { deposit_id: dep.id, amount: dep.amount }
        );
      } else {
        await createNotification(
          dep.customer_id,
          'deposit_rejected',
          'Deposit request rejected',
          admin_note || 'Your deposit request was not approved.',
          { deposit_id: dep.id }
        );
      }

      await createAuditLog(
        req.user?.id,
        `deposit_${status}`,
        'deposit_request',
        dep.id,
        { status: 'pending' },
        { status, admin_note },
        admin_note,
        req.ip
      );
      return { status, id: dep.id };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('deposit review:', err);
    res.status(400).json({ error: err.message || 'Review failed' });
  }
});

export default router;
