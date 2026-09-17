import type { ElementType, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cx } from '../../lib/designTokens';

export interface SettingsRowProps {
  icon: ElementType;
  label: string;
  value?: string;
  /** Trailing element such as a badge, toggle, or chevron. */
  trailing?: ReactNode;
  /** When true the row gets hover/active states and a chevron. */
  onClick?: () => void;
  /** Swap the default icon for a status dot or badge. */
  badge?: ReactNode;
  className?: string;
}

/**
 * Single settings row following the pattern used by Monzo, Revolut and Chase:
 * [Icon]  Label           Value / Badge   [Chevron]
 */
export function SettingsRow({ icon: Icon, label, value, trailing, onClick, badge, className }: SettingsRowProps) {
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cx(
        'w-full flex items-center gap-4 px-5 py-4 text-left transition-colors duration-fast ease-standard',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
        interactive
          ? 'hover:bg-surface-overlay/50 active:bg-surface-overlay/70 cursor-pointer'
          : 'cursor-default',
        className,
      )}
    >
      {/* Leading icon */}
      <span className="w-10 h-10 rounded-control bg-surface-overlay/60 flex items-center justify-center shrink-0">
        {badge ?? <Icon className="w-5 h-5 text-content-secondary" aria-hidden="true" />}
      </span>

      {/* Label + value */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-content-primary">{label}</p>
        {value && (
          <p className="text-caption text-content-muted mt-0.5 truncate">{value}</p>
        )}
      </div>

      {/* Trailing element or chevron */}
      {trailing ?? (
        interactive ? (
          <ChevronRight className="w-4 h-4 text-content-muted shrink-0" aria-hidden="true" />
        ) : null
      )}
    </button>
  );
}

/** Section divider with label for grouping settings rows. */
export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section>
      {title && (
        <h3 className="text-label text-content-muted uppercase tracking-wider px-5 mb-1">
          {title}
        </h3>
      )}
      <div className="rounded-card border border-line-subtle bg-surface-raised/40 overflow-hidden divide-y divide-line-subtle">
        {children}
      </div>
    </section>
  );
}

/**
 * Toggle switch for boolean settings like 2FA, notifications, etc.
 */
export function SettingsToggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={cx(
        'relative inline-flex h-7 w-12 shrink-0 rounded-full border-2 border-transparent transition-colors duration-fast',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        enabled ? 'bg-brand-500' : 'bg-slate-600',
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          'pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg transform transition-transform duration-fast',
          enabled ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}