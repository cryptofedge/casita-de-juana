import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import type { Metadata } from "next";
import { Download, Plus, Printer, RefreshCw } from "lucide-react";
import { db } from "@/lib/db";
import { runBilling } from "@/lib/billing";
import { currentPeriod, fmtDate, fmtPeriod, todayLocal, toDateInput } from "@/lib/dates";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { moneyFormatter } from "@/lib/money";
import { getMoneyContext } from "@/lib/settings";
import { buildStatement } from "@/lib/statement";
import { deletePaymentAction, runBillingAction } from "@/actions/finance";
import { ChargeForm, PaymentForm } from "@/components/admin/finance-forms";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { EmptyState, FileLink, PageHeader, Stat, TableWrap, Td, Th } from "@/components/shared/page";
import { Trash2 } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Rent & Payments") };
}
export const dynamic = "force-dynamic";

export default async function FinancePage({ searchParams }: PageProps<"/admin/finance">) {
  const { t: tr, locale } = await getI18n();
  const sp = await searchParams;
  const raw = typeof sp.month === "string" ? sp.month : "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentPeriod();

  await runBilling();
  const { display, rate } = await getMoneyContext();
  const m = moneyFormatter(display, rate);
  const st = await buildStatement(month, display, rate);

  const [activeLeases, recent] = await Promise.all([
    db.lease.findMany({ where: { active: true }, include: { unit: true, tenant: true }, orderBy: { unit: { label: "asc" } } }),
    db.payment.findMany({
      orderBy: { paidAt: "desc" },
      take: 15,
      include: { lease: { include: { unit: true, tenant: true } }, receipt: true },
    }),
  ]);
  const options = activeLeases.map((l) => ({ id: l.id, unit: l.unit.label, tenant: l.tenant.name, currency: l.currency }));
  const today = toDateInput(todayLocal());

  return (
    <>
      <PageHeader
        title={tr("Rent & Payments")}
        description={tr("Statement for {period} · shown in {cur} (1 USD = {rate} DOP)", { period: fmtPeriod(month, locale), cur: display, rate })}
        actions={
          <>
            {options.length > 0 && (
              <>
                <FormDialog trigger={<Button><Plus /> {tr("Record payment")}</Button>} title="Record a payment" description="Log cash, bank transfer, PayPal or Stripe payments received.">
                  <PaymentForm leases={options} today={today} />
                </FormDialog>
                <FormDialog trigger={<Button variant="outline"><Plus /> {tr("Add charge")}</Button>} title="Add a one-off charge" description="For repairs, keys, extra fees, etc.">
                  <ChargeForm leases={options} today={today} />
                </FormDialog>
              </>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <form method="get" className="flex items-end gap-2">
          <label className="text-sm font-medium">
            <span className="mb-1 block">{tr("Month")}</span>
            <input type="month" name="month" defaultValue={month} className="h-10 rounded-lg border border-input bg-card px-3" />
          </label>
          <Button type="submit" variant="secondary">{tr("Go")}</Button>
        </form>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href={`/api/admin/statement?month=${month}`}><Download /> {tr("Export CSV")}</a></Button>
          <Button asChild variant="outline"><Link href={`/admin/finance/statement?month=${month}`}><Printer /> {tr("Print / PDF")}</Link></Button>
          <ActionButton variant="ghost" action={runBillingAction}><RefreshCw /> {tr("Run billing")}</ActionButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={tr("Opening balance")} value={m(st.totals.opening, display)} />
        <Stat label={tr("Billed this month")} value={m(st.totals.billed, display)} />
        <Stat label={tr("Collected")} value={m(st.totals.paid, display)} tone="good" />
        <Stat label={tr("Closing balance")} value={m(st.totals.closing, display)} tone={st.totals.closing > 0 ? "bad" : "default"} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">{tr("By unit")}</h2>
      {st.rows.length === 0 ? (
        <EmptyState title={tr("No activity for this month")} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>{tr("Unit")}</Th><Th>{tr("Tenant")}</Th>
              <Th className="text-right">{tr("Opening")}</Th><Th className="text-right">{tr("Billed")}</Th><Th className="text-right">{tr("Paid")}</Th><Th className="text-right">{tr("Closing")}</Th>
              <Th>{tr("Rent")}</Th>
            </tr>
          </thead>
          <tbody>
            {st.rows.map((r) => (
              <tr key={r.leaseId}>
                <Td className="font-semibold">{r.unit}</Td>
                <Td>{r.tenant}</Td>
                <Td className="text-right tabular-nums">{m(r.opening, display)}</Td>
                <Td className="text-right tabular-nums">{m(r.billed, display)}</Td>
                <Td className="text-right tabular-nums text-success">{m(r.paid, display)}</Td>
                <Td className={`text-right font-semibold tabular-nums ${r.closing > 0 ? "text-destructive" : ""}`}>{m(r.closing, display)}</Td>
                <Td>{r.rentStatus ? <PaymentStatusBadge status={r.rentStatus} /> : "-"}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">{tr("Recent payments")}</h2>
      {recent.length === 0 ? (
        <EmptyState title={tr("No payments logged yet")} />
      ) : (
        <TableWrap>
          <thead>
            <tr><Th>{tr("Date")}</Th><Th>{tr("Unit")}</Th><Th>{tr("Method")}</Th><Th className="text-right">{tr("Amount")}</Th><Th>{tr("Receipt")}</Th><Th><span className="sr-only">{tr("Actions")}</span></Th></tr>
          </thead>
          <tbody>
            {recent.map((p) => (
              <tr key={p.id}>
                <Td>{fmtDate(p.paidAt, locale)}</Td>
                <Td><span className="font-semibold">{p.lease.unit.label}</span> <span className="text-muted-foreground">{p.lease.tenant.name}</span></Td>
                <Td>{tr(PAYMENT_METHOD_LABEL[p.method])}{p.reference ? <span className="block text-xs text-muted-foreground">{p.reference}</span> : null}</Td>
                <Td className="text-right font-semibold tabular-nums">{m(p.amount, p.lease.currency)}</Td>
                <Td>{p.receipt ? <FileLink id={p.receipt.id} name={p.receipt.filename} mime={p.receipt.mime} label={tr("View")} /> : <span className="text-muted-foreground">-</span>}</Td>
                <Td className="text-right">
                  <ActionButton size="sm" variant="ghost" aria-label={tr("Delete payment")} confirm={tr("Delete this payment? The tenant balance will increase.")} action={deletePaymentAction.bind(null, p.id)}>
                    <Trash2 />
                  </ActionButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
