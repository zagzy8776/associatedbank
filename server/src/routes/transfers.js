/**
 * Transfer routes — 12-digit + legacy SIM numbers.
 * Optional SQL uses SAVEPOINTs so one failure does not abort the whole TX.
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authMiddleware } from '../auth.js';
import { createNotification } from '../helpers.js';

const router = Router();

function isValidAccountNumber(num) {
  const n = String(num || '').replace(/\s+/g, '').trim();
  if (/^\d{10,14}$/.test(n)) return n;
  if (/^SIM-[A-Z]{3}-\d{8}$/i.test(n)) return n.toUpperCase();
  return null;
}

/** Run fn inside a SAVEPOINT so failure does not abort the outer transaction. */
async function tryInSavepoint(client, name, fn) {
  await client.query(`SAVEPOINT ${name}`);
  try {
    const result = await fn();
    await client.query(`RELEASE SAVEPOINT ${name}`);
    return { ok: true, result };
  } catch (err) {
    await client.query(`ROLLBACK TO SAVEPOINT ${name}`);
    console.warn(`savepoint ${name}:`, err.message);
    return { ok: false, error: err };
  }
}

router.post('/api/transfers', authMiddleware, async (req, res) => {
  try {
    const { from_account_id, to_account_number, amount, reference } = req.body || {};
    if (!from_account_id || !to_account_number || amount === undefined) {
      return res.status(400).json({
        error: 'Sender account, recipient account number, and amount are required',
      });
    }
    const amt = parseFloat(typeof amount === 'string' ? String(amount).replace(/,/g, '') : amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than zero' });
    }

    const cleanTo = isValidAccountNumber(to_account_number);
    if (!cleanTo) {
      return res.status(400).json({
        error:
          'Invalid recipient account number. Use a 12-digit number (e.g. 401837294501) or SIM-XXX-XXXXXXXX.',
      });
    }

    let notifyPayload = null;

    const result = await withTransaction(async (client) => {
      const senderRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [from_account_id, req.user.id]
      );
      if (!senderRes.rows.length) throw new Error('Sender account not found');
      const sender = senderRes.rows[0];

      if (sender.is_locked || (sender.status && sender.status !== 'active')) {
        throw new Error('Your account is not active');
      }

      const bal = parseFloat(sender.balance) || 0;
      const availRaw = sender.available_balance;
      const avail = availRaw == null ? NaN : parseFloat(availRaw);
      const spendable = Number.isFinite(avail) ? avail : bal;
      if (spendable < amt) throw new Error('Insufficient balance');

      const limit = parseFloat(sender.transaction_limit);
      if (Number.isFinite(limit) && amt > limit) {
        throw new Error('Amount exceeds transaction limit');
      }

      const recipientRes = await client.query(
        `SELECT * FROM accounts WHERE account_number = $1 FOR UPDATE`,
        [cleanTo]
      );
      const recipient = recipientRes.rows[0] || null;

      if (recipient && recipient.id === sender.id) {
        throw new Error('Cannot transfer to the same account');
      }
      if (recipient && recipient.currency !== sender.currency) {
        throw new Error(
          `Currency mismatch: your account is ${sender.currency}, recipient is ${recipient.currency}`
        );
      }
      if (
        recipient &&
        (recipient.is_locked || (recipient.status && recipient.status !== 'active'))
      ) {
        throw new Error('Recipient account is not active');
      }

      // 1) Debit balance (required)
      await client.query(`UPDATE accounts SET balance = balance - $1 WHERE id = $2`, [
        amt,
        from_account_id,
      ]);

      // 2) Optional available_balance — SAVEPOINT so failure cannot abort TX
      await tryInSavepoint(client, 'sp_avail_out', async () => {
        await client.query(
          `UPDATE accounts SET available_balance = COALESCE(available_balance, balance) - $1 WHERE id = $2`,
          [amt, from_account_id]
        );
      });

      const ref =
        (reference && String(reference).trim()) ||
        `TRF-${Date.now().toString(36).toUpperCase()}`;
      const descOut = `Transfer to ${cleanTo}`;

      // 3) Sender ledger — always with user_id; try columns with SAVEPOINTS
      let senderTx = null;
      const tx1 = await tryInSavepoint(client, 'sp_tx_out1', async () => {
        return client.query(
          `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference, status)
           VALUES ($1, $2, 'transfer', $3, $4, $5, $6, 'completed') RETURNING *`,
          [from_account_id, req.user.id, -Math.abs(amt), sender.currency, descOut, ref]
        );
      });
      if (tx1.ok) {
        senderTx = tx1.result;
      } else {
        const tx2 = await tryInSavepoint(client, 'sp_tx_out2', async () => {
          return client.query(
            `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference)
             VALUES ($1, $2, 'transfer', $3, $4, $5, $6) RETURNING *`,
            [from_account_id, req.user.id, -Math.abs(amt), sender.currency, descOut, ref]
          );
        });
        if (!tx2.ok) throw new Error('Could not record outgoing transfer');
        senderTx = tx2.result;
      }

      let recipientTx = null;
      let transferType = 'EXTERNAL_TRANSFER';

      if (recipient) {
        await client.query(`UPDATE accounts SET balance = balance + $1 WHERE id = $2`, [
          amt,
          recipient.id,
        ]);
        await tryInSavepoint(client, 'sp_avail_in', async () => {
          await client.query(
            `UPDATE accounts SET available_balance = COALESCE(available_balance, balance) + $1 WHERE id = $2`,
            [amt, recipient.id]
          );
        });

        const descIn = `Transfer from ${sender.account_number}`;
        const rtx1 = await tryInSavepoint(client, 'sp_tx_in1', async () => {
          return client.query(
            `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference, status)
             VALUES ($1, $2, 'transfer', $3, $4, $5, $6, 'completed') RETURNING *`,
            [recipient.id, recipient.user_id, Math.abs(amt), recipient.currency, descIn, ref]
          );
        });
        if (rtx1.ok) {
          recipientTx = rtx1.result;
        } else {
          const rtx2 = await tryInSavepoint(client, 'sp_tx_in2', async () => {
            return client.query(
              `INSERT INTO transactions (account_id, user_id, type, amount, currency, description, reference)
               VALUES ($1, $2, 'transfer', $3, $4, $5, $6) RETURNING *`,
              [recipient.id, recipient.user_id, Math.abs(amt), recipient.currency, descIn, ref]
            );
          });
          if (rtx2.ok) recipientTx = rtx2.result;
        }
        transferType = 'INTERNAL_TRANSFER';
      }

      const senderBal = await client.query(`SELECT balance FROM accounts WHERE id = $1`, [
        from_account_id,
      ]);

      notifyPayload = {
        recipientUserId: recipient?.user_id || null,
        senderUserId: req.user.id,
        amt,
        currency: sender.currency,
        fromNumber: sender.account_number,
        toNumber: cleanTo,
        transferType,
        ref,
      };

      return {
        transfer: senderTx.rows[0],
        recipientTx: recipientTx?.rows[0] || null,
        transferType,
        senderBalance: senderBal.rows[0]?.balance,
        currency: sender.currency,
      };
    });

    // Notifications outside the money transaction (never block the transfer)
    if (notifyPayload) {
      if (notifyPayload.recipientUserId) {
        await createNotification(
          notifyPayload.recipientUserId,
          'transfer_received',
          'Transfer received',
          `You received ${notifyPayload.amt.toLocaleString('en-GB')} ${notifyPayload.currency} from ${notifyPayload.fromNumber}.`,
          {
            amount: notifyPayload.amt,
            from: notifyPayload.fromNumber,
            reference: notifyPayload.ref,
          }
        ).catch(() => {});
      }
      await createNotification(
        notifyPayload.senderUserId,
        'transfer_sent',
        'Transfer successful',
        `You sent ${notifyPayload.amt.toLocaleString('en-GB')} ${notifyPayload.currency} to ${notifyPayload.toNumber}.`,
        {
          amount: notifyPayload.amt,
          to: notifyPayload.toNumber,
          transferType: notifyPayload.transferType,
          reference: notifyPayload.ref,
        }
      ).catch(() => {});
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('transfer error:', err);
    res.status(400).json({ error: err.message || 'Transfer failed' });
  }
});

router.get('/api/transfers', authMiddleware, async (req, res) => {
  try {
    const account_id = req.query.account_id;
    let sql = `SELECT t.*, a.account_number, a.currency as account_currency
               FROM transactions t
               JOIN accounts a ON a.id = t.account_id
               WHERE a.user_id = $1 AND (t.type = 'transfer' OR t.description ILIKE '%transfer%')`;
    const params = [req.user.id];
    if (account_id) {
      sql += ` AND t.account_id = $2`;
      params.push(account_id);
    }
    sql += ` ORDER BY t.created_at DESC LIMIT 100`;
    const { rows } = await query(sql, params);
    res.json({ transfers: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transfers' });
  }
});

export default router;
