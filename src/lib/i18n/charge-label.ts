import { fmtPeriod } from "@/lib/dates";
import type { Locale, TFn } from "./index";

/**
 * Charge descriptions are stored in English in the database. For display we rebuild
 * them from type + period so tenants see them in their language.
 */
export function chargeLabel(
  r: { type: string; period: string; description: string },
  t: TFn,
  locale: Locale,
): string {
  const p = fmtPeriod(r.period, locale);
  switch (r.type) {
    case "RENT":
      return `${t("Rent")} - ${p}`;
    case "ELECTRICITY": {
      const kwh = r.description.match(/\(([\d.]+) kWh\)/);
      return `${t("Electricity")} - ${p}${kwh ? ` (${kwh[1]} kWh)` : ""}`;
    }
    case "LATE_FEE":
      return `${t("Late fee")} - ${p}${/waived/i.test(r.description) ? ` (${t("waived")})` : ""}`;
    default:
      return t(r.description); // e.g. "Balance adjustment (overdue)"; free text passes through unchanged
  }
}
