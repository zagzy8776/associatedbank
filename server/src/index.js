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
import { emailWelcome, emailLoginAlert, voidEmail } from './email.js';
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
    voidEmail(emailWelcome({ to: user.email, fullName: user.full_name }));
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
    voidEmail(emailLoginAlert({
      to: user.email,
      fullName: user.full_name,
      when: new Date().toUTCString(),
      ip: req.ip,
    }));
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});
