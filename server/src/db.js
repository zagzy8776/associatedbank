import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// In Vercel, env vars are set in the dashboard, not from .env
if (!process.env.VERCEL) {
  dotenv.config({ path: join(__dirname, '../../.env') });
}

// Cache the pool across serverless invocations to reuse connections
const globalForPg = globalThis;

if (!globalForPg.__pgPool) {
  globalForPg.__pgPool = new pg.Pool({
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 5, // Lower max for serverless to avoid exhausting connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
}

const pool = globalForPg.__pgPool;

export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    console.log('Slow query', { text: text.slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export default pool;
