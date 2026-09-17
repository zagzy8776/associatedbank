import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Input, SkipLink } from '../components/ui';
import { cx } from '../lib/designTokens';
import { isEmail, passwordStrength, validateAuth, type FieldErrors } from '../lib/validation';
import {
  ArrowRight, Fingerprint, Lock, Mail, ShieldCheck, User,
} from 'lucide-react';

type Field = 'fullName' | 'email' | 'password';

export default function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    fullName: false,
    email: false,
    password: false,
  });
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSignup = mode === 'signup';
  const values = useMemo(() => ({ fullName, email, password }), [fullName, email, password]);
  const strength = useMemo(() => passwordStrength(password), [password]);

  /* Live re-validation for a field the user has already interacted with. */
  const validateField = (field: Field, next: typeof values = values) => {
    const all = validateAuth(mode, next);
    setErrors((prev) => ({ ...prev, [field]: all[field] }));
  };

  const handleBlur = (field: Field) => {
    setTouched((t) => ({ ...t, [field]: true }));
    validateField(field);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const nextErrors = validateAuth(mode, values);
    setErrors(nextErrors);
    setTouched({ fullName: true, email: true, password: true });
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      if (isSignup) {
        await register(email.trim(), password, fullName.trim());
      } else {
        await login(email.trim(), password);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setFormError(err?.message || 'We could not complete that request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const emailLooksValid = touched.email && isEmail(email) && !errors.email;

  return (
    <div className="min-h-screen bg-surface flex">
      <SkipLink />

      {/* Branding panel */}
      <aside className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-surface to-brand-700/10 items-center justify-center p-12 relative overflow-hidden">
        <div
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,_rgba(245,158,11,0.08),transparent_50%)]"
          aria-hidden="true"
        />
        <div className="relative z-10 max-w-md">
          <div className="w-14 h-14 rounded-card bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-surface text-2xl mb-8 shadow-amber">
            R
          </div>
          <h1 className="text-4xl font-semibold mb-4 tracking-tight">Rubicon Capital</h1>
          <p className="text-content-secondary text-lg leading-relaxed mb-8">
            Private multi-currency banking with complete administrative control and
            institutional-grade transparency.
          </p>
          <ul className="space-y-3 text-sm text-content-secondary">
            <li className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-brand-400" aria-hidden="true" />
              Encrypted connection to every account
            </li>
            <li className="flex items-center gap-2.5">
              <Fingerprint className="w-4 h-4 text-brand-400" aria-hidden="true" />
              Identity checks on every sign-in
            </li>
            <li className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-brand-400" aria-hidden="true" />
              Balances stay private on shared screens
            </li>
          </ul>
        </div>
      </aside>

      {/* Form */}
      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-control bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-surface">
              R
            </div>
            <span className="font-semibold text-lg">Rubicon Capital</span>
          </div>

          <div className="rounded-panel border border-line-subtle bg-gradient-to-br from-surface-raised/70 to-surface-raised/40 p-6 sm:p-8 shadow-card backdrop-blur-sm">
            <h2 className="text-title text-content-primary">
              {isSignup ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-content-secondary text-sm mt-1.5 mb-8">
              {isSignup
                ? 'Open your Rubicon Capital profile in a few moments.'
                : 'Sign in to access your multi-currency accounts.'}
            </p>

            {formError && (
              <Alert tone="error" title="We could not complete that request" onDismiss={() => setFormError('')}>
                {formError}
              </Alert>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {isSignup && (
                <Input
                  label="Full name"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (touched.fullName) validateField('fullName', { ...values, fullName: e.target.value });
                  }}
                  onBlur={() => handleBlur('fullName')}
                  error={touched.fullName ? errors.fullName : undefined}
                  placeholder="James Whitfield"
                  autoComplete="name"
                  leadingIcon={<User className="w-4 h-4" />}
                />
              )}

              <Input
                label="Email"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) validateField('email', { ...values, email: e.target.value });
                }}
                onBlur={() => handleBlur('email')}
                error={touched.email ? errors.email : undefined}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                leadingIcon={<Mail className="w-4 h-4" />}
                className={cx(emailLooksValid && 'border-emerald-500/40')}
              />

              <div>
                <Input
                  label="Password"
                  required
                  revealable
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (touched.password) validateField('password', { ...values, password: e.target.value });
                  }}
                  onBlur={() => handleBlur('password')}
                  error={touched.password ? errors.password : undefined}
                  placeholder={isSignup ? 'At least 8 characters' : '••••••••'}
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  hint={isSignup ? undefined : 'Your password is never saved in the browser.'}
                />

                {isSignup && password.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2" aria-live="polite">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={cx(
                          'h-full rounded-full transition-all duration-slow ease-standard',
                          strength.tone === 'negative' && 'bg-red-400',
                          strength.tone === 'warning' && 'bg-brand-400',
                          strength.tone === 'positive' && 'bg-emerald-400',
                        )}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span
                      className={cx(
                        'text-caption font-medium w-12 text-right',
                        strength.tone === 'negative' && 'text-red-400',
                        strength.tone === 'warning' && 'text-brand-400',
                        strength.tone === 'positive' && 'text-emerald-400',
                      )}
                    >
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                loadingLabel={isSignup ? 'Creating your account…' : 'Signing you in…'}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isSignup ? 'Create account' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-2 text-caption text-content-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              Secured with bank-grade encryption
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-content-secondary">
            {isSignup ? (
              <>
                Already a client?{' '}
                <Link
                  to="/login"
                  className="text-brand-400 hover:text-brand-300 font-medium transition-colors duration-fast"
                >
                  Sign in
                </Link>
              </>
            ) : (
              <>
                Don’t have an account?{' '}
                <Link
                  to="/signup"
                  className="text-brand-400 hover:text-brand-300 font-medium transition-colors duration-fast"
                >
                  Open one
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
