/**
 * Rubicon Capital brand mark — geometric monogram with a diagonal "crossing"
 * (the Rubicon metaphor). Works on dark and light surfaces.
 */
import { cx } from '../lib/designTokens';

interface BrandLogoProps {
  className?: string;
  /** Show wordmark beside the mark */
  withWordmark?: boolean;
  /** Pixel size of the square mark */
  size?: number;
  /** Light text for dark backgrounds (default true) */
  light?: boolean;
}

export function BrandLogo({
  className,
  withWordmark = true,
  size = 36,
  light = true,
}: BrandLogoProps) {
  const gold = '#f59e0b';
  const goldDeep = '#d97706';
  const ink = light ? '#0b1220' : '#f8fafc';

  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="rc-mark-g" x1="8" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor={gold} />
            <stop offset="1" stopColor={goldDeep} />
          </linearGradient>
          <linearGradient id="rc-mark-sheen" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fde68a" stopOpacity="0.35" />
            <stop offset="0.5" stopColor={gold} stopOpacity="0" />
            <stop offset="1" stopColor={goldDeep} stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {/* Rounded plate */}
        <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#rc-mark-g)" />
        <rect x="1" y="1" width="38" height="38" rx="10" fill="url(#rc-mark-sheen)" />
        {/* Inner frame */}
        <rect
          x="4.5"
          y="4.5"
          width="31"
          height="31"
          rx="7.5"
          stroke={ink}
          strokeOpacity="0.12"
          strokeWidth="1"
        />
        {/* Stylized R with crossing bar (Rubicon) */}
        <path
          d="M12.5 28.5V11.5h8.2c3.35 0 5.55 1.95 5.55 4.85 0 2.35-1.25 3.95-3.35 4.55l3.9 7.6h-3.15l-3.55-7.1h-4.45v7.1H12.5zm3.15-9.85h4.9c1.7 0 2.7-0.95 2.7-2.35 0-1.4-1-2.3-2.7-2.3h-4.9v4.65z"
          fill={ink}
        />
        {/* Diagonal crossing line */}
        <path
          d="M9 31.5 L31 8.5"
          stroke={ink}
          strokeOpacity="0.22"
          strokeWidth="1.25"
          strokeLinecap="round"
        />
      </svg>
      {withWordmark && (
        <span
          className={cx(
            'font-semibold tracking-tight leading-none',
            light ? 'text-white' : 'text-slate-900',
          )}
          style={{ fontSize: Math.max(14, size * 0.42) }}
        >
          Rubicon{' '}
          <span className={light ? 'text-slate-300' : 'text-slate-600'}>Capital</span>
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
