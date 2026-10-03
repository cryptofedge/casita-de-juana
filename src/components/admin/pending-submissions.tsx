import Image from "next/image";
import { db } from "@/lib/db";
import { fmtDate, toDateInput, todayLocal } from "@/lib/dates";
import { chargeLabel } from "@/lib/i18n/charge-label";
import { getI18n } from "@/lib/i18n/server";
import { buildLedger } from "@/lib/ledger";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { moneyFormatter } from "@/lib/money";
import { getMoneyContext } from "@/lib/settings";
import { ApproveSubmissionForm, RejectSubmissionForm } from "@/components/admin/submission-forms";
import { FormDialog } from "@/components/forms/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileLink } from "@/components/shared/page";

/** Payments tenants have sent proof for, waiting for the owner to approve or reject. Renders nothing when empty. */
export async function PendingSubmissions() {
  const { t: tr, locale } = await getI18n();
  const { display, rate } = await getMoneyContext();
  const m = moneyFormatter(display, rate);
  const today = todayLocal();

  const subs = await db.paymentSubmission.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: { receipt: true, lease: { include: { unit: true, tenant: true, charges: true, payments: true } } },
  });
  if (subs.length === 0) return null;

  return (
    <section className="mb-8 rounded-xl border border-gold/60 bg-warning-soft/60 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        {tr("Payments waiting for approval")} <Badge tone="amber">{subs.length}</Badge>
      </h2>
      <div className="space-y-3">
        {subs.map((s) => {
          const ledger = buildLedger(s.lease.charges, s.lease.payments, today, s.lease.graceDays);
          const charges = ledger.rows
            .filter((r) => r.remaining > 0)
            .map((r) => ({ id: r.id, label: `${chargeLabel(r, tr, locale)} · ${m(r.remaining, s.lease.currency)}` }));
          const isImg = s.receipt.mime.startsWith("image/") && s.receipt.mime !== "image/heic";
          return (
            <Card key={s.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              {isImg ? (
                <a href={`/api/files/${s.receipt.id}`} target="_blank" rel="noopener noreferrer" aria-label={tr("Receipt")}>
                  <Image src={`/api/files/${s.receipt.id}`} alt={tr("Receipt")} width={96} height={96} unoptimized className="size-24 rounded-lg border object-cover" />
                </a>
              ) : (
                <FileLink id={s.receipt.id} name={s.receipt.filename} mime={s.receipt.mime} label={tr("Receipt")} />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {tr("Apt {unit}", { unit: s.lease.unit.label })} · {s.lease.tenant.name}
                </div>
                <div className="font-display text-2xl font-semibold">{m(s.amount, s.lease.currency)}</div>
                <div className="text-sm text-muted-foreground">
                  {tr(PAYMENT_METHOD_LABEL[s.method])} · {tr("Paid on {date}", { date: fmtDate(s.paidAt, locale) })}
                  {s.reference ? ` · ${s.reference}` : ""}
                </div>
                {s.note && <div className="text-sm">{s.note}</div>}
                <div className="text-xs text-muted-foreground">{tr("Submitted {date}", { date: fmtDate(s.createdAt, locale) })}</div>
              </div>
              <div className="flex gap-2">
                <FormDialog trigger={<Button>{tr("Approve")}</Button>} title="Approve payment" description="Check the details, then approve to post it to the tenant's account.">
                  <ApproveSubmissionForm
                    currency={s.lease.currency}
                    charges={charges}
                    submission={{ id: s.id, amount: (s.amount / 100).toFixed(2), method: s.method, paidAt: toDateInput(s.paidAt) }}
                  />
                </FormDialog>
                <FormDialog trigger={<Button variant="outline">{tr("Reject")}</Button>} title="Reject payment" description="The tenant will be told it was not accepted.">
                  <RejectSubmissionForm submissionId={s.id} />
                </FormDialog>
              </div>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
