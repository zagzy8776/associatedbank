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
import { buildAccountIdentity } from './bankIdentity.js';
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

app.use(depositRoutes);
app.use(transferRoutes);
app.use(cryptoRoutes);
app.use(notificationRoutes);
app.use(adminRoutes);

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, full_name } = req.body;
    if (!email || !password || !full_name) return res.status(400).json({ error: 'Email, password and full name are required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const existing = await query('SELECT id FROM profiles WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const password_hash = await hashPassword(password);
    const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').toLowerCase();
    const role = email.toLowerCase() === OWNER_EMAIL ? 'admin' : 'user';
    const { rows } = await query(
      `INSERT INTO profiles (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at`,
      [email.toLowerCase(), password_hash, full_name, role]
    );
    const user = rows[0];
    const token = signToken(user);
    await query(`INSERT INTO activity_log (user_id, action, description) VALUES ($1, 'register', 'New user registered')`, [user.id]).catch(() => {});
    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const { rows } = await query(`SELECT id, email, full_name, role, password_hash, is_locked FROM profiles WHERE email = $1`, [email.toLowerCase()]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid email or password' });
    const user = rows[0];
    if (user.is_locked) return res.status(403).json({ error: 'Account locked. Please contact support.' });
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
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
    if (profile.is_locked) return res.status(403).json({ error: 'Account locked. Please contact support.' });
    res.json({ user: profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD || '';
    if (!adminEmail || !adminPassword) return res.status(500).json({ error: 'Admin credentials not configured on server' });
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    if (email.toLowerCase() !== adminEmail || password !== adminPassword) return res.status(401).json({ error: 'Invalid admin credentials' });
    const token = signToken({ id: 'admin-owner', email: adminEmail, role: 'admin' });
    res.json({ token, user: { id: 'admin-owner', email: adminEmail, role: 'admin', full_name: 'Owner' } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Admin login failed' });
  }
});

app.get('/api/admin/me', authMiddleware, adminMiddleware, async (req, res) => {
  res.json({ user: { id: req.user.id || 'admin-owner', email: req.user.email, role: 'admin', full_name: 'Owner' } });
});

app.get('/api/accounts', authMiddleware, async (req, res) => {
  try {
    let rows;
    try {
      rows = (await query(
        `SELECT id, account_number, account_name, account_type, routing_number, currency, balance, status, is_locked, created_at
         FROM accounts WHERE user_id = $1 ORDER BY created_at`,
        [req.user.id]
      )).rows;
    } catch (_) {
      rows = (await query(
        `SELECT id, account_number, account_name, currency, balance, status, is_locked, created_at
         FROM accounts WHERE user_id = $1 ORDER BY created_at`,
        [req.user.id]
      )).rows;
    }
    res.json({ accounts: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts', authMiddleware, async (req, res) => {
  try {
    const { currency, account_name, account_type } = req.body;
    if (!['GBP', 'USD', 'EUR'].includes(currency)) return res.status(400).json({ error: 'Invalid currency' });
    const existing = await query(`SELECT id FROM accounts WHERE user_id = $1 AND currency = $2`, [req.user.id, currency]);
    if (existing.rows.length) return res.status(409).json({ error: `You already have a ${currency} account` });
    const identity = await buildAccountIdentity({ currency, account_name, account_type });
    const { rows } = await query(
      `INSERT INTO accounts (user_id, account_number, currency, account_name, account_type, routing_number, balance)
       VALUES ($1, $2, $3, $4, $5, $6, 0) RETURNING *`,
      [req.user.id, identity.account_number, currency, identity.account_name, identity.account_type, identity.routing_number]
    );
    await query(`INSERT INTO activity_log (user_id, action, description, metadata) VALUES ($1, 'create_account', $2, $3)`,
      [req.user.id, `Created ${currency} account`, JSON.stringify({ account_id: rows[0].id, account_number: identity.account_number })]).catch(() => {});
    res.status(201).json({ account: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/api/accounts/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM accounts WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Account not found' });
    res.json({ account: rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

app.get('/api/accounts/:id/transactions', authMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT t.* FROM transactions t JOIN accounts a ON a.id = t.account_id
       WHERE t.account_id = $1 AND a.user_id = $2 ORDER BY t.created_at DESC LIMIT 100`,
      [req.params.id, req.user.id]
    );
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.get('/api/admin/overview', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [users, accounts, assets, recent, pending] = await Promise.all([
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_locked) as locked FROM profiles`),
      query(`SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_locked) as locked FROM accounts`),
      query(`SELECT currency, COALESCE(SUM(balance),0) as total FROM accounts GROUP BY currency`),
      query(`SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 15`).catch(() => ({ rows: [] })),
      query(`SELECT COUNT(*) as pending FROM account_requests WHERE status = 'pending'`).catch(() => ({ rows: [{ pending: 0 }] })),
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
       FROM profiles p WHERE email ILIKE $1 OR full_name ILIKE $1 ORDER BY created_at DESC LIMIT 100`,
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
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.get('/api/admin/accounts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const search = req.query.q || '';
    const { rows } = await query(
      `SELECT a.*, p.email, p.full_name FROM accounts a JOIN profiles p ON p.id = a.user_id
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
    await query(`UPDATE accounts SET is_locked = $1 WHERE id = $2`, [!!locked, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account' });
  }
});

app.post('/api/admin/accounts', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { user_id, currency, account_name, account_type, initial_deposit } = req.body;
    if (!user_id || !['GBP', 'USD', 'EUR'].includes(currency)) {
      return res.status(400).json({ error: 'user_id and valid currency required' });
    }
    const existing = await query(`SELECT id FROM accounts WHERE user_id = $1 AND currency = $2`, [user_id, currency]);
    if (existing.rows.length) return res.status(409).json({ error: `Customer already has a ${currency} account` });
    const deposit = parseFloat(initial_deposit) || 0;
    const identity = await buildAccountIdentity({ currency, account_name, account_type });
    const result = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO accounts (user_id, account_number, currency, account_name, account_type, routing_number, balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [user_id, identity.account_number, currency, identity.account_name, identity.account_type, identity.routing_number, deposit]
      );
      const account = rows[0];
      if (deposit > 0) {
        try {
          await client.query(
            `INSERT INTO transactions (account_id, user_id, type, amount, currency, status, description, reference)
             VALUES ($1, $2, 'deposit', $3, $4, 'completed', 'Initial deposit by admin', $5)`,
            [account.id, user_id, deposit, currency, 'ADM-' + Math.random().toString(36).slice(2, 8).toUpperCase()]
          );
        } catch (_) {
          await client.query(
            `INSERT INTO transactions (account_id, type, amount, currency, status, description, reference)
             VALUES ($1, 'deposit', $2, $3, 'completed', 'Initial deposit by admin', $4)`,
            [account.id, deposit, currency, 'ADM-' + Math.random().toString(36).slice(2, 8).toUpperCase()]
          );
        }
      }
      return account;
    });
    res.status(201).json({ account: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/api/admin/transactions', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const search = req.query.q || '';
    const { rows } = await query(
      `SELECT t.*, a.account_number, p.email, p.full_name
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN profiles p ON p.id = COALESCE(t.user_id, a.user_id)
       WHERE t.reference ILIKE $1 OR p.email ILIKE $1 OR a.account_number ILIKE $1 OR t.description ILIKE $1
       ORDER BY t.created_at DESC LIMIT 150`,
      [`%${search}%`]
    );
    res.json({ transactions: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.patch('/api/admin/transactions/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { created_at, description, reference, amount } = req.body || {};
    if (!created_at && description === undefined && reference === undefined && amount === undefined) {
      return res.status(400).json({ error: 'Provide created_at, description, reference, and/or amount' });
    }
    const existing = await query(`SELECT * FROM transactions WHERE id = $1`, [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Transaction not found' });
    const before = existing.rows[0];
    const sets = [];
    const params = [];
    if (created_at) {
      const d = new Date(created_at);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: 'Invalid created_at datetime' });
      params.push(d.toISOString());
      sets.push(`created_at = $${params.length}`);
    }
    if (description !== undefined) { params.push(description); sets.push(`description = $${params.length}`); }
    if (reference !== undefined) { params.push(reference); sets.push(`reference = $${params.length}`); }
    if (amount !== undefined) {
      const amt = parseFloat(amount);
      if (!Number.isFinite(amt)) return res.status(400).json({ error: 'Invalid amount' });
      params.push(amt);
      sets.push(`amount = $${params.length}`);
    }
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE transactions SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    await createAuditLog(
      req.user?.id, 'edit_transaction', 'transaction', req.params.id,
      { created_at: before.created_at, description: before.description, reference: before.reference, amount: before.amount },
      { created_at: rows[0].created_at, description: rows[0].description, reference: rows[0].reference, amount: rows[0].amount },
      'Admin edited transaction', req.ip
    );
    res.json({ success: true, transaction: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Failed to edit transaction' });
  }
});

app.get('/api/admin/activity', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT al.*, p.email, p.full_name FROM activity_log al LEFT JOIN profiles p ON p.id = al.user_id
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
       FROM account_requests r JOIN profiles p ON p.id = r.requester_id
       ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC LIMIT 100`
    );
    res.json({ requests: rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/api/admin/requests/:id/review', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { status, admin_note } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Status must be approved or rejected' });
    const result = await withTransaction(async (client) => {
      const reqRes = await client.query(`SELECT * FROM account_requests WHERE id = $1 FOR UPDATE`, [req.params.id]);
      if (!reqRes.rows.length) throw new Error('Request not found');
      const request = reqRes.rows[0];
      if (request.status !== 'pending') throw new Error('Request already reviewed');
      try {
        await client.query(
          `UPDATE account_requests SET status = $1, reviewed_by = $2, reviewed_at = now(), admin_note = $3 WHERE id = $4`,
          [status, req.user.id, admin_note, req.params.id]
        );
      } catch (_) {
        await client.query(`UPDATE account_requests SET status = $1, admin_note = $2 WHERE id = $3`, [status, admin_note, req.params.id]);
      }
      if (status === 'approved') {
        const identity = await buildAccountIdentity({
          currency: request.currency,
          account_name: request.account_name,
          account_type: 'current',
        });
        await client.query(
          `INSERT INTO accounts (user_id, account_number, currency, account_name, account_type, routing_number, balance)
           VALUES ($1, $2, $3, $4, $5, $6, 0)`,
          [request.requester_id, identity.account_number, request.currency, identity.account_name, identity.account_type, identity.routing_number]
        );
      }
      return { status };
    });
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Review failed' });
  }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok', bank: 'Rubicon Capital' }));

export default app;

if (!process.env.VERCEL) {
  runMigrations().then(() => {
    app.listen(PORT, () => console.log(`Rubicon Capital API on http://localhost:${PORT}`));
  }).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
