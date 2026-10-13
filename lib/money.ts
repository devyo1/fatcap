// Prices are stored as whole cents. Shared by the server and the listing form.

export const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];
export const isCurrency = (v: unknown): v is Currency => CURRENCIES.includes(v as Currency);

/** "12", "$12.50", "12,50" -> cents. Empty or nonsense -> null. */
export function toCents(v: string | null | undefined): number | null {
  const s = String(v ?? '').replace(/[^0-9.,]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/,/g, '');
  if (!s) return null;
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) && n >= 0 && n <= 100_000_000 ? n : null;
}

/** 1200 -> "$12", 1250 -> "$12.50"; USD shows as "US$12". */
export function money(cents: number | null | undefined, currency: string = 'CAD') {
  if (cents == null) return '';
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-CA', {
    style: 'currency', currency, minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2,
  }).format(cents / 100);
}
