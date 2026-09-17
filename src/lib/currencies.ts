/**
 * Currency metadata for the three supported currencies (Req 3.1, 3.2, 16.1).
 * Shared by Dashboard, AccountDetail and the public landing page so flags,
 * names and symbols never drift between views.
 */

export interface CurrencyMeta {
  code: 'GBP' | 'USD' | 'EUR';
  /** Currency symbol used in compact contexts. */
  symbol: string;
  /** Full display name. */
  label: string;
  /** Flag emoji used as the currency indicator. */
  flag: string;
  /** Tailwind text colour class for the currency accent. */
  accent: string;
}

export const CURRENCIES: CurrencyMeta[] = [
  { code: 'GBP', symbol: '£', label: 'British Pound', flag: '🇬🇧', accent: 'text-brand-400' },
  { code: 'USD', symbol: '$', label: 'US Dollar', flag: '🇺🇸', accent: 'text-emerald-400' },
  { code: 'EUR', symbol: '€', label: 'Euro', flag: '🇪🇺', accent: 'text-sky-400' },
];

const FALLBACK: CurrencyMeta = {
  code: 'GBP',
  symbol: '£',
  label: 'British Pound',
  flag: '🏦',
  accent: 'text-brand-400',
};

export function currencyMeta(code?: string | null): CurrencyMeta {
  if (!code) return FALLBACK;
  return CURRENCIES.find((c) => c.code === code.toUpperCase()) ?? { ...FALLBACK, code: code as CurrencyMeta['code'] };
}

/** Currency symbol for a code, falling back to the code itself. */
export function currencySymbol(code?: string | null) {
  const meta = currencyMeta(code);
  return CURRENCIES.some((c) => c.code === meta.code) ? meta.symbol : (code ?? '');
}

/** Flat list of supported currency codes. */
export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
