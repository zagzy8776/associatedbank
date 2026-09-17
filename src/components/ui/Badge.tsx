import type { ReactNode } from 'react';
import { cx } from '../../lib/designTokens';

export type BadgeTone = 'positive' | 'negative' | 'warning' | 'neutral' | 'brand';

const TONES: Record<BadgeTone, string> = {
  positive: 'text-emerald-400 bg-emerald-400/10',
  negative: 'text-red-400 bg-red-400/10',
  warning: 'text-brand-400 bg-brand-400/10',
  neutral: 'text-content-secondary bg-white/5',
  brand: 'text-brand-300 bg-brand-500/15',
};

const DOTS: Record<BadgeTone, string> = {
  positive: 'bg-emerald-400',
  negative: 'bg-red-400',
  warning: 'bg-brand-400',
  neutral: 'bg-slate-400',
  brand: 'bg-brand-400',
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Status pills show a colour-coded dot (Req 4.5, 17.6). */
  dot?: boolean;
  capitalize?: boolean;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone = 'neutral', dot = false, capitalize = false, children, className }: BadgeProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-caption font-medium',
        capitalize && 'capitalize',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cx('w-1.5 h-1.5 rounded-full', DOTS[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Convenience wrapper mapping account/request status to a tone. */
export function StatusBadge({ status, locked }: { status?: string; locked?: boolean }) {
  if (locked) {
    return (
      <Badge tone="negative" dot>
        Locked
      </Badge>
    );
  }
  const value = (status ?? 'active').toLowerCase();
  const tone: BadgeTone =
    value === 'active' || value === 'approved'
      ? 'positive'
      : value === 'pending'
        ? 'warning'
        : value === 'rejected' || value === 'locked' || value === 'suspended'
          ? 'negative'
          : 'neutral';
  return (
    <Badge tone={tone} dot capitalize>
      {value}
    </Badge>
  );
}