import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../lib/designTokens';

export interface Crumb {
  label: string;
  /** Omit for the current (non-linked) page. */
  to?: string;
}

/** Breadcrumb trail for sub-pages (Req 10.2, 10.3). */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className={cx('mb-2', className)}>
      <ol className="flex items-center gap-1.5 text-caption text-content-muted">
        {items.map((crumb, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${crumb.label}-${i}`} className="flex items-center gap-1.5 min-w-0">
              {crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  className="hover:text-content-primary transition-colors duration-fast truncate"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-content-secondary truncate" aria-current={isLast ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
              {!isLast && <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Renders a back control; use `onBack` for history navigation. */
  backTo?: string;
  backLabel?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
  /** Sticks the header to the top of the viewport for long pages (Req 10.4). */
  sticky?: boolean;
  /** Adds a border + blur once the page is scrolled (Req 10.5). */
  elevated?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel = 'Back',
  breadcrumbs,
  actions,
  sticky = true,
  elevated = true,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cx(
        sticky && 'sticky top-0 z-header',
        elevated &&
          'border-b border-line-subtle bg-surface/90 backdrop-blur supports-[backdrop-filter]:bg-surface/75',
        className,
      )}
    >
      <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 md:px-8 pt-4 pb-4">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <div className="flex items-center gap-3">
          {backTo && (
            <Link
              to={backTo}
              aria-label={backLabel}
              title={backLabel}
              className="shrink-0 h-11 w-11 -ml-2 inline-flex items-center justify-center rounded-control text-content-secondary hover:text-content-primary hover:bg-surface-overlay/70 transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-title text-content-primary truncate">{title}</h1>
            {subtitle && <div className="text-caption text-content-muted mt-0.5">{subtitle}</div>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

/** Skip link rendered once per page for keyboard users (Req 20.3). */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a href={`#${targetId}`} className="skip-link">
      Skip to main content
    </a>
  );
}