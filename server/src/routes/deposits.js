/**
 * Deposit request routes — customer submits, admin approves.
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { createNotification, createAuditLog } from '../helpers.js';

const router = Router();

// Customer: submit deposit request
router.post('/api/deposits', authMiddleware, async (req, res) => {
  try {
    const { account_id, amount, reference } = req.body;
    if (!account_id || !amount) return res.status(400).json({ error: 'Account and amount are required' });
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });

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
    );
    res.status(201).json({ deposit_request: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create deposit request' });
  }
});

// Customer: list own deposit requests
router.get('/api/deposits', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT dr.*, a.account_number, a.account_name
       FROM deposit_requests dr JOIN accounts a ON a.id = dr.account_id
       WHERE dr.customer_id = $1 ORDER BY dr.created_at DESC`, [req.user.id]
    );
    res.json({ deposits: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch deposits' }); }
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
    if (status && status !== 'all') { sql += ` WHERE dr.status = $1`; params.push(status); }
    sql += ` ORDER BY dr.created_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json({ deposits: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch deposit requests' }); }
});

// Admin: approve or reject deposit
router.patch('/api/admin/deposits/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });

    const result = await withTransaction(async (client) => {
      const depRes = await client.query(`SELECT * FROM deposit_requests WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!depRes.rows.length) throw new Error('Deposit request not found');
      const dep = depRes.rows[0];
      if (dep.status !== 'pending') throw new Error('Request already reviewed');

      await client.query(
        `UPDATE deposit_requests SET status=$1, admin_id=$2, admin_note=$3, reviewed_at=now() WHERE id=$4`,
        [status, req.user.id, admin_note || null, req.params.id]
      );

      if (status === 'approved') {
        await client.query(
          `UPDATE accounts SET balance = balance + $1, available_balance = available_balance + $1 WHERE id = $2`,
          [parseFloat(dep.amount), dep.account_id]
        );
        await client.query(
          `INSERT INTO transactions (account_id, type, amount, currency, description, reference, status, created_at)
           VALUES ($1, 'deposit', $2, $3, 'Admin-approved deposit', $4, 'completed', now())`,
          [dep.account_id, dep.amount, dep.currency, `DEP-${dep.id.toString().slice(0, 8)}`]
        );
        await createNotification(dep.customer_id, 'deposit_approved', 'Deposit approved',
          `$${parseFloat(dep.amount).toFixed(2)} ${dep.currency} has been credited to your account.`,
          { deposit_id: dep.id, amount: dep.amount });
      } else {
        await createNotification(dep.customer_id, 'deposit_rejected', 'Deposit request rejected',
          admin_note || 'Your deposit request was not approved.', { deposit_id: dep.id });
      }

      await createAuditLog(req.user.id, `deposit_${status}`, 'deposit_request', dep.id,
        { status: 'pending' }, { status, admin_note }, admin_note, req.ip);
      return { status, id: dep.id };
    });

    res.json({ success: true, ...result });
  } catch (err) { res.status(400).json({ error: err.message || 'Review failed' }); }
});

export default router;