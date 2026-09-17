/**
 * Formatting utilities (Req 1.5, 14.1, 16.4).
 *
 * `formatMoney` and `formatDate` keep their original signatures so existing
 * imports from `src/lib/api.ts` continue to work — `api.ts` re-exports them.
 */

/** Masking pattern applied to every hidden balance (Req 5.3, 15.6). */
export const BALANCE_MASK = '••••••';

/** Masking pattern applied to account numbers (Req 4.2). */
export const ACCOUNT_MASK = '••••';

export function formatMoney(amount: number | string, currency = 'GBP') {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(n || 0);
}

/** Splits a formatted currency value into symbol and numeric parts. */
export function splitMoney(amount: number | string, currency = 'GBP') {
  const formatted = formatMoney(amount, currency);
  const match = formatted.match(/^([^\d-]*)(.*)$/);
  return {
    formatted,
    symbol: match?.[1]?.trim() ?? '',
    value: match?.[2] ?? formatted,
  };
}

export function formatDate(d: string) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Compact date without the time component, used in dense table rows. */
export function formatShortDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function titleCase(name: string) {
  if (!name) return 'Account';
  return name
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** `••••1234` style account number masking. */
export function maskAccountNumber(num?: string | null) {
  if (!num) return ACCOUNT_MASK;
  const clean = String(num).replace(/\s/g, '');
  if (clean.length <= 4) return `${ACCOUNT_MASK}${clean}`;
  return `${ACCOUNT_MASK}${clean.slice(-4)}`;
}

/**
 * Single entry point for balance masking so the same pattern is used
 * everywhere a balance is rendered (Req 5.5).
 */
export function maskBalance(formatted: string, hidden: boolean) {
  return hidden ? BALANCE_MASK : formatted;
}

/** `1,204.50` style plain number for input values. */
export function formatAmountInput(amount: number | string) {
  const n = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(n)) return '';
  return n.toFixed(2);
}

/** Relative label such as `Today`, `Yesterday`, or the short date. */
export function formatRelativeDay(d: string) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return formatShortDate(d);
}
