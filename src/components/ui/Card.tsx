import type { ElementType, HTMLAttributes, ReactNode } from 'react';
import { cx } from '../../lib/designTokens';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** `raised` is the default surface for content panels (Req 2.6). */
  variant?: 'raised' | 'outline' | 'dashed';
  /** Adds hover elevation + border highlight for clickable cards (Req 4.3). */
  interactive?: boolean;
  as?: ElementType;
}

const VARIANTS: Record<NonNullable<CardProps['variant']>, string> = {
  raised:
    'bg-gradient-to-br from-surface-raised/70 to-surface-raised/40 border border-line-subtle shadow-card',
  outline: 'bg-surface-raised/40 border border-line-subtle',
  dashed: 'bg-surface-raised/30 border border-dashed border-line-strong',
};

/** Shared container used by every card in the redesign (Req 2.6, 4.1). */
export function Card({
  variant = 'raised',
  interactive = false,
  as: Tag = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Tag
      {...rest}
      className={cx(
        'rounded-card backdrop-blur-sm transition-all duration-slow ease-standard',
        VARIANTS[variant],
        interactive &&
          'hover:border-line-strong hover:shadow-card-hover focus-within:border-brand-500/40',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export interface SectionHeadingProps {
  title: string;
  /** Renders a leading icon for scannable section titles (Req 16.2). */
  icon?: ElementType;
  /** Accent dot instead of an icon. */
  dot?: boolean;
  action?: ReactNode;
  className?: string;
  id?: string;
}

export function SectionHeading({
  title,
  icon: Icon,
  dot = false,
  action,
  className,
  id,
}: SectionHeadingProps) {
  return (
    <div className={cx('flex items-center justify-between gap-4 mb-4', className)}>
      <h2 id={id} className="text-heading text-content-primary flex items-center gap-2.5">
        {Icon ? (
          <Icon className="w-5 h-5 text-brand-400" aria-hidden="true" />
        ) : dot ? (
          <span className="w-2 h-2 rounded-full bg-brand-400" aria-hidden="true" />
        ) : null}
        {title}
      </h2>
      {action}
    </div>
  );
}