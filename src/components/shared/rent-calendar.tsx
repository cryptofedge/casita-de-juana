import { CalendarCheck, Check, Sparkles } from "lucide-react";
import { fmtPeriod, fmtPeriodShort } from "@/lib/dates";
import { chargeLabel } from "@/lib/i18n/charge-label";
import type { Locale, TFn } from "@/lib/i18n";
import type { MonthStatus, PaymentUse, RentCalendar } from "@/lib/rent-calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TILE: Record<MonthStatus, string> = {
  PAID: "border-success/30 bg-success-soft text-success",
  PREPAID: "border-primary/50 bg-info-soft text-primary shadow-sm",
  PART_PREPAID: "border-dashed border-primary/50 bg-card text-primary",
  PARTIAL: "border-gold/60 bg-warning-soft text-[#8a5a00]",
  DUE: "border-gold/60 bg-warning-soft text-[#8a5a00]",
  OVERDUE: "border-destructive/40 bg-destructive-soft text-destructive",
  UPCOMING: "border-border bg-card text-muted-foreground",
};

const LABEL: Record<MonthStatus, string> = {
  PAID: "Paid",
  PREPAID: "Paid ahead",
  PART_PREPAID: "Part paid ahead",
  PARTIAL: "Partly paid",
  DUE: "Due",
  OVERDUE: "Overdue",
  UPCOMING: "Not paid yet",
};

/** "Rent paid ahead through February 2027" + how much credit covers how many months. Renders nothing without a full month ahead. */
export function PaidAheadBanner({ cal, t, locale, money }: { cal: RentCalendar; t: TFn; locale: Locale; money: (n: number) => string }) {
  if (cal.monthsAhead < 1 || !cal.paidThrough) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-info-soft p-3">
      <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0">
        <div className="font-semibold text-primary">{t("Rent paid ahead through {month}", { month: fmtPeriod(cal.paidThrough, locale) })}</div>
        <div className="text-sm text-muted-foreground">
          {cal.monthsAhead === 1
            ? t("{amount} paid in advance covers 1 more month.", { amount: money(cal.credit) })
            : t("{amount} paid in advance covers {n} more months.", { amount: money(cal.credit), n: cal.monthsAhead })}
        </div>
      </div>
    </div>
  );
}

/** Month-by-month rent: paid, due, overdue and paid ahead. */
export function RentCalendarCard({ cal, t, locale, money }: { cal: RentCalendar; t: TFn; locale: Locale; money: (n: number) => string }) {
  const statuses = [...new Set(cal.months.map((m) => m.status))];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarCheck className="size-5 text-primary" /> {t("Rent calendar")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <PaidAheadBanner cal={cal} t={t} locale={locale} money={money} />
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {cal.months.map((m) => (
            <li
              key={m.period}
              className={cn("rounded-lg border px-1.5 py-2 text-center", TILE[m.status], m.current && "ring-2 ring-foreground/30 ring-offset-1")}
              title={`${fmtPeriod(m.period, locale)} · ${t(LABEL[m.status])}`}
            >
              <div className="text-xs font-semibold">{fmtPeriodShort(m.period, locale)}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold leading-tight">
                {(m.status === "PAID" || m.status === "PREPAID") && <Check className="size-3 shrink-0" />}
                {t(LABEL[m.status])}
              </div>
              {m.current && <div className="mt-0.5 text-[10px] text-muted-foreground">{t("This month")}</div>}
            </li>
          ))}
        </ol>
        {statuses.includes("PREPAID") || statuses.includes("PART_PREPAID") ? (
          <p className="text-xs text-muted-foreground">{t("Money paid ahead covers the next months' rent in order. New charges, like electricity, are paid from it first.")}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * "Rent - December 2026 (paid ahead)" / "Rent - December 2026 to February 2027 (paid ahead)" /
 * "Rent - October 2026 ($350.00), Past Balance ($270.00)".
 */
export function paymentCovers(uses: PaymentUse[] | undefined, t: TFn, locale: Locale, money: (n: number) => string): string {
  if (!uses || uses.length === 0) return "";
  const parts: { label: string; amount: number }[] = uses
    .filter((u) => !u.ahead)
    .map((u) => ({ label: chargeLabel({ type: u.type ?? "OTHER", period: u.period, description: u.description ?? "" }, t, locale), amount: u.amount }));
  // Months paid in advance are consecutive for one payment: show them as a range.
  const ahead = uses.filter((u) => u.ahead && u.period);
  const aheadTotal = ahead.reduce((s, u) => s + u.amount, 0);
  if (ahead.length === 1) parts.push({ label: t("Rent - {month} (paid ahead)", { month: fmtPeriod(ahead[0].period, locale) }), amount: aheadTotal });
  if (ahead.length > 1) {
    parts.push({
      label: t("Rent - {from} to {to} (paid ahead)", { from: fmtPeriod(ahead[0].period, locale), to: fmtPeriod(ahead[ahead.length - 1].period, locale) }),
      amount: aheadTotal,
    });
  }
  const beyond = uses.filter((u) => u.ahead && !u.period).reduce((s, u) => s + u.amount, 0);
  if (beyond > 0) parts.push({ label: t("Credit for later months"), amount: beyond });
  if (parts.length === 1) return parts[0].label;
  return parts.map((p) => `${p.label} (${money(p.amount)})`).join(", ");
}

/** A payment's details for the owner: what it paid for, its reference and the note typed with it. */
export function PaymentDetails({ covers, reference, note, tr }: { covers: string; reference?: string | null; note?: string | null; tr: TFn }) {
  if (!covers && !reference && !note) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="space-y-0.5">
      {covers && <div><span className="text-muted-foreground">{tr("Paid for:")}</span> <span className="font-medium">{covers}</span></div>}
      {reference && <div><span className="text-muted-foreground">{tr("Ref:")}</span> {reference}</div>}
      {note && <div className="whitespace-pre-wrap text-muted-foreground"><span>{tr("Note:")}</span> {note}</div>}
    </div>
  );
}

/** Short status for lists: "Paid through Feb 2027" when rent is paid ahead, otherwise null. */
export function paidAheadShort(cal: RentCalendar, t: TFn, locale: Locale): string | null {
  if (cal.monthsAhead < 1 || !cal.paidThrough) return null;
  return t("Paid through {month}", { month: fmtPeriodShort(cal.paidThrough, locale) });
}
