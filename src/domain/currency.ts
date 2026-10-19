const EXPONENTS: Record<string, number> = {
  SGD: 2, KRW: 0, JPY: 0, USD: 2, AUD: 2, EUR: 2, GBP: 2,
  CNY: 2, HKD: 2, MYR: 2, THB: 2, TWD: 2,
};

export const COMMON_CURRENCIES: string[] = Object.keys(EXPONENTS);

export function exponent(code: string): number {
  return EXPONENTS[code.toUpperCase()] ?? 2;
}

export function toMinor(input: string, code: string): number | null {
  const s = input.trim().replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const exp = exponent(code);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > exp) return null;
  const fracPadded = (frac + '0'.repeat(exp)).slice(0, exp);
  return Number(whole) * 10 ** exp + (exp > 0 ? Number(fracPadded) : 0);
}

export function minorToInput(minor: number, code: string): string {
  const exp = exponent(code);
  return exp === 0 ? String(minor) : (minor / 10 ** exp).toFixed(exp);
}

export function formatMoney(minor: number | null, code: string): string {
  const c = code.toUpperCase();
  if (minor === null) return c === 'SGD' ? 'S$ —' : `${c} —`;
  const exp = exponent(c);
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: c,
    minimumFractionDigits: exp,
    maximumFractionDigits: exp,
  }).format(minor / 10 ** exp);
}