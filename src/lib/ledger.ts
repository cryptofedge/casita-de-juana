import { addDays } from "./dates";

export type ChargeStatus = "PAID" | "PENDING" | "PARTIAL" | "OVERDUE";

export interface LedgerCharge {
  id: string;
  type: "RENT" | "ELECTRICITY" | "LATE_FEE" | "OTHER";
  period: string;
  description: string;
  amount: number;
  dueDate: Date;
  createdAt?: Date;
}

export interface LedgerPayment {
  id: string;
  amount: number;
  paidAt: Date;
}

export interface LedgerRow extends LedgerCharge {
  paid: number;
  remaining: number;
  status: ChargeStatus;
}

export interface Ledger {
  rows: LedgerRow[];
  totalCharged: number;
  totalPaid: number;
  /** charged - paid. Negative means the tenant is in credit. */
  balance: number;
  /** unpaid amount on charges that are past due (incl. grace) */
  overdue: number;
  /** unpaid amount on charges whose due date has been reached */
  dueNow: number;
}

/**
 * Applies a lease's payments to its charges oldest-due-first (FIFO) and
 * derives each charge's status.
 *
 *  - PAID     nothing left to pay
 *  - OVERDUE  unpaid and past due date + grace (only rent gets grace days)
 *  - PARTIAL  something paid, not yet overdue
 *  - PENDING  nothing paid, not yet overdue
 */
export function buildLedger(
  charges: LedgerCharge[],
  payments: LedgerPayment[],
  today: Date,
  graceDays = 0,
): Ledger {
  const sorted = [...charges].sort(
    (a, b) =>
      a.dueDate.getTime() - b.dueDate.getTime() ||
      (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  let pool = totalPaid;
  let overdue = 0;
  let dueNow = 0;

  const rows: LedgerRow[] = sorted.map((c) => {
    const paid = Math.min(pool, c.amount);
    pool -= paid;
    const remaining = c.amount - paid;
    const grace = c.type === "RENT" ? graceDays : 0;
    const pastDue = today.getTime() > addDays(c.dueDate, grace).getTime();
    let status: ChargeStatus;
    if (remaining <= 0) status = "PAID";
    else if (pastDue && c.type !== "LATE_FEE") status = "OVERDUE";
    else if (paid > 0) status = "PARTIAL";
    else status = "PENDING";
    if (status === "OVERDUE") overdue += remaining;
    if (remaining > 0 && c.dueDate.getTime() <= today.getTime()) dueNow += remaining;
    return { ...c, paid, remaining, status };
  });

  const totalCharged = sorted.reduce((s, c) => s + c.amount, 0);
  return {
    rows,
    totalCharged,
    totalPaid,
    balance: totalCharged - totalPaid,
    overdue,
    dueNow,
  };
}

export function computeLateFee(
  remaining: number,
  flat: number,
  percent: number,
): number {
  return Math.max(0, flat) + Math.round((remaining * Math.max(0, percent)) / 100);
}
