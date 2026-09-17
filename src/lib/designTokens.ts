/**
 * Design tokens (Req 1.1, 1.2, 1.3, 1.4, 14.1, 14.2).
 *
 * These constants mirror the Tailwind theme extensions in `tailwind.config.js`
 * and the CSS custom properties in `src/index.css`. They are the typed source
 * of truth used when a value is needed in JavaScript (inline styles, dynamic
 * class names) rather than through a utility class.
 */

export interface DesignTokens {
  colors: {
    /** Amber brand accent used for primary actions. */
    brand: string;
    brandSoft: string;
    /** Positive state — active accounts and credits. */
    positive: string;
    negative: string;
    warning: string;
    info: string;
    /** Neutral surfaces. */
    surface: string;
    surfaceRaised: string;
    surfaceOverlay: string;
    contentPrimary: string;
    contentSecondary: string;
    contentMuted: string;
    lineSubtle: string;
    lineStrong: string;
  };
  /** 4px based spacing scale (Req 1.2, 19.1). */
  space: Record<'1' | '2' | '3' | '4' | '6' | '8' | '12', string>;
  /** Typography scale (Req 1.3) — size / line-height / tracking / weight. */
  type: Record<
    'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'micro',
    { size: string; lineHeight: string; letterSpacing?: string; weight?: number }
  >;
  /** Motion durations between 150ms and 300ms (Req 1.4). */
  duration: Record<'fast' | 'base' | 'slow', number>;
  easing: Record<'standard' | 'emphasized', string>;
  radius: Record<'control' | 'card' | 'panel', string>;
  zIndex: Record<'header' | 'overlay' | 'modal' | 'toast', number>;
}

export const tokens: DesignTokens = {
  colors: {
    brand: '#f59e0b',
    brandSoft: '#fbbf24',
    positive: '#34d399',
    negative: '#f87171',
    warning: '#fbbf24',
    info: '#38bdf8',
    surface: '#0b1220',
    surfaceRaised: '#1a2332',
    surfaceOverlay: '#1e293b',
    contentPrimary: '#f8fafc',
    contentSecondary: '#94a3b8',
    contentMuted: '#64748b',
    lineSubtle: '#1e293b',
    lineStrong: '#334155',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    6: '24px',
    8: '32px',
    12: '48px',
  },
  type: {
    display: { size: '2.5rem', lineHeight: '1.1', letterSpacing: '-0.02em', weight: 700 },
    title: { size: '1.5rem', lineHeight: '1.25', letterSpacing: '-0.01em', weight: 600 },
    heading: { size: '1.125rem', lineHeight: '1.4', weight: 600 },
    body: { size: '0.9375rem', lineHeight: '1.6' },
    label: { size: '0.8125rem', lineHeight: '1.4', weight: 500 },
    caption: { size: '0.75rem', lineHeight: '1.4' },
    micro: { size: '0.6875rem', lineHeight: '1.4' },
  },
  duration: { fast: 150, base: 200, slow: 300 },
  easing: {
    standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
    emphasized: 'cubic-bezier(0.2, 0, 0, 1)',
  },
  radius: { control: '0.75rem', card: '1rem', panel: '1.25rem' },
  zIndex: { header: 40, overlay: 50, modal: 60, toast: 70 },
};

/** Standard focus ring used by every interactive element (Req 20.1). */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

/**
 * Minimal class name joiner. Accepts strings, falsy values and nested arrays
 * so conditional variants stay readable without pulling in a dependency.
 */
export function cx(...parts: Array<string | false | null | undefined | string[]>): string {
  const out: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (Array.isArray(part)) {
      const nested = cx(...part);
      if (nested) out.push(nested);
    } else {
      out.push(part);
    }
  }
  return out.join(' ');
}
