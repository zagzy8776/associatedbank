import type { ElementType, ReactNode } from 'react';
import { cx } from '../../lib/designTokens';

export interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  /** Primary call to action (Req 11.2). */
  action?: ReactNode;
  /** Secondary guidance rendered under the action. */
  hint?: string;
  className?: string;
}

/** Friendly empty state with guidance and a call to action (Req 11.2). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  hint,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cx(
        'rounded-card border border-dashed border-line-strong bg-surface-raised/30 px-6 py-10 lg:py-12 text-center',
        className,
      )}
    >
      <div className="max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-card bg-surface-overlay/60 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-content-muted" aria-hidden="true" />
        </div>
        <h3 className="text-heading text-content-primary mb-2">{title}</h3>
        {description && <p className="text-sm text-content-secondary mb-6">{description}</p>}
        {action}
        {hint && <p className="text-caption text-content-muted mt-5">{hint}</p>}
      </div>
    </div>
  );
}