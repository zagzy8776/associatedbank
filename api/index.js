/**
 * Vercel Serverless Function entry point.
 * Wraps the Express app and runs migrations on cold start.
 */
import app from '../server/src/index.js';
import { runMigrations } from '../server/src/migrations.js';

let migrationsDone = false;

export default async function handler(req, res) {
  // Run migrations once on cold start
  if (!migrationsDone) {
    try {
      await runMigrations();
      migrationsDone = true;
    } catch (err) {
      console.error('Migration error:', err.message);
      // Continue anyway — tables may already exist
      migrationsDone = true;
    }
  }
  return app(req, res);
}