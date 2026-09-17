import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from '../../lib/designTokens';

export type AlertTone = 'error' | 'success' | 'warning' | 'info';

const TONES: Record<AlertTone, { wrap: string; icon: ReactNode; live: 'assertive' | 'polite' }> = {
  error: {
    wrap: 'bg-red-500/10 border-red-500/30 text-red-300',
    icon: <AlertCircle className="w-4 h-4 text-red-400" aria-hidden="true" />,
    live: 'assertive',
  },
  success: {
    wrap: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />,
    live: 'polite',
  },
  warning: {
    wrap: 'bg-brand-500/10 border-brand-500/30 text-brand-200',
    icon: <TriangleAlert className="w-4 h-4 text-brand-400" aria-hidden="true" />,
    live: 'polite',
  },
  info: {
    wrap: 'bg-sky-500/10 border-sky-500/30 text-sky-200',
    icon: <Info className="w-4 h-4 text-sky-400" aria-hidden="true" />,
    live: 'polite',
  },
};

export interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  onDismiss?: () => void;
  className?: string;
  /** Optional recovery guidance row (Req 11.5). */
  action?: ReactNode;
}

/**
 * User friendly feedback banner. Errors and successes are announced to
 * assistive technology (Req 11.4, 11.5).
 */
export function Alert({ tone = 'error', title, children, onDismiss, action, className }: AlertProps) {
  const config = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={config.live}
      className={cx('mb-6 border rounded-control px-4 py-3.5 text-sm animate-fade-in', config.wrap, className)}
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 shrink-0">{config.icon}</span>
        <div className="flex-1 min-w-0">
          {title && <p className="font-medium">{title}</p>}
          {children && <div className={cx(title && 'mt-0.5')}>{children}</div>}
          {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="shrink-0 -mr-1 -mt-1 h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors duration-fast"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}