/**
 * Enhanced admin routes — account controls, audit log, transaction management.
 * Hardened for large balances and system-admin (non-UUID) actor ids.
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { createNotification, createAuditLog } from '../helpers.js';

const router = Router();

// Admin: account status controls
router.post('/api/admin/accounts/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, reason } = req.body;
    const valid = ['block','unblock','close','reopen','lock','unlock','suspend_deposits','suspend_transfers'];
    if (!action || !valid.includes(action)) return res.status(400).json({ error: `Action must be one of: ${valid.join(', ')}` });

    const result = await withTransaction(async (client) => {
      const a = (await client.query(
        `SELECT a.*, p.id as profile_id FROM accounts a JOIN profiles p ON p.id=a.user_id WHERE a.id=$1 FOR UPDATE`,
        [req.params.id]
      )).rows[0];
      if (!a) throw new Error('Account not found');
      const before = { status: a.status, is_locked: a.is_locked };
      let ns = a.status, nl = a.is_locked;
      if (action==='block') ns='blocked'; else if (action==='unblock'||action==='reopen') ns='active';
      else if (action==='close') ns='closed'; else if (action==='lock') nl=true;
      else if (action==='unlock') nl=false; else ns='suspended';

      await client.query(`UPDATE accounts SET status=$1,is_locked=$2 WHERE id=$3`,[ns,nl,req.params.id]);
      await client.query(`UPDATE profiles SET account_status=$1 WHERE id=$2`,[ns,a.profile_id]);

      const labels = {block:'blocked',unblock:'unblocked',close:'closed',reopen:'reopened',lock:'locked',unlock:'unlocked',suspend_deposits:'suspended',suspend_transfers:'suspended'};
      await createNotification(a.profile_id,`account_${action}`,`Account ${labels[action]}`,
        `Your account has been ${labels[action]}.${reason?` Reason: ${reason}`:''}`,{account_id:a.id,action,reason});
      await createAuditLog(req.user.id,action,'account',a.id,before,{status:ns,is_locked:nl},reason,req.ip);
      return { status:ns, is_locked:nl };
    });
    res.json({ success:true, ...result });
  } catch(err){ res.status(400).json({error:err.message||'Action failed'}); }
});

// Admin: adjust account balance (supports huge credits)
router.post('/api/admin/accounts/:id/adjust', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { amount, reason, description } = req.body;
    const raw = typeof amount === 'string' ? amount.replace(/,/g, '') : amount;
    const amt = parseFloat(raw);
    if (!Number.isFinite(amt) || amt === 0) return res.status(400).json({ error: 'Valid non-zero amount required' });
    const result = await withTransaction(async (client) => {
      const a = (await client.query(`SELECT * FROM accounts WHERE id=$1 FOR UPDATE`, [req.params.id])).rows[0];
      if (!a) throw new Error('Account not found');
      const current = parseFloat(a.balance) || 0;
      const nb = current + amt;
      if (nb < 0) throw new Error('Resulting balance cannot be negative');
      await client.query(
        `UPDATE accounts
         SET balance = $1,
             available_balance = COALESCE(available_balance, balance, 0) + $2,
             updated_at = now()
         WHERE id = $3`,
        [nb, amt, req.params.id]
      );
      await client.query(
        `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', now())`,
        [
          req.params.id,
          a.user_id,
          amt > 0 ? 'admin_credit' : 'admin_debit',
          amt,
          a.currency,
          description || `Admin ${amt > 0 ? 'credit' : 'debit'}`,
          `ADJ-${Date.now().toString(36).toUpperCase()}`,
        ]
      );
      await createNotification(
        a.user_id,
        `balance_${amt > 0 ? 'credit' : 'debit'}`,
        `Balance ${amt > 0 ? 'credited' : 'debited'}`,
        `${Math.abs(amt).toLocaleString('en-GB')} ${a.currency} ${amt > 0 ? 'added to' : 'removed from'} your account.`,
        { account_id: a.id, amount: amt, reason }
      );
      await createAuditLog(req.user.id, 'balance_adjust', 'account', a.id, { balance: current }, { balance: nb }, reason, req.ip);
      return { newBalance: nb };
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('accounts/:id/adjust error:', err);
    res.status(400).json({ error: err.message || 'Adjustment failed' });
  }
});

// Admin: add simulated transaction to account
router.post('/api/admin/accounts/:id/transactions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type, amount, description, reference, update_balance, reason } = req.body;
    if (!type || amount === undefined) return res.status(400).json({ error: 'Type and amount required' });
    const amt = parseFloat(typeof amount === 'string' ? amount.replace(/,/g, '') : amount);
    if (!Number.isFinite(amt)) return res.status(400).json({ error: 'Invalid amount' });
    const result = await withTransaction(async (client) => {
      const a = (await client.query(`SELECT * FROM accounts WHERE id=$1 FOR UPDATE`, [req.params.id])).rows[0];
      if (!a) throw new Error('Account not found');
      const tx = await client.query(
        `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', now()) RETURNING *`,
        [
          req.params.id,
          a.user_id,
          type,
          amt,
          a.currency,
          description || `Simulated ${type}`,
          reference || `SIM-${Date.now().toString(36).toUpperCase()}`,
        ]
      );
      if (update_balance) {
        const nb = (parseFloat(a.balance) || 0) + amt;
        if (nb < 0) throw new Error('Resulting balance cannot be negative');
        await client.query(
          `UPDATE accounts
           SET balance = $1,
               available_balance = COALESCE(available_balance, balance, 0) + $2,
               updated_at = now()
           WHERE id = $3`,
          [nb, amt, req.params.id]
        );
      }
      await createAuditLog(req.user.id, 'add_transaction', 'account', a.id, null, { type, amount: amt, description, update_balance }, reason, req.ip);
      return { transaction: tx.rows[0] };
    });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('accounts/:id/transactions error:', err);
    res.status(400).json({ error: err.message || 'Failed' });
  }
});

// Admin: view audit logs
router.get('/api/admin/audit-logs', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { target_type, target_id, limit } = req.query;
    let sql = `SELECT al.*, p.full_name as actor_name FROM audit_logs al LEFT JOIN profiles p ON p.id=al.actor_id`;
    const params = [];
    const conds = [];
    if (target_type) { conds.push(`al.target_type=$${params.length + 1}`); params.push(target_type); }
    if (target_id) { conds.push(`al.target_id=$${params.length + 1}`); params.push(target_id); }
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY al.created_at DESC LIMIT ${Math.min(parseInt(limit) || 100, 500)}`;
    const { rows } = await query(sql, params);
    res.json({ audit_logs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
