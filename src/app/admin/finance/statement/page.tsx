import type { Metadata } from "next";
import Link from "next/link";
import { currentPeriod, fmtDate, fmtPeriod } from "@/lib/dates";
import { CHARGE_TYPE_LABEL, PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { moneyFormatter } from "@/lib/money";
import { getMoneyContext } from "@/lib/settings";
import { buildStatement } from "@/lib/statement";
import { Logo } from "@/components/shared/brand";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Financial statement" };
export const dynamic = "force-dynamic";

export default async function StatementPage({ searchParams }: PageProps<"/admin/finance/statement">) {
  const sp = await searchParams;
  const raw = typeof sp.month === "string" ? sp.month : "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : currentPeriod();
  const { display, rate, settings } = await getMoneyContext();
  const m = moneyFormatter(display, rate);
  const st = await buildStatement(month, display, rate);

  return (
    <div>
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/admin/finance?month=${month}`} className="text-sm font-medium text-primary hover:underline">← Back</Link>
        <PrintButton />
      </div>
      <article className="print-area rounded-xl border bg-white p-6 shadow-sm sm:p-8">
        <header className="flex items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <Logo size={56} />
            <div>
              <h1 className="text-2xl font-semibold text-primary">{settings.propertyName}</h1>
              <p className="text-sm text-muted-foreground">{settings.propertyAddress}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-lg font-semibold">Financial statement</div>
            <div className="text-sm">{fmtPeriod(month)}</div>
            <div className="text-xs text-muted-foreground">{display} · 1 USD = {rate} DOP</div>
          </div>
        </header>

        <h2 className="mb-2 mt-6 text-base font-semibold">Summary by unit</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Unit</th><th>Tenant</th><th className="text-right">Opening</th><th className="text-right">Billed</th><th className="text-right">Paid</th><th className="text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {st.rows.map((r) => (
              <tr key={r.leaseId} className="border-b">
                <td className="py-2 font-semibold">{r.unit}</td><td>{r.tenant}</td>
                <td className="text-right tabular-nums">{m(r.opening, display)}</td>
                <td className="text-right tabular-nums">{m(r.billed, display)}</td>
                <td className="text-right tabular-nums">{m(r.paid, display)}</td>
                <td className="text-right font-semibold tabular-nums">{m(r.closing, display)}</td>
              </tr>
            ))}
            <tr className="font-semibold">
              <td className="py-2" colSpan={2}>Total</td>
              <td className="text-right tabular-nums">{m(st.totals.opening, display)}</td>
              <td className="text-right tabular-nums">{m(st.totals.billed, display)}</td>
              <td className="text-right tabular-nums">{m(st.totals.paid, display)}</td>
              <td className="text-right tabular-nums">{m(st.totals.closing, display)}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="mb-2 mt-8 text-base font-semibold">Transactions</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="py-2">Date</th><th>Unit</th><th>Description</th><th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {st.lines.length === 0 && (
              <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No transactions this month.</td></tr>
            )}
            {st.lines.map((l, i) => (
              <tr key={i} className="border-b">
                <td className="py-1.5">{fmtDate(l.date)}</td>
                <td>{l.unit}</td>
                <td>
                  {l.kind === "PAYMENT" ? `Payment (${PAYMENT_METHOD_LABEL[l.type] ?? l.type})${l.reference ? ` · ${l.reference}` : ""}` : `${l.description} · ${CHARGE_TYPE_LABEL[l.type] ?? l.type}`}
                </td>
                <td className={`text-right tabular-nums ${l.kind === "PAYMENT" ? "text-success" : ""}`}>
                  {l.kind === "PAYMENT" ? `-${m(l.amount, display)}` : m(l.amount, display)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-6 text-xs text-muted-foreground">
          Billed = charges due in the month · Paid = payments received in the month · Closing = opening + billed − paid.
        </p>
      </article>
    </div>
  );
}
