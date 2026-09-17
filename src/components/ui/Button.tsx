import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cx, focusRing } from '../../lib/designTokens';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Shared button styling so `<button>` and react-router `<Link>` elements can
 * render identical controls (Req 13.1–13.3, 15.4, 15.5).
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-brand-500 to-brand-600 text-surface font-semibold hover:from-brand-400 hover:to-brand-500 shadow-amber hover:shadow-amber-strong',
  secondary:
    'border border-line-strong bg-surface-overlay/40 text-content-primary font-medium hover:border-slate-500 hover:bg-surface-overlay/70',
  tertiary:
    'text-content-secondary font-medium hover:text-content-primary hover:bg-white/5',
  danger:
    'bg-red-600/90 text-white font-semibold hover:bg-red-500 shadow-card',
  success:
    'bg-emerald-600/90 text-white font-semibold hover:bg-emerald-500 shadow-card',
};

/* md/lg sizes keep a 44px minimum touch target (Req 13.4, 15.5). */
const SIZES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-label rounded-control gap-1.5',
  md: 'h-11 min-h-[44px] px-4 text-sm rounded-control gap-2',
  lg: 'h-12 min-h-[44px] px-6 text-body rounded-control gap-2',
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

/** Class string for callers that cannot render a `<button>` (e.g. `<Link>`). */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
}: ButtonStyleOptions = {}) {
  return cx(
    'relative inline-flex items-center justify-center whitespace-nowrap',
    'transition-[color,background-color,border-color,box-shadow,transform] duration-base ease-standard',
    'disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    focusRing,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Label announced to screen readers while `loading` is true. */
  loadingLabel?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    loading = false,
    loadingLabel = 'Working…',
    leftIcon,
    rightIcon,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(buttonClasses({ variant, size, fullWidth }), className)}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
      ) : (
        leftIcon && <span className="shrink-0" aria-hidden="true">{leftIcon}</span>
      )}
      <span>{loading ? loadingLabel : children}</span>
      {!loading && rightIcon && (
        <span className="shrink-0" aria-hidden="true">{rightIcon}</span>
      )}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md';
  /** Required — icon-only controls have no visible text label (Req 20.2). */
  label: string;
}

/** Icon button with an always-present accessible name and 44px hit area. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', label, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex items-center justify-center rounded-control text-content-secondary',
        'hover:bg-surface-overlay/70 hover:text-content-primary',
        'transition-colors duration-fast ease-standard',
        size === 'sm' ? 'h-9 w-9' : 'h-11 w-11 min-h-[44px] min-w-[44px]',
        focusRing,
        className,
      )}
    >
      <span aria-hidden="true" className="contents">{children}</span>
    </button>
  );
});
