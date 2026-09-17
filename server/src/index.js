import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { query, withTransaction } from './db.js';
import {
  signToken, hashPassword, comparePassword,
  authMiddleware, adminMiddleware, getProfile
} from './auth.js';
import { runMigrations } from './migrations.js';
import { createNotification, createAuditLog } from './helpers.js';
import depositRoutes from './routes/deposits.js';
import transferRoutes from './routes/transfers.js';
import cryptoRoutes from './routes/crypto.js';
import notificationRoutes from './routes/notifications.js';
import adminRoutes from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
if (!process.env.VERCEL) {
  dotenv.config({ path: join(__dirname, '../../.env') });
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Register new route modules
app.use(depositRoutes);
app.use(transferRoutes);
app.use(cryptoRoutes);
app.use(notificationRoutes);
app.use(adminRoutes);

// ============== AUTH ==============

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) {
      return res.status(400).json({ error: 'Email, password and full name are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = await query('SELECT id FROM profiles WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = await hashPassword(password);
    const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').toLowerCase();
    const role = email.toLowerCase() === OWNER_EMAIL ? 'admin' : 'user';
    const { rows } = await query(
      `INSERT INTO profiles (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [email.toLowerCase(), password_hash, full_name, role]
    );

    const user = rows[0];
    const token = signToken(user);

    await query(
      `INSERT INTO activity_log (user_id, action, description)
       VALUES ($1, 'register', 'New user registered')`,
      [user.id]
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { rows } = await query(
      `SELECT id, email, full_name, role, password_hash, is_locked
       FROM profiles WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];
    if (user.is_locked) {
      return res.status(403).json({ error: 'Account locked. Please contact support.' });
    }

    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await query('UPDATE profiles SET last_login = now() WHERE id = $1', [user.id]);

    const token = signToken(user);
    delete user.password_hash;

    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const profile = await getProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    if (profile.is_locked) {
      return res.status(403).json({ error: 'Account locked. Please contact support.' });
    }
    res.json({ user: profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ============== ADMIN AUTH (separate from customer auth) ==============

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '';

    if (!adminEmail || !adminPassword) {
      return res.status(500).json({ error: 'Admin credentials not configured on server' });
    }
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (email.toLowerCase() !== adminEmail) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    const token = signToken({ id: 'admin-owner', email: adminEmail, role: 'admin' });
    res.json({
      token,
      user: { id: 'admin-owner', email: adminEmail, role: 'admin', full_name: 'Owner' }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

app.get('/api/admin/me', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    res.json({
      user: { id: req.user.id || 'admin-owner', email: req.user.email, role: 'admin', full_name: 'Owner' }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to verify admin session' });
  }
});

// ============== CUSTOMER ACCOUNTS ==============

app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, account_number, account_name, currency, balance, status, is_locked, created_at
       FROM accounts WHERE user_id = $1 ORDER BY created_at`,
      [req.user.id]
    );
    res.json({ accounts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const { currency, account_name } = req.body;
    if (!['GBP', 'USD', 'EUR'].includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency' });
    }

    // One account per currency per customer
    const existing = await query(
      `SELECT id FROM accounts WHERE user_id = $1 AND currency = $2`,
      [req.user.id, currency]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: `You already have a ${currency} account` });
    }

    const { rows } = await query(
      `INSERT INTO accounts (user_id, account_number, currency, account_name, balance)
       VALUES ($1, generate_account_number(), $2, $3, 0)
       RETURNING *`,
      [req.user.id, currency, account_name || `${currency} Account`]
    );

    await query(
      `INSERT INTO activity_log (user_id, action, description, metadata)
       VALUES ($1, 'create_account', $2, $3)`,
      [req.user.id, `Created ${currency} account`, JSON.stringify({ account_id: rows[0].id })]
    );

    res.status(201).json({ account: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/api/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    res.json({ account: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

app.get('/api/accounts/:id/transactions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.* FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE t.account_id = $1 AND a.user_id = $2
       ORDER BY t.created_at DESC LIMIT 100`,
      [req.params.id, req.user.id]
    );
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// ============== TRANSFERS / DEPOSITS / WITHDRAWALS ==============

app.post('/api/transfer', authMiddleware, async (req, res) => {
  try {
    const { from_account_id, to_account_id, amount, description } = req.body;
    const amt = parseFloat(amount);

    if (!from_account_id || !to_account_id || !amt || amt <= 0) {
      return res.status(400).json({ error: 'Invalid transfer data' });
    }

    const result = await withTransaction(async (client) => {
      const fromRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [from_account_id, req.user.id]
      );
      if (!fromRes.rows.length) throw new Error('Source account not found');
      const from = fromRes.rows[0];

      if (from.is_locked || from.status !== 'active') {
        throw new Error('Source account is locked or inactive');
      }
      if (from.balance < amt) throw new Error('Insufficient funds');

      const toRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 FOR UPDATE`,
        [to_account_id]
      );
      if (!toRes.rows.length) throw new Error('Destination account not found');
      const to = toRes.rows[0];

      if (to.is_locked || to.status !== 'active') {
        throw new Error('Destination account is locked or inactive');
      }
      if (from.currency !== to.currency) {
        throw new Error('Cross-currency transfers not supported in this version. Use same currency.');
      }

      await client.query(
        `UPDATE accounts SET balance = balance - $1, updated_at = now() WHERE id = $2`,
        [amt, from_account_id]
      );
      await client.query(
        `UPDATE accounts SET balance = balance + $1, updated_at = now() WHERE id = $2`,
        [amt, to_account_id]
      );

      const ref = 'TRF-' + Math.random().toString(36).slice(2, 10).toUpperCase();

      const txOut = await client.query(
        `INSERT INTO transactions (account_id, user_id, type, amount, currency, status, description, reference)
         VALUES ($1, $2, 'transfer', $3, $4, 'completed', $5, $6) RETURNING id`,
        [from_account_id, req.user.id, amt, from.currency, description || `Transfer to ${to.account_number}`, ref]
      );

      await client.query(
        `INSERT INTO transactions (account_id, user_id, type, amount, currency, status, description, reference)
         VALUES ($1, $2, 'deposit', $3, $4, 'completed', $5, $6)`,
        [to_account_id, to.user_id, amt, to.currency, description || `Transfer from ${from.account_number}`, ref]
      );

      await client.query(
        `INSERT INTO activity_log (user_id, action, description, metadata)
         VALUES ($1, 'transfer', $2, $3)`,
        [req.user.id, `Transferred ${amt} ${from.currency}`, JSON.stringify({ from: from_account_id, to: to_account_id, amount: amt, ref })]
      );

      return { reference: ref, transaction_id: txOut.rows[0].id };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Transfer failed' });
  }
});

app.post('/api/deposit', authMiddleware, async (req, res) => {
  try {
    const { account_id, amount, description } = req.body;
    const amt = parseFloat(amount);
    if (!account_id || !amt || amt <= 0) {
      return res.status(400).json({ error: 'Invalid deposit data' });
    }

    const result = await withTransaction(async (client) => {
      const accRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [account_id, req.user.id]
      );
      if (!accRes.rows.length) throw new Error('Account not found');
      const acc = accRes.rows[0];
      if (acc.is_locked || acc.status !== 'active') throw new Error('Account is locked or inactive');

      await client.query(
        `UPDATE accounts SET balance = balance + $1, updated_at = now() WHERE id = $2`,
        [amt, account_id]
      );

      const ref = 'DEP-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      const tx = await client.query(
        `INSERT INTO transactions (account_id, user_id, type, amount, currency, status, description, reference)
         VALUES ($1, $2, 'deposit', $3, $4, 'completed', $5, $6) RETURNING *`,
        [account_id, req.user.id, amt, acc.currency, description || 'Deposit', ref]
      );

      await client.query(
        `INSERT INTO activity_log (user_id, action, description, metadata)
         VALUES ($1, 'deposit', $2, $3)`,
        [req.user.id, `Deposited ${amt} ${acc.currency}`, JSON.stringify({ account_id, amount: amt, ref })]
      );

      return tx.rows[0];
    });

    res.json({ success: true, transaction: result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Deposit failed' });
  }
});

app.post('/api/withdraw', authMiddleware, async (req, res) => {
  try {
    const { account_id, amount, description } = req.body;
    const amt = parseFloat(amount);
    if (!account_id || !amt || amt <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal data' });
    }

    const result = await withTransaction(async (client) => {
      const accRes = await client.query(
        `SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [account_id, req.user.id]
      );
      if (!accRes.rows.length) throw new Error('Account not found');
      const acc = accRes.rows[0];
      if (acc.is_locked || acc.status !== 'active') throw new Error('Account is locked or inactive');
      if (acc.balance < amt) throw new Error('Insufficient funds');

      await client.query(
        `UPDATE accounts SET balance = balance - $1, updated_at = now() WHERE id = $2`,
        [amt, account_id]
      );

      const ref = 'WDR-' + Math.random().toString(36).slice(2, 10).toUpperCase();
      const tx = await client.query(
        `INSERT INTO transactions (account_id, user_id, type, amount, currency, status, description, reference)
         VALUES ($1, $2, 'withdrawal', $3, $4, 'completed', $5, $6) RETURNING *`,
        [account_id, req.user.id, amt, acc.currency, description || 'Withdrawal', ref]
      );

      await client.query(
        `INSERT INTO activity_log (user_id, action, description, metadata)
         VALUES ($1, 'withdrawal', $2, $3)`,
        [req.user.id, `Withdrew ${amt} ${acc.currency}`, JSON.stringify({ account_id, amount: amt, ref })]
      );

      return tx.rows[0];
    });

    res.json({ success: true, transaction: result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Withdrawal failed' });
  }
});

// ============== ACCOUNT REQUESTS ==============

app.post('/api/requests', authMiddleware, async (req, res) => {
  try {
    const { currency, account_name, target_email, target_name, reason } = req.body;
    if (!['GBP', 'USD', 'EUR'].includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency' });
    }

    const { rows } = await query(
      `INSERT INTO account_requests (requester_id, currency, account_name, target_email, target_name, reason)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, currency, account_name, target_email, target_name, reason]
    );

    res.status(201).json({ request: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create request' });
  }
});

app.get('/api/requests/mine', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM account_requests WHERE requester_id = $1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// ============== ADMIN ROUTES ==============

app.get('/api/admin/overview', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [users, accounts, assets, recent, pending] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_locked) as locked FROM profiles`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_locked) as locked FROM accounts`),
      query(`SELECT currency, COALESCE(SUM(balance),0) as total FROM accounts GROUP BY currency`),
      query(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 15`),
      query(`SELECT COUNT(*) as pending FROM account_requests WHERE status = 'pending'`),
    ]);

    res.json({
      users: users.rows[0],
      accounts: accounts.rows[0],
      assets_by_currency: assets.rows,
      recent_activity: recent.rows,
      pending_requests: parseInt(pending.rows[0]?.pending || 0),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const search = req.query.q || '';
    const { rows } = await query(
      `SELECT id, email, full_name, role, is_locked, created_at, last_login,
              (SELECT COUNT(*) FROM accounts a WHERE a.user_id = p.id) as account_count
       FROM profiles p
       WHERE email ILIKE $1 OR full_name ILIKE $1
       ORDER BY created_at DESC LIMIT 100`,
      [`%${search}%`]
    );
    res.json({ users: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.patch('/api/admin/users/:id/lock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { locked } = req.body;
    await query(`UPDATE profiles SET is_locked = $1 WHERE id = $2`, [!!locked, req.params.id]);
    await query(
      `INSERT INTO activity_log (user_id, action, description, metadata)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, locked ? 'lock_user' : 'unlock_user', `${locked ? 'Locked' : 'Unlocked'} user`, JSON.stringify({ target: req.params.id })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/api/admin/accounts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const search = req.query.q || '';
    const { rows } = await query(
      `SELECT a.*, p.email, p.full_name
       FROM accounts a
       JOIN profiles p ON p.id = a.user_id
       WHERE a.account_number ILIKE $1 OR p.email ILIKE $1 OR p.full_name ILIKE $1
       ORDER BY a.created_at DESC LIMIT 100`,
      [`%${search}%`]
    );
    res.json({ accounts: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.patch('/api/admin/accounts/:id/lock', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { locked } = req.body;
    await query(`UPDATE accounts SET is_locked = $1, updated_at = now() WHERE id = $2`, [!!locked, req.params.id]);
    await query(
      `INSERT INTO activity_log (user_id, action, description, metadata)
       VALUES ($1, $2, $3, $4)`,
      [req.user.id, locked ? 'lock_account' : 'unlock_account', `${locked ? 'Locked' : 'Unlocked'} account`, JSON.stringify({ account_id: req.params.id })]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

app.post('/api/admin/accounts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { user_id, currency, account_name, initial_deposit } = req.body;
    if (!user_id || !['GBP', 'USD', 'EUR'].includes(currency)) {
      return res.status(400).json({ error: 'user_id and valid currency required' });
    }

    // One account per currency per customer
    const existing = await query(
      `SELECT id FROM accounts WHERE user_id = $1 AND currency = $2`,
      [user_id, currency]
    );
    if (existing.rows.length) {
      return res.status(409).json({ error: `Customer already has a ${currency} account` });
    }

    const deposit = parseFloat(initial_deposit) || 0;

    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO accounts (user_id, account_number, currency, account_name, balance)
         VALUES ($1, generate_account_number(), $2, $3, $4) RETURNING *`,
        [user_id, currency, account_name || `${currency} Account`, deposit]
      );
      const account = rows[0];

      if (deposit > 0) {
        await client.query(
          `INSERT INTO transactions (account_id, user_id, type, amount, currency, status, description, reference)
           VALUES ($1, $2, 'deposit', $3, $4, 'completed', 'Initial deposit by admin', $5)`,
          [account.id, user_id, deposit, currency, 'ADM-' + Math.random().toString(36).slice(2, 8).toUpperCase()]
        );
      }

      await client.query(
        `INSERT INTO activity_log (user_id, action, description, metadata)
         VALUES ($1, 'admin_create_account', $2, $3)`,
        [req.user.id, `Admin created ${currency} account`, JSON.stringify({ account_id: account.id, user_id, deposit })]
      );

      return account;
    });

    res.status(201).json({ account: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/admin/adjust-balance', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { account_id, amount, adjustment_type, reason } = req.body;

    // Debug logging
    console.log('adjust-balance request:', { account_id, amount, adjustment_type, reason });

    if (!account_id) return res.status(400).json({ error: 'account_id is required' });
    if (amount === undefined || amount === null || amount === '') return res.status(400).json({ error: 'amount is required' });

    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });

    const type = adjustment_type || 'credit';
    if (!['credit', 'debit'].includes(type)) return res.status(400).json({ error: 'adjustment_type must be credit or debit' });

    const result = await withTransaction(async (client) => {
      const acct = (await client.query(`SELECT * FROM accounts WHERE id=$1 FOR UPDATE`, [account_id])).rows[0];
      if (!acct) throw new Error('Account not found');

      const delta = type === 'credit' ? amt : -amt;
      const newBalance = parseFloat(acct.balance) + delta;
      if (newBalance < 0) throw new Error('Resulting balance cannot be negative');

      await client.query(
        `UPDATE accounts SET balance=$1, available_balance=available_balance+$2 WHERE id=$3`,
        [newBalance, delta, account_id]
      );

      const tx = await client.query(
        `INSERT INTO transactions (account_id, type, amount, currency, description, reference, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'completed', now()) RETURNING *`,
        [account_id, `admin_${type}`, delta, acct.currency,
         reason || `Admin ${type}`, `ADJ-${Date.now().toString(36).toUpperCase()}`]
      );

      await createNotification(acct.user_id, `balance_${type}`, `Balance ${type === 'credit' ? 'credited' : 'debited'}`,
        `$${amt.toFixed(2)} ${acct.currency} ${type === 'credit' ? 'added to' : 'removed from'} your account.`,
        { account_id: acct.id, amount: delta, reason });

      await createAuditLog(req.user.id, 'balance_adjust', 'account', acct.id,
        { balance: acct.balance }, { balance: newBalance }, reason, req.ip);

      return { newBalance, transaction: tx.rows[0] };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('adjust-balance error:', err);
    res.status(400).json({ error: err.message || 'Adjustment failed' });
  }
});

app.get('/api/admin/transactions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const search = req.query.q || '';
    const { rows } = await query(
      `SELECT t.*, a.account_number, p.email, p.full_name
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       JOIN profiles p ON p.id = t.user_id
       WHERE t.reference ILIKE $1 OR p.email ILIKE $1 OR a.account_number ILIKE $1 OR t.description ILIKE $1
       ORDER BY t.created_at DESC LIMIT 150`,
      [`%${search}%`]
    );
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/admin/activity', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT al.*, p.email, p.full_name
       FROM activity_log al
       LEFT JOIN profiles p ON p.id = al.user_id
       ORDER BY al.created_at DESC LIMIT 200`
    );
    res.json({ activity: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

app.get('/api/admin/requests', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT r.*, p.email as requester_email, p.full_name as requester_name
       FROM account_requests r
       JOIN profiles p ON p.id = r.requester_id
       ORDER BY 
         CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END,
         r.created_at DESC
       LIMIT 100`
    );
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/api/admin/requests/:id/review', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const result = await withTransaction(async (client) => {
      const reqRes = await client.query(
        `SELECT * FROM account_requests WHERE id = $1 FOR UPDATE`,
        [req.params.id]
      );
      if (!reqRes.rows.length) throw new Error('Request not found');
      const request = reqRes.rows[0];
      if (request.status !== 'pending') throw new Error('Request already reviewed');

      await client.query(
        `UPDATE account_requests 
         SET status = $1, reviewed_by = $2, reviewed_at = now(), admin_note = $3
         WHERE id = $4`,
        [status, req.user.id, admin_note, req.params.id]
      );

      if (status === 'approved') {
        // Create the account for the requester (or target if specified)
        const ownerId = request.requester_id;
        await client.query(
          `INSERT INTO accounts (user_id, account_number, currency, account_name, balance)
           VALUES ($1, generate_account_number(), $2, $3, 0)`,
          [ownerId, request.currency, request.account_name || `${request.currency} Account`]
        );
      }

      await client.query(
        `INSERT INTO activity_log (user_id, action, description, metadata)
         VALUES ($1, $2, $3, $4)`,
        [req.user.id, `request_${status}`, `Request ${status}`, JSON.stringify({ request_id: req.params.id })]
      );

      return { status };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Review failed' });
  }
});

app.get('/api/admin/exchange-rates', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM exchange_rates ORDER BY from_currency, to_currency`);
    res.json({ rates: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

app.put('/api/admin/exchange-rates', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { from_currency, to_currency, rate } = req.body;
    const r = parseFloat(rate);
    if (!from_currency || !to_currency || !r || r <= 0) {
      return res.status(400).json({ error: 'Invalid rate data' });
    }

    await query(
      `INSERT INTO exchange_rates (from_currency, to_currency, rate, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (from_currency, to_currency)
       DO UPDATE SET rate = $3, updated_by = $4, updated_at = now()`,
      [from_currency, to_currency, r, req.user.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

// Promote user to admin — owner-only, locked to OWNER_EMAIL
app.post('/api/admin/promote', authMiddleware, async (req, res) => {
  try {
    const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').toLowerCase();
    const targetEmail = ((req.body && req.body.email) || req.user.email).toLowerCase();

    if (targetEmail !== OWNER_EMAIL) {
      return res.status(403).json({ error: 'Only the platform owner can be promoted to admin' });
    }

    await query(`UPDATE profiles SET role = 'admin' WHERE email = $1`, [targetEmail]);
    res.json({ success: true, message: `${targetEmail} is now admin` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to promote' });
  }
});

// Health
app.get('/api/health', (req, res) => res.json({ status: 'ok', bank: 'Rubicon Capital' }));

// Always export the app for serverless (Vercel)
export default app;

// Start server when running directly (not in serverless)
if (!process.env.VERCEL) {
  runMigrations().then(() => {
    app.listen(PORT, () => {
      console.log(`Rubicon Capital API running on http://localhost:${PORT}`);
    });
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
