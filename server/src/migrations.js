/**
 * Database migration for Rubicon Capital closed-loop banking simulation.
 *
 * Adds new tables and extends existing ones. Safe to run multiple times.
 */

import { query } from './db.js';

export async function runMigrations() {
  console.log('Running database migrations…');

  // 1. Extend profiles table
  const profileCols = [
    ['phone', 'TEXT'],
    ['address', 'TEXT'],
    ['date_of_birth', 'DATE'],
    ['country', "TEXT DEFAULT 'GB'"],
    ['kyc_status', "TEXT DEFAULT 'pending'"],
    ['account_status', "TEXT DEFAULT 'active'"],
    ['transaction_pin_hash', 'TEXT'],
  ];
  for (const [col, type] of profileCols) {
    await query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => {});
  }

  // 2. Extend accounts table
  const accountCols = [
    ['status', "TEXT DEFAULT 'active'"],
    ['available_balance', 'NUMERIC(18,2) DEFAULT 0'],
    ['daily_limit', 'NUMERIC(18,2) DEFAULT 20000'],
    ['transaction_limit', 'NUMERIC(18,2) DEFAULT 5000'],
    ['monthly_limit', 'NUMERIC(18,2) DEFAULT 100000'],
  ];
  for (const [col, type] of accountCols) {
    await query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ${col} ${type}`).catch(() => {});
  }
  await query(`UPDATE accounts SET available_balance = COALESCE(balance, 0) WHERE available_balance IS NULL`).catch(() => {});

  // 3. Update generate_account_number() to SIM-XXX-NNNNNNNN format
  await query(`
    CREATE OR REPLACE FUNCTION generate_account_number()
    RETURNS TEXT AS $$
    DECLARE
      num TEXT;
      exists_count INT;
    BEGIN
      LOOP
        num := 'SIM-' ||
               (ARRAY['USD','GBP','EUR','NGN'])[floor(random()*4+1)] || '-' ||
               lpad(floor(random()*100000000)::TEXT, 8, '0');
        SELECT COUNT(*) INTO exists_count FROM accounts WHERE account_number = num;
        EXIT WHEN exists_count = 0;
      END LOOP;
      RETURN num;
    END;
    $$ LANGUAGE plpgsql;
  `).catch(() => {});

  // 4. deposit_requests table
  await query(`
    CREATE TABLE IF NOT EXISTS deposit_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      account_id UUID NOT NULL REFERENCES accounts(id),
      customer_id UUID NOT NULL REFERENCES profiles(id),
      amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
      currency TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_id UUID REFERENCES profiles(id),
      admin_note TEXT,
      reference TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      reviewed_at TIMESTAMPTZ
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_dep_req_cust ON deposit_requests(customer_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_dep_req_status ON deposit_requests(status);`);

  // 5. crypto_accounts table
  await query(`
    CREATE TABLE IF NOT EXISTS crypto_accounts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id UUID NOT NULL REFERENCES profiles(id),
      asset TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      balance NUMERIC(24,8) NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      admin_id UUID REFERENCES profiles(id),
      admin_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_crypto_acct_cust ON crypto_accounts(customer_id);`);
  await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_crypto_acct_wallet ON crypto_accounts(wallet_address);`);

  // 6. crypto_transactions table
  await query(`
    CREATE TABLE IF NOT EXISTS crypto_transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      crypto_account_id UUID NOT NULL REFERENCES crypto_accounts(id),
      transaction_type TEXT NOT NULL,
      amount NUMERIC(24,8) NOT NULL,
      asset TEXT NOT NULL,
      counterparty_address TEXT,
      reference TEXT,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_crypto_tx_acct ON crypto_transactions(crypto_account_id);`);

  // 7. notifications table
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES profiles(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      read_at TIMESTAMPTZ
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, is_read) WHERE is_read = false;`);

  // 8. audit_logs table
  await query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_type TEXT NOT NULL DEFAULT 'admin',
      actor_id UUID NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id UUID,
      before_data JSONB,
      after_data JSONB,
      reason TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_logs(target_type, target_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);`);

  // 9. Unique constraint on account_number
  await query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_account_number_unique') THEN
        ALTER TABLE accounts ADD CONSTRAINT accounts_account_number_unique UNIQUE (account_number);
      END IF;
    END $$;
  `).catch(() => {});

  console.log('Database migrations complete.');
}