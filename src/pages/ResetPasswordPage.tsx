import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { Alert, Button, Input } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get('token') || '', [params]);
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Missing reset token. Open the link from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword({ token, new_password: password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err: any) {
      setError(err?.message || 'Could not reset password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-line-subtle bg-surface-raised/80 p-6 sm:p-8 shadow-card">
        <div className="mb-6">
          <BrandLogo />
          <h1 className="mt-4 text-xl font-semibold text-content-primary">Choose a new password</h1>
          <p className="mt-1 text-sm text-content-muted">Your new password must be at least 8 characters.</p>
        </div>
        {done ? (
          <Alert tone="success">Password updated. Redirecting to sign in…</Alert>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            {!token && (
              <Alert tone="error">This page needs a valid token from your reset email.</Alert>
            )}
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Button type="submit" loading={busy} fullWidth disabled={!token}>
              Update password
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
