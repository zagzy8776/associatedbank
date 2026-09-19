/**
 * Crypto account routes — request, admin approval, simulated balances.
 */
import { Router } from 'express';
import { query, withTransaction } from '../db.js';
import { authMiddleware, adminMiddleware } from '../auth.js';
import { createNotification, createAuditLog } from '../helpers.js';
import { getUserContact, voidEmail, sendEmail, layout, escapeHtml, row } from '../email.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const SUPPORTED_ASSETS = ['BTC', 'ETH', 'USDT', 'USDC'];

function generateWalletAddress(asset) {
  return `sim_${asset.toLowerCase()}_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

router.post('/api/crypto', authMiddleware, async (req, res) => {
  try {
    const { asset } = req.body;
    if (!asset || !SUPPORTED_ASSETS.includes(asset.toUpperCase())) {
      return res.status(400).json({ error: `Asset must be one of: ${SUPPORTED_ASSETS.join(', ')}` });
    }
    const existing = await query(
      `SELECT id, status FROM crypto_accounts WHERE customer_id = $1 AND asset = $2`,
      [req.user.id, asset.toUpperCase()]
    );
    if (existing.rows.length && ['pending', 'active'].includes(existing.rows[0].status)) {
      return res.status(409).json({ error: `You already have a ${asset} account (${existing.rows[0].status})` });
    }
    const walletAddress = generateWalletAddress(asset.toUpperCase());
    const { rows } = await query(
      `INSERT INTO crypto_accounts (customer_id, asset, wallet_address, status)
       VALUES ($1, $2, $3, 'pending') RETURNING *`,
      [req.user.id, asset.toUpperCase(), walletAddress]
    );
    res.status(201).json({ crypto_account: rows[0] });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create crypto request' }); }
});

router.get('/api/crypto', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM crypto_accounts WHERE customer_id = $1 ORDER BY created_at DESC`, [req.user.id]
    );
    res.json({ crypto_accounts: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch crypto accounts' }); }
});

router.get('/api/crypto/:id/transactions', authMiddleware, async (req, res) => {
  try {
    const acct = await query(
      `SELECT id FROM crypto_accounts WHERE id = $1 AND customer_id = $2`, [req.params.id, req.user.id]
    );
    if (!acct.rows.length) return res.status(404).json({ error: 'Crypto account not found' });
    const { rows } = await query(
      `SELECT * FROM crypto_transactions WHERE crypto_account_id = $1 ORDER BY created_at DESC`, [req.params.id]
    );
    res.json({ transactions: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch crypto transactions' }); }
});

router.get('/api/admin/crypto', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const status = req.query.status;
    let sql = `SELECT ca.*, p.full_name, p.email FROM crypto_accounts ca
               JOIN profiles p ON p.id = ca.customer_id`;
    const params = [];
    if (status && status !== 'all') { sql += ` WHERE ca.status = $1`; params.push(status); }
    sql += ` ORDER BY ca.created_at DESC LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json({ crypto_accounts: rows });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch crypto accounts' }); }
});

router.patch('/api/admin/crypto/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!['active', 'rejected', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status must be active, rejected, or suspended' });
    }
    const cryptoRes = await query(`SELECT * FROM crypto_accounts WHERE id = $1`, [req.params.id]);
    if (!cryptoRes.rows.length) return res.status(404).json({ error: 'Crypto account not found' });
    const crypto = cryptoRes.rows[0];

    try {
      await query(
        `UPDATE crypto_accounts SET status=$1, admin_id=$2, admin_note=$3, updated_at=now() WHERE id=$4`,
        [status, req.user.id, admin_note || null, req.params.id]
      );
    } catch (_) {
      await query(
        `UPDATE crypto_accounts SET status=$1, admin_note=$2, updated_at=now() WHERE id=$3`,
        [status, admin_note || null, req.params.id]
      );
    }
    await createNotification(crypto.customer_id, `crypto_${status}`,
      status === 'active' ? 'Crypto account approved' : `Crypto account ${status}`,
      `Your ${crypto.asset} account has been ${status}.`, { crypto_account_id: crypto.id });
    await createAuditLog(req.user.id, `crypto_${status}`, 'crypto_account', crypto.id,
      { status: crypto.status }, { status }, admin_note, req.ip);

    voidEmail((async () => {
      const contact = await getUserContact(crypto.customer_id);
      if (!contact?.email) return;
      const title = status === 'active' ? 'Crypto account approved' : `Crypto account ${status}`;
      const html = layout({
        title,
        preheader: `Your ${crypto.asset} account is now ${status}.`,
        bodyHtml: `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#cbd5e1;">Hello ${escapeHtml((contact.full_name || '').split(' ')[0] || 'Client')}, your <strong style="color:#f8fafc;">${escapeHtml(crypto.asset)}</strong> account is now <strong>${escapeHtml(status)}</strong>.</p>
          <table role="presentation" width="100%">${row('Asset', escapeHtml(crypto.asset))}${row('Wallet', escapeHtml(crypto.wallet_address || '—'))}${row('Status', escapeHtml(status))}</table>`,
      });
      await sendEmail({ to: contact.email, subject: `Rubicon Capital — ${title}`, html });
    })());

    res.json({ success: true });
  } catch (err) { res.status(400).json({ error: err.message || 'Failed to update' }); }
});

router.post('/api/admin/crypto/:id/adjust', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { amount, transaction_type, reason } = req.body;
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt === 0) return res.status(400).json({ error: 'Valid amount required' });

    const result = await withTransaction(async (client) => {
      const c = await client.query(`SELECT * FROM crypto_accounts WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!c.rows.length) throw new Error('Crypto account not found');
      const crypto = c.rows[0];
      const newBal = parseFloat(crypto.balance) + amt;
      if (newBal < 0) throw new Error('Insufficient crypto balance');

      await client.query(`UPDATE crypto_accounts SET balance=$1, updated_at=now() WHERE id=$2`, [newBal, req.params.id]);
      const txType = transaction_type || (amt > 0 ? 'ADMIN_CRYPTO_CREDIT' : 'ADMIN_CRYPTO_DEBIT');
      await client.query(
        `INSERT INTO crypto_transactions (crypto_account_id, transaction_type, amount, asset, reference, status)
         VALUES ($1, $2, $3, $4, $5, 'completed')`,
        [req.params.id, txType, amt, crypto.asset, reason || 'Admin adjustment']
      );
      await createNotification(crypto.customer_id, 'crypto_adjustment', 'Crypto balance adjusted',
        `Your ${crypto.asset} balance adjusted by ${amt > 0 ? '+' : ''}${amt.toFixed(8)} ${crypto.asset}.`,
        { crypto_account_id: crypto.id, amount: amt });
      await createAuditLog(req.user.id, 'crypto_adjust', 'crypto_account', crypto.id,
        { balance: crypto.balance }, { balance: newBal }, reason, req.ip);

      voidEmail((async () => {
        const contact = await getUserContact(crypto.customer_id);
        if (!contact?.email) return;
        const html = layout({
          title: 'Crypto balance adjusted',
          preheader: `${crypto.asset} balance updated.`,
          bodyHtml: `<p style="margin:0 0 8px;font-size:24px;font-weight:700;color:#f8fafc;">${amt > 0 ? '+' : ''}${amt} ${escapeHtml(crypto.asset)}</p>
            <table role="presentation" width="100%">${row('New balance', escapeHtml(String(newBal)))}${row('Asset', escapeHtml(crypto.asset))}</table>`,
        });
        await sendEmail({ to: contact.email, subject: `Rubicon Capital — ${crypto.asset} balance updated`, html });
      })());

      return { newBalance: newBal };
    });
    res.json({ success: true, ...result });
  } catch (err) { res.status(400).json({ error: err.message || 'Adjustment failed' }); }
});

export default router;
