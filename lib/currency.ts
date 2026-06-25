// Currency helpers. Entry fees are stored as a plain number plus an ISO 4217
// currency code on each pool; formatting is centralized here so the whole UI
// renders amounts consistently (and so a fee of 0 can be hidden uniformly).

export interface CurrencyOption {
  code: string; // ISO 4217
  label: string;
  symbol: string;
}

// The currencies an organizer can pick for a pool. Extend freely.
export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'CA$' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'BRL', label: 'Brazilian Real', symbol: 'R$' },
];

export const DEFAULT_CURRENCY = 'USD';

export function isSupportedCurrency(code: string | undefined | null): boolean {
  return !!code && CURRENCIES.some((c) => c.code === code);
}

export function currencySymbol(code: string = DEFAULT_CURRENCY): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol || '';
}

/** Format an amount in the given currency. Whole numbers drop the decimals
 *  (e.g. $10, ₹500); fractional amounts keep two ($10.50). */
export function formatMoney(amount: number, code: string = DEFAULT_CURRENCY): string {
  const currency = isSupportedCurrency(code) ? (code as string) : DEFAULT_CURRENCY;
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    // Unknown currency to Intl — fall back to a symbol prefix.
    return `${currencySymbol(currency)}${amount.toLocaleString()}`;
  }
}
