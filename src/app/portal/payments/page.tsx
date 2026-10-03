import type { Metadata } from "next";
import { getLeaseLedger } from "@/lib/billing";
import { fmtDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { chargeLabel } from "@/lib/i18n/charge-label";
import { db } from "@/lib/db";
import { toDateInput, todayLocal } from "@/lib/dates";
import { Plus } from "lucide-react";
import { FormDialog } from "@/components/forms/form-dialog";
import { SubmitProofForm } from "@/components/portal/submit-proof-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CHARGE_TYPE_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { moneyFormatter } from "@/lib/money";
import { requireTenant } from "@/lib/session";
import { getMoneyContext } from "@/lib/settings";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, FileLink } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Rent & payments") };
}
export const dynamic = "force-dynamic";

export default async function PortalPayments() {
  const { lease } = await requireTenant();
  const { t, locale } = await getI18n();
  if (!lease) return <EmptyState title={t("No active lease")} />;
  const { display, rate } = await getMoneyContext(lease.currency);
  const m = moneyFormatter(display, rate);
  // Scoped to the signed-in tenant's own lease (from the session, never from the URL)
  const { ledger, payments } = await getLeaseLedger(lease.id);
  const rows = [...ledger.rows].reverse();
  const submissions = await db.paymentSubmission.findMany({ where: { leaseId: lease.id }, orderBy: { createdAt: "desc" }, take: 10, include: { receipt: true } });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{t("Rent & payments")}</h1>

      <Card className="p-4">
        <div className="text-sm text-muted-foreground">{ledger.balance < 0 ? t("Credit") : t("Balance")}</div>
        <div className={`font-display text-3xl font-semibold ${ledger.balance > 0 ? "text-destructive" : "text-success"}`}>{m(Math.abs(ledger.balance), lease.currency)}</div>
        <div className="mt-3 flex justify-between border-t pt-3 text-sm">
          <span className="text-muted-foreground">{t("Monthly rent")} <strong className="text-foreground">{m(lease.monthlyRent, lease.currency)}</strong></span>
          <span className="text-muted-foreground">{t("Due day")} <strong className="text-foreground">{lease.dueDay}</strong></span>
        </div>
      </Card>

      <FormDialog
        trigger={<Button size="lg" className="w-full"><Plus /> {t("I made a payment")}</Button>}
        title="Send proof of payment"
        description="Upload a screenshot or receipt. The owner will review it and, once approved, it appears in your payments."
      >
        <SubmitProofForm currency={lease.currency} today={toDateInput(todayLocal())} />
      </FormDialog>

      {submissions.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{t("Payments sent for review")}</h2>
          <div className="space-y-2">
            {submissions.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold tabular-nums">{m(s.amount, lease.currency)}</div>
                    <div className="text-xs text-muted-foreground">{t(PAYMENT_METHOD_LABEL[s.method])} · {t("Paid on {date}", { date: fmtDate(s.paidAt, locale) })}</div>
                  </div>
                  <Badge tone={s.status === "APPROVED" ? "green" : s.status === "REJECTED" ? "red" : "amber"}>
                    {t(s.status === "APPROVED" ? "Approved" : s.status === "REJECTED" ? "Rejected" : "Waiting for approval")}
                  </Badge>
                </div>
                {s.status === "REJECTED" && s.rejectReason && <div className="mt-2 text-sm text-destructive">{t("Reason: {reason}", { reason: s.rejectReason })}</div>}
                <div className="mt-2"><FileLink id={s.receipt.id} name={s.receipt.filename} mime={s.receipt.mime} label={t("Receipt")} /></div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("Charges")}</h2>
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{chargeLabel(r, t, locale)}</div>
                  <div className="text-xs text-muted-foreground">{t("{type} · due {date}", { type: t(CHARGE_TYPE_LABEL[r.type]), date: fmtDate(r.dueDate, locale) })}</div>
                </div>
                <PaymentStatusBadge status={r.status} label={t(PAYMENT_STATUS_LABEL[r.status])} />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">{r.paid > 0 && r.remaining > 0 ? t("{amount} paid · ", { amount: m(r.paid, lease.currency) }) : ""}{r.remaining > 0 ? t("{amount} left", { amount: m(r.remaining, lease.currency) }) : t("Paid in full")}</span>
                <span className="font-semibold tabular-nums">{m(r.amount, lease.currency)}</span>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("Late fee: {fee} after {days} grace days.", { fee: lease.lateFeeFlat === 0 && lease.lateFeePercent === 0 ? t("none") : `${lease.lateFeeFlat > 0 ? m(lease.lateFeeFlat, lease.currency) : ""}${lease.lateFeeFlat > 0 && lease.lateFeePercent > 0 ? " + " : ""}${lease.lateFeePercent > 0 ? `${lease.lateFeePercent}%` : ""}`, days: lease.graceDays })}</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">{t("Payments you made")}</h2>
        {payments.length === 0 ? <EmptyState title={t("No payments recorded yet")} /> : (
          <div className="space-y-2">
            {payments.map((p) => (
              <Card key={p.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold tabular-nums text-success">{m(p.amount, lease.currency)}</div>
                  <div className="text-xs text-muted-foreground">{fmtDate(p.paidAt, locale)} · {t(PAYMENT_METHOD_LABEL[p.method])}{p.reference ? ` · ${p.reference}` : ""}</div>
                </div>
                {p.receipt && <FileLink id={p.receipt.id} name={p.receipt.filename} mime={p.receipt.mime} label={t("Receipt")} />}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
