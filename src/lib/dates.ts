// The property is in the Dominican Republic (UTC-4, no DST). All "date only"
// values are stored as UTC midnight so they never shift when rendered.
const TZ = "America/Santo_Domingo";

type Loc = "en" | "es";
const tag = (l: Loc) => (l === "es" ? "es-DO" : "en-US");

export function todayLocal(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now); // YYYY-MM-DD
  return new Date(`${parts}T00:00:00.000Z`);
}

export function periodOf(d: Date): string {
  return d.toISOString().slice(0, 7);
}

export function currentPeriod(): string {
  return periodOf(todayLocal());
}

export function periodStart(period: string): Date {
  return new Date(`${period}-01T00:00:00.000Z`);
}

export function periodEnd(period: string): Date {
  const s = periodStart(period);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
}

export function addMonths(period: string, n: number): string {
  const s = periodStart(period);
  return periodOf(new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + n, 1)));
}

export function dueDateFor(period: string, dueDay: number): Date {
  const s = periodStart(period);
  const day = Math.min(Math.max(dueDay, 1), 28);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), day));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

export function fmtDate(d: Date | string | null | undefined, locale: Loc = "en"): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString(tag(locale), {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtPeriod(period: string, locale: Loc = "en"): string {
  const s = periodStart(period).toLocaleDateString(tag(locale), {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  return s.charAt(0).toUpperCase() + s.slice(1); // Spanish months are lowercase
}

export function toDateInput(d: Date | string): string {
  return new Date(d).toISOString().slice(0, 10);
}

export function parseDateInput(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}
