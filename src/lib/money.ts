export type CurrencyCode = "USD" | "DOP";

export const CURRENCIES: CurrencyCode[] = ["USD", "DOP"];
export const CURRENCY_COOKIE = "cdj-currency";

const SYMBOL: Record<CurrencyCode, string> = { USD: "$", DOP: "RD$" };

/** Convert minor units between currencies. `rate` = how many DOP per 1 USD. */
export function convert(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: number,
): number {
  if (from === to) return amount;
  return from === "USD" ? Math.round(amount * rate) : Math.round(amount / rate);
}

export function formatMoney(amountMinor: number, currency: CurrencyCode): string {
  const sign = amountMinor < 0 ? "-" : "";
  const abs = Math.abs(amountMinor) / 100;
  const num = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}${SYMBOL[currency]}${num}`;
}

/** Convert then format - used everywhere amounts are shown. */
export function showMoney(
  amountMinor: number,
  from: CurrencyCode,
  display: CurrencyCode,
  rate: number,
): string {
  return formatMoney(convert(amountMinor, from, display, rate), display);
}

/** "125.50" -> 12550 */
export function toMinor(value: number | string): number {
  const n = typeof value === "string" ? parseFloat(value) : value;
  return Math.round(n * 100);
}

export function fromMinor(minor: number): number {
  return minor / 100;
}

/** Bound formatter: `const m = moneyFormatter("DOP", 60); m(1000, "USD")` */
export function moneyFormatter(display: CurrencyCode, rate: number) {
  return (amountMinor: number, from: CurrencyCode) => showMoney(amountMinor, from, display, rate);
}
