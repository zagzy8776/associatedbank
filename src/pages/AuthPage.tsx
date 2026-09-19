import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Button, Input, SkipLink } from '../components/ui';
import { BrandLogo } from '../components/BrandLogo';
import { cx } from '../lib/designTokens';
import { isEmail, passwordStrength, validateAuth, type FieldErrors } from '../lib/validation';
import {
  ArrowRight, Landmark, Lock, Mail, Phone, ShieldCheck, User,
} from 'lucide-react';

type Field = 'fullName' | 'email' | 'password';

const AUTH_PHOTO =
  'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80';

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
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col lg:flex-row">
      <SkipLink />

      <aside className="relative hidden lg:flex lg:w-[48%] xl:w-1/2 flex-col justify-between overflow-hidden">
        <div className="absolute inset-0">
          <img src={AUTH_PHOTO} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#070b14]/60" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/50 to-[#070b14]/30" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_30%,rgba(245,158,11,0.14),transparent_50%)]" />
        </div>

        <div className="relative z-10 p-10 xl:p-12">
          <Link to="/" className="inline-block">
            <BrandLogo size={40} withWordmark />
          </Link>
        </div>

        <div className="relative z-10 p-10 xl:p-12 max-w-lg">
          <p className="text-[11px] uppercase tracking-[0.2em] text-amber-400/90 mb-4 font-medium">
            Client access
          </p>
          <h1 className="text-3xl xl:text-4xl font-semibold tracking-tight leading-tight">
            {isSignup ? 'Open your multi-currency relationship' : 'Sign in to your accounts'}
          </h1>
          <p className="mt-4 text-slate-300/90 leading-relaxed text-[15px]">
            GBP, USD, and EUR under one login. Encrypted sessions, clear statements, and support in
            London hours.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </span>
              256-bit encryption on every session
            </li>
            <li className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-amber-400" />
              </span>
              SWIFT RBNKGB2L · institutional rails
            </li>
            <li className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Phone className="w-4 h-4 text-amber-400" />
              </span>
              Client services +44 (0) 20 7946 0958
            </li>
          </ul>
        </div>

        <div className="relative z-10 px-10 xl:px-12 pb-10 text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
          <span>Mon–Fri 08:00–18:00 GMT</span>
          <span className="text-slate-700">·</span>
          <Link to="/" className="hover:text-amber-400 transition">
            Back to website
          </Link>
        </div>
      </aside>

      <main
        id="main-content"
        className="flex-1 flex flex-col justify-center px-5 sm:px-8 py-10 sm:py-14 relative"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_10%,rgba(245,158,11,0.06),transparent_40%)] pointer-events-none" />

        <div className="relative w-full max-w-[420px] mx-auto">
          <div className="lg:hidden mb-10">
            <Link to="/" className="inline-block">
              <BrandLogo size={34} withWordmark />
            </Link>
            <p className="mt-3 text-xs text-slate-500">
              Secure client access · SWIFT RBNKGB2L
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-6 sm:p-8 shadow-2xl shadow-black/20">
            <div className="mb-7">
              <h2 className="text-2xl font-semibold tracking-tight text-white">
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h2>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                {isSignup
                  ? 'Register to request accounts in GBP, USD, or EUR. Account numbers are issued after review.'
                  : 'Sign in with the email and password linked to your Rubicon profile.'}
              </p>
            </div>

            {formError && (
              <div className="mb-5">
                <Alert tone="error" title="Sign-in could not be completed" onDismiss={() => setFormError('')}>
                  {formError}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              {isSignup && (
                <Input
                  label="Full legal name"
                  required
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (touched.fullName) validateField('fullName', { ...values, fullName: e.target.value });
                  }}
                  onBlur={() => handleBlur('fullName')}
                  error={touched.fullName ? errors.fullName : undefined}
                  placeholder="As it appears on your ID"
                  autoComplete="name"
                  leadingIcon={<User className="w-4 h-4" />}
                />
              )}

              <Input
                label="Email address"
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (touched.email) validateField('email', { ...values, email: e.target.value });
                }}
                onBlur={() => handleBlur('email')}
                error={touched.email ? errors.email : undefined}
                placeholder="name@company.com"
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
                  leadingIcon={<Lock className="w-4 h-4" />}
                  hint={isSignup ? undefined : 'Never share your password. Rubicon staff will not ask for it.'}
                />

                {isSignup && password.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-2" aria-live="polite">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={cx(
                          'h-full rounded-full transition-all duration-300',
                          strength.tone === 'negative' && 'bg-red-400',
                          strength.tone === 'warning' && 'bg-amber-400',
                          strength.tone === 'positive' && 'bg-emerald-400',
                        )}
                        style={{ width: `${(strength.score / 4) * 100}%` }}
                      />
                    </div>
                    <span
                      className={cx(
                        'text-xs font-medium w-14 text-right',
                        strength.tone === 'negative' && 'text-red-400',
                        strength.tone === 'warning' && 'text-amber-400',
                        strength.tone === 'positive' && 'text-emerald-400',
                      )}
                    >
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {!isSignup && (
                <div className="flex justify-end -mt-2">
                  <Link to="/forgot-password" className="text-sm text-amber-400/90 hover:text-amber-300 transition">
                    Forgot password?
                  </Link>
                </div>
              )}

              <Button
                type="submit"
                fullWidth
                size="lg"
                loading={loading}
                loadingLabel={isSignup ? 'Creating your account…' : 'Signing you in…'}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {isSignup ? 'Create account' : 'Sign in securely'}
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/5 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                Encrypted connection · TLS 1.3
              </div>
            </div>
          </div>

          <p className="mt-7 text-center text-sm text-slate-400">
            {isSignup ? (
              <>
                Already a client?{' '}
                <Link to="/login" className="text-amber-400 hover:text-amber-300 font-medium transition">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to Rubicon?{' '}
                <Link to="/signup" className="text-amber-400 hover:text-amber-300 font-medium transition">
                  Open an account
                </Link>
              </>
            )}
          </p>

          <p className="mt-8 text-center text-[11px] text-slate-600 lg:hidden">
            <Link to="/" className="hover:text-amber-400 transition">
              ← Back to website
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
