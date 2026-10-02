import { getI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil, Plus, Scale, Trash2, UserX } from "lucide-react";
import { db } from "@/lib/db";
import { getLeaseLedger } from "@/lib/billing";
import { fmtDate, toDateInput, todayLocal } from "@/lib/dates";
import { chargeLabel } from "@/lib/i18n/charge-label";
import { CHARGE_TYPE_LABEL, DOC_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { moneyFormatter } from "@/lib/money";
import { getMoneyContext } from "@/lib/settings";
import { deleteChargeAction, deletePaymentAction } from "@/actions/finance";
import { endLeaseAction as endLease } from "@/actions/tenants";
import { AdjustBalanceForm, ChargeForm, PaymentForm } from "@/components/admin/finance-forms";
import { adjustmentBase } from "@/lib/adjust";
import { todayLocal as todayLocalDate } from "@/lib/dates";
import { LeaseForm, ResetLinkButton } from "@/components/admin/tenant-forms";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Badge, PaymentStatusBadge, TicketStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BackLink, EmptyState, FileLink, PageHeader, Stat, TableWrap, Td, Th } from "@/components/shared/page";
import Link from "next/link";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Tenant") };
}
export const dynamic = "force-dynamic";

export default async function TenantDetail({ params }: PageProps<"/admin/tenants/[id]">) {
  const { t: tr, locale } = await getI18n();
  const { id } = await params;
  const tenant = await db.user.findFirst({
    where: { id, role: "TENANT" },
    include: { leases: { orderBy: { startDate: "desc" }, include: { unit: true } } },
  });
  if (!tenant) notFound();
  const lease = tenant.leases.find((l) => l.active) ?? tenant.leases[0];
  if (!lease) notFound();

  const { display, rate } = await getMoneyContext();
  const m = moneyFormatter(display, rate);
  const { ledger, payments } = await getLeaseLedger(lease.id);
  const [docs, tickets] = await Promise.all([
    db.document.findMany({ where: { tenantId: tenant.id }, include: { file: true }, orderBy: { createdAt: "desc" } }),
    db.ticket.findMany({ where: { createdById: tenant.id }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const opt = [{ id: lease.id, unit: lease.unit.label, tenant: tenant.name, currency: lease.currency }];
  const today = toDateInput(todayLocal());
  const rows = [...ledger.rows].reverse();
  const adjBase = lease.active ? adjustmentBase(await db.charge.findMany({ where: { leaseId: lease.id } }), payments, lease.graceDays, todayLocalDate()) : null;

  return (
    <>
      <BackLink href="/admin/tenants">{tr("Tenants & Units")}</BackLink>
      <PageHeader
        title={tenant.name}
        description={`${tr("Apt {unit}", { unit: lease.unit.label })} · ${tenant.email}${tenant.phone ? ` · ${tenant.phone}` : ""}`}
        actions={
          lease.active ? (
            <>
              <FormDialog trigger={<Button><Plus /> {tr("Record payment")}</Button>} title="Record a payment">
                <PaymentForm leases={opt} defaultLeaseId={lease.id} today={today} />
              </FormDialog>
              <FormDialog trigger={<Button variant="outline"><Plus /> {tr("Add charge")}</Button>} title="Add a one-off charge">
                <ChargeForm leases={opt} today={today} />
              </FormDialog>
              {adjBase && (
                <FormDialog trigger={<Button variant="outline"><Scale /> {tr("Adjust balance")}</Button>} title="Adjust balance" description="Set the total balance and the overdue amount directly.">
                  <AdjustBalanceForm
                    leaseId={lease.id}
                    currency={lease.currency}
                    balance={(ledger.balance / 100).toFixed(2)}
                    overdue={(ledger.overdue / 100).toFixed(2)}
                    baseBalance={m(adjBase.balance, lease.currency)}
                    baseOverdue={m(adjBase.overdue, lease.currency)}
                  />
                </FormDialog>
              )}
            </>
          ) : (
            <Badge tone="gray">{tr("Lease ended {date}", { date: fmtDate(lease.endDate, locale) })}</Badge>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr("Balance")} value={m(ledger.balance, lease.currency)} tone={ledger.balance > 0 ? "bad" : "good"} sub={ledger.balance < 0 ? tr("Credit on account") : undefined} />
        <Stat label={tr("Overdue")} value={m(ledger.overdue, lease.currency)} tone={ledger.overdue > 0 ? "bad" : "default"} />
        <Stat label={tr("Monthly rent")} value={m(lease.monthlyRent, lease.currency)} sub={tr("Due day {day} · {days} grace days", { day: lease.dueDay, days: lease.graceDays })} />
        <Stat label={tr("Deposit")} value={m(lease.deposit, lease.currency)} sub={tr("Lease since {date}", { date: fmtDate(lease.startDate, locale) })} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <h2 className="mb-3 text-lg font-semibold">{tr("Ledger")}</h2>
            <TableWrap>
              <thead><tr><Th>{tr("Due")}</Th><Th>{tr("Charge")}</Th><Th className="text-right">{tr("Amount")}</Th><Th className="text-right">{tr("Paid")}</Th><Th>{tr("Status")}</Th><Th><span className="sr-only">{tr("Actions")}</span></Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{fmtDate(r.dueDate, locale)}</Td>
                    <Td>{chargeLabel(r, tr, locale)}<span className="block text-xs text-muted-foreground">{tr(CHARGE_TYPE_LABEL[r.type])}</span></Td>
                    <Td className="text-right tabular-nums">{m(r.amount, lease.currency)}</Td>
                    <Td className="text-right tabular-nums">{m(r.paid, lease.currency)}</Td>
                    <Td><PaymentStatusBadge status={r.status} /></Td>
                    <Td className="text-right">
                      {(r.type === "LATE_FEE" || r.type === "OTHER") && r.amount > 0 && (
                        <ActionButton size="sm" variant="ghost" aria-label={r.type === "LATE_FEE" ? tr("Waive late fee") : tr("Delete charge")} confirm={r.type === "LATE_FEE" ? tr("Waive this late fee?") : tr("Delete this charge?")} action={deleteChargeAction.bind(null, r.id)}>
                          <Trash2 />
                        </ActionButton>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
            <p className="mt-2 text-xs text-muted-foreground">{tr("Payments are applied to the oldest charge first. Late fees are added automatically after the grace period.")}</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">{tr("Payment history")}</h2>
            {payments.length === 0 ? <EmptyState title={tr("No payments yet")} /> : (
              <TableWrap>
                <thead><tr><Th>{tr("Date")}</Th><Th>{tr("Method")}</Th><Th className="text-right">{tr("Amount")}</Th><Th>{tr("Receipt")}</Th><Th><span className="sr-only">{tr("Actions")}</span></Th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td>{fmtDate(p.paidAt, locale)}</Td>
                      <Td>{tr(PAYMENT_METHOD_LABEL[p.method])}{p.reference ? <span className="block text-xs text-muted-foreground">{p.reference}</span> : null}{p.note ? <span className="block text-xs text-muted-foreground">{p.note}</span> : null}</Td>
                      <Td className="text-right font-semibold tabular-nums">{m(p.amount, lease.currency)}</Td>
                      <Td>{p.receipt ? <FileLink id={p.receipt.id} name={p.receipt.filename} mime={p.receipt.mime} label={tr("View")} /> : "-"}</Td>
                      <Td className="text-right"><ActionButton size="sm" variant="ghost" aria-label={tr("Delete payment")} confirm={tr("Delete this payment?")} action={deletePaymentAction.bind(null, p.id)}><Trash2 /></ActionButton></Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{tr("Lease")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-y-1.5">
                <dt className="text-muted-foreground">{tr("Unit")}</dt><dd className="text-right font-medium">{tr("Apt {unit}", { unit: lease.unit.label })}</dd>
                <dt className="text-muted-foreground">{tr("Start")}</dt><dd className="text-right font-medium">{fmtDate(lease.startDate, locale)}</dd>
                <dt className="text-muted-foreground">{tr("End")}</dt><dd className="text-right font-medium">{lease.endDate ? fmtDate(lease.endDate, locale) : tr("Open-ended")}</dd>
                <dt className="text-muted-foreground">{tr("Late fee")}</dt>
                <dd className="text-right font-medium">{lease.lateFeeFlat > 0 ? m(lease.lateFeeFlat, lease.currency) : ""}{lease.lateFeeFlat > 0 && lease.lateFeePercent > 0 ? " + " : ""}{lease.lateFeePercent > 0 ? `${lease.lateFeePercent}%` : lease.lateFeeFlat > 0 ? "" : tr("None")}</dd>
              </dl>
              {lease.active && (
                <>
                  <FormDialog trigger={<Button variant="outline" className="w-full"><Pencil /> {tr("Edit lease terms")}</Button>} title="Edit lease">
                    <LeaseForm lease={{
                      id: lease.id, startDate: toDateInput(lease.startDate), endDate: lease.endDate ? toDateInput(lease.endDate) : "",
                      monthlyRent: (lease.monthlyRent / 100).toFixed(2), currency: lease.currency, dueDay: String(lease.dueDay),
                      graceDays: String(lease.graceDays), lateFeeFlat: (lease.lateFeeFlat / 100).toFixed(2), lateFeePercent: String(lease.lateFeePercent),
                      deposit: (lease.deposit / 100).toFixed(2),
                    }} />
                  </FormDialog>
                  <ResetLinkButton userId={tenant.id} />
                  <ActionButton variant="destructive" className="w-full" confirm={tr("End the lease for {name}? They will no longer be able to sign in.", { name: tenant.name })} action={endLease.bind(null, lease.id)}>
                    <UserX /> {tr("End lease & revoke access")}
                  </ActionButton>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{tr("Documents")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {docs.length === 0 && <p className="text-muted-foreground">{tr("No documents. Upload from the Document Vault.")}</p>}
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <FileLink id={d.file.id} name={d.file.filename} mime={d.file.mime} label={d.title} />
                  <Badge>{tr(DOC_TYPE_LABEL[d.type])}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{tr("Recent requests")}</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {tickets.length === 0 && <p className="text-muted-foreground">{tr("None.")}</p>}
              {tickets.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/maintenance/${t.id}`} className="truncate font-medium hover:underline">{t.title}</Link>
                  <TicketStatusBadge status={t.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
