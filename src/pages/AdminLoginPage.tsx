import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Alert, Button, Input } from '../components/ui';
import { Lock, Mail, Shield } from 'lucide-react';

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your admin email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate('/admin');
    } catch (err: any) {
      setError(err?.message || 'Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-card bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-surface text-2xl mb-4 shadow-amber mx-auto">
            R
          </div>
          <h1 className="text-xl font-semibold text-content-primary">Admin Console</h1>
          <p className="text-caption text-content-muted mt-1">Rubicon Capital — Owner Access Only</p>
        </div>

        {/* Login Form */}
        <div className="rounded-card bg-surface-raised/60 border border-line-subtle p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="w-5 h-5 text-brand-400" />
            <h2 className="text-sm font-semibold text-content-primary">Secure Admin Login</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert tone="error" onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            <Input
              label="Admin Email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@rubiconcapital.com"
              autoComplete="email"
              leadingIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              revealable
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              leadingIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={loading}
              loadingLabel="Signing in…"
            >
              Sign in to Admin Console
            </Button>
          </form>
        </div>

        <p className="text-center text-micro text-content-muted mt-6">
          This panel is restricted to the platform owner.
          <br />
          Credentials are configured in environment variables.
        </p>
      </div>
    </div>
  );
}