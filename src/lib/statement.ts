import { db } from "./db";
import { periodEnd, periodStart, todayLocal } from "./dates";
import { buildLedger } from "./ledger";
import { convert, type CurrencyCode } from "./money";

export interface StatementLine {
  date: Date;
  unit: string;
  tenant: string;
  kind: "CHARGE" | "PAYMENT";
  type: string; // RENT / ELECTRICITY / ... or payment method
  description: string;
  amount: number; // display currency, minor units
  reference?: string | null;
}

export interface StatementRow {
  leaseId: string;
  unit: string;
  tenant: string;
  leaseCurrency: CurrencyCode;
  opening: number;
  billed: number;
  paid: number;
  closing: number;
  rentStatus: string | null;
}

export interface Statement {
  month: string;
  currency: CurrencyCode;
  rate: number;
  rows: StatementRow[];
  lines: StatementLine[];
  totals: { opening: number; billed: number; paid: number; closing: number };
}

/**
 * Month statement per unit. Billed = charges due in the month, Paid = payments
 * received in the month, Opening/Closing = running balance (charges due minus payments).
 * Everything is converted to the display currency with the owner-set rate.
 */
export async function buildStatement(month: string, currency: CurrencyCode, rate: number): Promise<Statement> {
  const start = periodStart(month);
  const end = periodEnd(month);
  const today = todayLocal();

  const leases = await db.lease.findMany({
    where: {
      startDate: { lt: end },
      OR: [{ active: true }, { payments: { some: { paidAt: { gte: start, lt: end } } } }, { charges: { some: { dueDate: { gte: start, lt: end } } } }],
    },
    include: { unit: true, tenant: true, charges: true, payments: true },
    orderBy: { unit: { label: "asc" } },
  });

  const rows: StatementRow[] = [];
  const lines: StatementLine[] = [];

  for (const l of leases) {
    const cv = (n: number) => convert(n, l.currency, currency, rate);
    const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + x.amount, 0);
    const opening = sum(l.charges.filter((c) => c.dueDate < start)) - sum(l.payments.filter((p) => p.paidAt < start));
    const inMonthCharges = l.charges.filter((c) => c.dueDate >= start && c.dueDate < end);
    const inMonthPayments = l.payments.filter((p) => p.paidAt >= start && p.paidAt < end);
    const billed = sum(inMonthCharges);
    const paid = sum(inMonthPayments);

    const ledger = buildLedger(l.charges, l.payments, today, l.graceDays);
    const rent = ledger.rows.find((r) => r.type === "RENT" && r.period === month);

    rows.push({
      leaseId: l.id,
      unit: l.unit.label,
      tenant: l.tenant.name,
      leaseCurrency: l.currency,
      opening: cv(opening),
      billed: cv(billed),
      paid: cv(paid),
      closing: cv(opening + billed - paid),
      rentStatus: rent?.status ?? null,
    });

    for (const c of inMonthCharges)
      lines.push({ date: c.dueDate, unit: l.unit.label, tenant: l.tenant.name, kind: "CHARGE", type: c.type, description: c.description, amount: cv(c.amount) });
    for (const p of inMonthPayments)
      lines.push({ date: p.paidAt, unit: l.unit.label, tenant: l.tenant.name, kind: "PAYMENT", type: p.method, description: p.note ?? "Payment received", amount: cv(p.amount), reference: p.reference });
  }

  lines.sort((a, b) => a.date.getTime() - b.date.getTime() || a.unit.localeCompare(b.unit));
  const totals = rows.reduce(
    (t, r) => ({ opening: t.opening + r.opening, billed: t.billed + r.billed, paid: t.paid + r.paid, closing: t.closing + r.closing }),
    { opening: 0, billed: 0, paid: 0, closing: 0 },
  );
  return { month, currency, rate, rows, lines, totals };
}
