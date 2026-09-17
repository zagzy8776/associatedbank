/**
 * Pure form validation helpers (Req 7.3, 7.4, 18.3).
 *
 * Kept free of React so the rules can be unit tested in isolation and reused
 * by every form in the application (auth, account creation, transfers).
 */

export type FieldErrors<T extends string> = Partial<Record<T, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(value: string) {
  return EMAIL_RE.test(value.trim());
}

export interface AuthValues {
  fullName?: string;
  email: string;
  password: string;
}

/** Validation for the login / signup forms. */
export function validateAuth(mode: 'login' | 'signup', values: AuthValues): FieldErrors<'fullName' | 'email' | 'password'> {
  const errors: FieldErrors<'fullName' | 'email' | 'password'> = {};

  if (mode === 'signup') {
    const name = values.fullName?.trim() ?? '';
    if (!name) errors.fullName = 'Enter your full name as it should appear on statements.';
    else if (name.length < 2) errors.fullName = 'Full name must be at least 2 characters.';
  }

  const email = values.email.trim();
  if (!email) errors.email = 'Enter your email address.';
  else if (!isEmail(email)) errors.email = 'Enter a valid email address, for example name@example.com.';

  if (!values.password) errors.password = 'Enter your password.';
  else if (mode === 'signup' && values.password.length < 8)
    errors.password = 'Use at least 8 characters for your password.';

  return errors;
}

export interface StrengthResult {
  /** 0 (weak) to 4 (strong). */
  score: number;
  label: string;
  tone: 'negative' | 'warning' | 'positive';
}

/** Lightweight password strength meter used on the signup form. */
export function passwordStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;

  const clamped = Math.min(score, 4);
  if (clamped <= 1) return { score: clamped, label: 'Weak', tone: 'negative' };
  if (clamped === 2) return { score: clamped, label: 'Fair', tone: 'warning' };
  if (clamped === 3) return { score: clamped, label: 'Good', tone: 'positive' };
  return { score: clamped, label: 'Strong', tone: 'positive' };
}

/** Positive amount validation for deposit / withdraw / transfer forms. */
export function validateAmount(value: string, currency?: string, max?: number): string | undefined {
  const label = currency ? ` (${currency})` : '';
  if (!value.trim()) return `Enter an amount${label}.`;
  const n = Number(value);
  if (!Number.isFinite(n)) return 'Enter a valid number.';
  if (n <= 0) return 'Amount must be greater than zero.';
  if (max !== undefined && n > max) return 'Amount exceeds the available balance.';
  return undefined;
}

/** Required-field check used by selects and free-text inputs. */
export function required(value: string | undefined | null, message: string) {
  return value && value.trim() ? undefined : message;
}