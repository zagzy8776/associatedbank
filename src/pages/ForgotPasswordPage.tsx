import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { isEmail } from '../lib/validation';
import { Alert, Button, Input } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isEmail(email.trim())) {
      setError('Enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send reset email');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-line-subtle bg-surface-raised/80 p-6 sm:p-8 shadow-card">
        <div className="mb-6">
          <BrandLogo />
          <h1 className="mt-4 text-xl font-semibold text-content-primary">Reset your password</h1>
          <p className="mt-1 text-sm text-content-muted">
            Enter the email on your Rubicon account. If it exists, we will send a secure link.
          </p>
        </div>
        {done ? (
          <Alert tone="success">
            If that email is registered, a reset link has been sent. Check your inbox and spam folder.
            The link expires in 60 minutes.
          </Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Button type="submit" loading={busy} fullWidth>
              Send reset link
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-content-muted">
          <Link to="/login" className="text-amber-400 hover:text-amber-300">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
