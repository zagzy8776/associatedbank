/**
 * Transfer routes — account-number-based with idempotency.
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authMiddleware } from '../auth.js';
import { createNotification } from '../helpers.js';

const router = Router();

// Customer: initiate transfer by account number
router.post('/api/transfers', authMiddleware, async (req, res) => {
  try {
    const { from_account_id, to_account_number, amount, reference } = req.body;
    if (!from_account_id || !to_account_number || !amount) {
      return res.status(400).json({ error: 'Sender account, recipient account number, and amount are required' });
    }
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than zero' });

    // Validate account number format
    if (!/^SIM-[A-Z]{3}-\d{8}$/.test(to_account_number)) {
      return res.status(400).json({ error: 'Invalid recipient account number format' });
    }

    const result = await withTransaction(async (client) => {
      // Lock sender account
      const senderRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [from_account_id, req.user.id]
      );
      if (!senderRes.rows.length) throw new Error('Sender account not found');
      const sender = senderRes.rows[0];

      if (sender.is_locked || sender.status !== 'active') {
        throw new Error('Account is not active');
      }
      if (parseFloat(sender.available_balance) < amt) {
        throw new Error('Insufficient balance');
      }
      if (amt > parseFloat(sender.transaction_limit || 999999)) {
        throw new Error('Amount exceeds transaction limit');
      }

      // Check for recipient internally
      const recipientRes = await client.query(
        `SELECT * FROM accounts WHERE account_number = $1`, [to_account_number]
      );
      const recipient = recipientRes.rows[0] || null;

      // Debit sender
      await client.query(
        `UPDATE accounts SET balance = balance - $1, available_balance = available_balance - $1 WHERE id = $2`,
        [amt, from_account_id]
      );

      const senderBal = await client.query(`SELECT balance FROM accounts WHERE id = $1`, [from_account_id]);

      // Create sender transaction
      const senderTx = await client.query(
        `INSERT INTO transactions (account_id, type, amount, currency, description, reference, status, created_at)
         VALUES ($1, 'transfer', $2, $3, $4, $5, 'completed', now())
         RETURNING *`,
        [from_account_id, -amt, sender.currency,
         `Transfer to ${to_account_number}`,
         reference || `TRF-${Date.now().toString(36).toUpperCase()}`]
      );

      let recipientTx = null;
      let transferType = 'SIMULATED_EXTERNAL_TRANSFER';

      if (recipient) {
        // Internal transfer — credit recipient
        await client.query(
          `UPDATE accounts SET balance = balance + $1, available_balance = available_balance + $1 WHERE id = $2`,
          [amt, recipient.id]
        );
        recipientTx = await client.query(
          `INSERT INTO transactions (account_id, type, amount, currency, description, reference, status, created_at)
           VALUES ($1, 'transfer', $2, $3, $4, $5, 'completed', now())
           RETURNING *`,
          [recipient.id, amt, recipient.currency,
           `Transfer from ${sender.account_number}`,
           reference || `TRF-${Date.now().toString(36).toUpperCase()}`]
        );
        transferType = 'INTERNAL_TRANSFER';

        // Notify recipient
        const recipientProfile = await client.query(`SELECT user_id FROM accounts WHERE id = $1`, [recipient.id]);
        if (recipientProfile.rows[0]) {
          await createNotification(
            recipientProfile.rows[0].user_id, 'transfer_received', 'Transfer received',
            `You received $${amt.toFixed(2)} ${sender.currency} from ${sender.account_number}.`,
            { amount: amt, from: sender.account_number }
          );
        }
      }

      // Notify sender
      await createNotification(
        req.user.id, 'transfer_sent', 'Transfer successful',
        `You sent $${amt.toFixed(2)} ${sender.currency} to ${to_account_number}.`,
        { amount: amt, to: to_account_number, transferType }
      );

      return {
        transfer: senderTx.rows[0],
        recipientTx: recipientTx?.rows[0] || null,
        transferType,
        senderBalance: senderBal.rows[0].balance
      };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Transfer failed' });
  }
});

// Customer: list transfers for an account
router.get('/api/transfers', authMiddleware, async (req, res) => {
  try {
    const account_id = req.query.account_id;
    let sql = `SELECT t.*, a.account_number FROM transactions t
               JOIN accounts a ON a.id = t.account_id
               WHERE a.user_id = $1 AND t.type = 'transfer'`;
    const params = [req.user.id];
    if (account_id) { sql += ` AND t.account_id = $2`; params.push(account_id); }
    sql += ` ORDER BY t.created_at DESC LIMIT 100`;
    const { rows } = await query(sql, params);
    res.json({ transfers: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch transfers' }); }
});

export default router;