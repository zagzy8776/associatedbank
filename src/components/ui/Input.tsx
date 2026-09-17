import {
  useId,
  useState,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { Eye, EyeOff, AlertCircle, Search } from 'lucide-react';
import { cx, focusRing } from '../../lib/designTokens';
import { Button } from './Button';

const CONTROL_BASE =
  'w-full bg-surface-overlay/50 border border-line-strong rounded-control px-4 py-3 text-content-primary placeholder:text-content-muted ' +
  'transition-[border-color,box-shadow] duration-fast ease-standard ' +
  'hover:border-slate-500 focus:outline-none focus:border-brand-500/70 focus:ring-2 focus:ring-brand-500/25';

const CONTROL_ERROR = 'border-red-500/60 focus:border-red-500 focus:ring-red-500/25';

export interface FieldProps {
  label?: string;
  /** Inline validation message rendered below the control (Req 18.3). */
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}

/** Shared label / hint / error scaffolding for form controls (Req 18.1). */
export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cx('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-label text-content-secondary">
          {label}
          {required && (
            <span className="text-brand-400 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-caption text-red-400">
          <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  hint?: string;
  /** Renders an accessible show/hide control for password fields. */
  revealable?: boolean;
  /** Element rendered inside the control on the left. */
  leadingIcon?: ReactNode;
  containerClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    error,
    hint,
    revealable = false,
    leadingIcon,
    className,
    containerClassName,
    type = 'text',
    id: idProp,
    ...rest
  },
  ref,
) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const [revealed, setRevealed] = useState(false);
  const resolvedType = revealable ? (revealed ? 'text' : 'password') : type;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cx('space-y-1.5', containerClassName)}>
      {label && (
        <label htmlFor={id} className="block text-label text-content-secondary">
          {label}
          {rest.required && (
            <span className="text-brand-400 ml-1" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {leadingIcon && (
          <span
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted pointer-events-none"
            aria-hidden="true"
          >
            {leadingIcon}
          </span>
        )}
        <input
          {...rest}
          ref={ref}
          id={id}
          type={resolvedType}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            CONTROL_BASE,
            leadingIcon ? 'pl-11' : undefined,
            revealable ? 'pr-12' : undefined,
            error && CONTROL_ERROR,
            focusRing,
            className,
          )}
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            aria-pressed={revealed}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 inline-flex items-center justify-center rounded-lg text-content-muted hover:text-content-primary transition-colors duration-fast"
          >
            {revealed ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-caption text-red-400">
          <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, containerClassName, id: idProp, children, ...rest },
  ref,
) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cx('space-y-1.5', containerClassName)}>
      {label && (
        <label htmlFor={id} className="block text-label text-content-secondary">
          {label}
        </label>
      )}
      <select
        {...rest}
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cx(CONTROL_BASE, 'appearance-none pr-10', error && CONTROL_ERROR, focusRing, className)}
      >
        {children}
      </select>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-caption text-red-400">
          <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-caption text-content-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Called on submit (Enter key or the Search button). */
  onSubmit?: () => void;
  placeholder?: string;
  /** Accessible name for the control (visually hidden). */
  label?: string;
  className?: string;
}

/** Search control with a visible submit button and an accessible label. */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search…',
  label = 'Search',
  className,
}: SearchFieldProps) {
  const id = useId();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
      className={cx('flex items-center gap-2', className)}
    >
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="relative flex-1 min-w-0">
        <Search
          className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-content-muted"
          aria-hidden="true"
        />
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cx(CONTROL_BASE, 'pl-10 py-2.5', focusRing)}
        />
      </div>
      <Button type="submit" variant="secondary" size="sm">
        Search
      </Button>
    </form>
  );
}
