/**
 * Enhanced admin routes — account controls, audit log, transaction management.
 * Balance adjust uses SAVEPOINTs; transactions.user_id is always set (NOT NULL).
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { createNotification, createAuditLog } from '../helpers.js';

const router = Router();

/** Run SQL inside a savepoint so failure does not abort the outer transaction. */
async function tryInSavepoint(client, name, fn) {
  await client.query(`SAVEPOINT ${name}`);
  try {
    const result = await fn();
    await client.query(`RELEASE SAVEPOINT ${name}`);
    return { ok: true, result };
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    console.warn(`savepoint ${name} rolled back:`, err.message);
    return { ok: false, error: err };
  }
}

// Admin: account status controls
router.post('/api/admin/accounts/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { action, reason } = req.body;
    const valid = ['block', 'unblock', 'close', 'reopen', 'lock', 'unlock', 'suspend_deposits', 'suspend_transfers'];
    if (!action || !valid.includes(action)) {
      return res.status(400).json({ error: `Action must be one of: ${valid.join(', ')}` });
    }

    const result = await withTransaction(async (client) => {
      const a = (
        await client.query(
          `SELECT a.*, p.id as profile_id FROM accounts a JOIN profiles p ON p.id = a.user_id WHERE a.id = $1 FOR UPDATE`,
          [req.params.id]
        )
      ).rows[0];
      if (!a) throw new Error('Account not found');

      const before = { status: a.status, is_locked: a.is_locked };
      let ns = a.status;
      let nl = a.is_locked;
      if (action === 'block') ns = 'blocked';
      else if (action === 'unblock' || action === 'reopen') ns = 'active';
      else if (action === 'close') ns = 'closed';
      else if (action === 'lock') nl = true;
      else if (action === 'unlock') nl = false;
      else ns = 'suspended';

      await client.query(`UPDATE accounts SET status = $1, is_locked = $2 WHERE id = $3`, [ns, nl, req.params.id]);
      await tryInSavepoint(client, 'sp_profile_status', async () => {
        await client.query(`UPDATE profiles SET account_status = $1 WHERE id = $2`, [ns, a.profile_id]);
      });

      return { status: ns, is_locked: nl, profile_id: a.profile_id, before };
    });

    const labels = {
      block: 'blocked', unblock: 'unblocked', close: 'closed', reopen: 'reopened',
      lock: 'locked', unlock: 'unlocked', suspend_deposits: 'suspended', suspend_transfers: 'suspended',
    };
    await createNotification(
      result.profile_id,
      `account_${action}`,
      `Account ${labels[action]}`,
      `Your account has been ${labels[action]}.${req.body.reason ? ` Reason: ${req.body.reason}` : ''}`,
      { account_id: req.params.id, action, reason: req.body.reason }
    );
    await createAuditLog(
      req.user.id, action, 'account', req.params.id,
      result.before, { status: result.status, is_locked: result.is_locked },
      req.body.reason, req.ip
    );

    res.json({ success: true, status: result.status, is_locked: result.is_locked });
  } catch (err) {
    console.error('account status error:', err);
    res.status(400).json({ error: err.message || 'Action failed' });
  }
});

/**
 * Admin credit/debit.
 * Always writes transactions.user_id from accounts.user_id (column is NOT NULL).
 */
router.post('/api/admin/accounts/:id/adjust', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { amount, reason, description } = req.body || {};
    const raw = typeof amount === 'string' ? String(amount).replace(/,/g, '').trim() : amount;
    const amt = parseFloat(raw);

    if (!Number.isFinite(amt) || amt === 0) {
      return res.status(400).json({ error: 'Valid non-zero amount required' });
    }

    let newBalance;
    let currency;
    let userId;
    let oldBalance;

    await withTransaction(async (client) => {
      const a = (await client.query(`SELECT * FROM accounts WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
      if (!a) throw new Error('Account not found');
      if (!a.user_id) throw new Error('Account has no owner (user_id is null)');

      userId = a.user_id;
      currency = a.currency || 'GBP';
      oldBalance = parseFloat(a.balance) || 0;
      newBalance = oldBalance + amt;
      if (newBalance < 0) throw new Error('Resulting balance cannot be negative');

      // 1) Required balance update
      await client.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [newBalance, req.params.id]);

      // 2) Optional columns — never abort main TX
      await tryInSavepoint(client, 'sp_avail', async () => {
        await client.query(`UPDATE accounts SET available_balance = $1 WHERE id = $2`, [newBalance, req.params.id]);
      });
      await tryInSavepoint(client, 'sp_updated', async () => {
        await client.query(`UPDATE accounts SET updated_at = now() WHERE id = $1`, [req.params.id]);
      });

      // 3) Ledger — user_id is REQUIRED (NOT NULL). Use safe type names.
      const txType = amt > 0 ? 'deposit' : 'withdrawal';
      const desc = description || reason || `Admin ${amt > 0 ? 'credit' : 'debit'}`;
      const ref = `ADJ-${Date.now().toString(36).toUpperCase()}`;

      // Try richest insert first, then minimal — both always include user_id
      const attempt1 = await tryInSavepoint(client, 'sp_tx1', async () => {
        await client.query(
          `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed')`,
          [req.params.id, userId, txType, amt, currency, desc, ref]
        );
      });

      if (!attempt1.ok) {
        const attempt2 = await tryInSavepoint(client, 'sp_tx2', async () => {
          await client.query(
            `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [req.params.id, userId, txType, Math.abs(amt), currency, desc, ref]
          );
        });
        if (!attempt2.ok) {
          // Last resort: absolute minimum columns
          await client.query(
            `INSERT INTO transactions (account_id, user_id, type, amount, currency)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.params.id, userId, txType, Math.abs(amt), currency]
          );
        }
      }
    });

    await createNotification(
      userId,
      amt > 0 ? 'balance_credit' : 'balance_debit',
      `Balance ${amt > 0 ? 'credited' : 'debited'}`,
      `${Math.abs(amt).toLocaleString('en-GB')} ${currency} ${amt > 0 ? 'added to' : 'removed from'} your account.`,
      { account_id: req.params.id, amount: amt, reason }
    );
    await createAuditLog(
      req.user?.id,
      'balance_adjust',
      'account',
      req.params.id,
      { balance: oldBalance },
      { balance: newBalance },
      reason || description,
      req.ip
    );

    res.json({ success: true, newBalance, currency });
  } catch (err) {
    console.error('accounts/:id/adjust error:', err);
    res.status(400).json({ error: err.message || 'Adjustment failed' });
  }
});

// Admin: add simulated transaction
router.post('/api/admin/accounts/:id/transactions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { type, amount, description, reference, update_balance, reason } = req.body || {};
    if (!type || amount === undefined) return res.status(400).json({ error: 'Type and amount required' });
    const amt = parseFloat(typeof amount === 'string' ? String(amount).replace(/,/g, '') : amount);
    if (!Number.isFinite(amt)) return res.status(400).json({ error: 'Invalid amount' });

    const result = await withTransaction(async (client) => {
      const a = (await client.query(`SELECT * FROM accounts WHERE id = $1 FOR UPDATE`, [req.params.id])).rows[0];
      if (!a) throw new Error('Account not found');
      if (!a.user_id) throw new Error('Account has no owner (user_id is null)');

      let txRow = null;
      const attempt1 = await tryInSavepoint(client, 'sp_tx1', async () => {
        const r = await client.query(
          `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed') RETURNING *`,
          [
            req.params.id, a.user_id, type, amt, a.currency,
            description || `Simulated ${type}`,
            reference || `SIM-${Date.now().toString(36).toUpperCase()}`,
          ]
        );
        txRow = r.rows[0];
      });
      if (!attempt1.ok) {
        const r = await client.query(
          `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            req.params.id, a.user_id, type, amt, a.currency,
            description || `Simulated ${type}`,
            reference || `SIM-${Date.now().toString(36).toUpperCase()}`,
          ]
        );
        txRow = r.rows[0];
      }

      if (update_balance) {
        const nb = (parseFloat(a.balance) || 0) + amt;
        if (nb < 0) throw new Error('Resulting balance cannot be negative');
        await client.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [nb, req.params.id]);
        await tryInSavepoint(client, 'sp_avail', async () => {
          await client.query(`UPDATE accounts SET available_balance = $1 WHERE id = $2`, [nb, req.params.id]);
        });
      }

      return { transaction: txRow };
    });

    await createAuditLog(
      req.user?.id, 'add_transaction', 'account', req.params.id,
      null, { type, amount: amt, description, update_balance }, reason, req.ip
    );

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
    let sql = `SELECT al.*, p.full_name as actor_name FROM audit_logs al LEFT JOIN profiles p ON p.id = al.actor_id`;
    const params = [];
    const conds = [];
    if (target_type) {
      conds.push(`al.target_type = $${params.length + 1}`);
      params.push(target_type);
    }
    if (target_id) {
      conds.push(`al.target_id = $${params.length + 1}`);
      params.push(target_id);
    }
    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY al.created_at DESC LIMIT ${Math.min(parseInt(limit) || 100, 500)}`;
    const { rows } = await query(sql, params);
    res.json({ audit_logs: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
