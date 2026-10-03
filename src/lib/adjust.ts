import { buildLedger, type LedgerCharge, type LedgerPayment } from "./ledger";

/** Charges created by "Adjust balance" carry a key with this prefix so they can be replaced cleanly. */
export const ADJ_PREFIX = "adj:";
export const adjKeys = (leaseId: string) => ({ over: `${ADJ_PREFIX}over:${leaseId}`, rest: `${ADJ_PREFIX}rest:${leaseId}` });

/** The ledger as it would look with NO adjustment lines. */
export function adjustmentBase(
  charges: (LedgerCharge & { key?: string | null })[],
  payments: LedgerPayment[],
  graceDays: number,
  today: Date,
) {
  const real = charges.filter((c) => !c.key?.startsWith(ADJ_PREFIX));
  const l = buildLedger(real, payments, today, graceDays);
  return { balance: l.balance, overdue: l.overdue, notYetDue: l.balance - l.overdue };
}

/**
 * Turns the owner's target total balance and target overdue amount into two signed adjustment
 * lines (minor units). The owner is in full control: targets may be higher OR lower than what the
 * ledger shows.
 *
 *  - `over`  sits at the very START of the FIFO order. Positive = an extra overdue charge.
 *            Negative = a credit that is applied to the oldest unpaid charges first, so it
 *            reduces what is overdue (down to the target).
 *  - `rest`  sits at the very END (not yet due). Positive = an extra not-yet-due charge.
 *            Negative = a credit that only lowers the total (it never reaches earlier charges).
 *
 * Result: overdue = targetOverdue and balance = targetBalance.
 */
export function planAdjustment(base: { balance: number; overdue: number }, targetBalance: number, targetOverdue: number) {
  if (targetOverdue > targetBalance) return { error: "OVERDUE_GT_BALANCE" as const };
  const over = targetOverdue - base.overdue; // may be negative: credit applied oldest-first
  const rest = targetBalance - (base.balance + over); // may be negative: credit that only lowers the total
  return { over, rest };
}

/**
 * Like planAdjustment, but simulates the real ledger (FIFO payments included) and nudges the
 * "over" line until the overdue figure matches the target exactly. The total is exact by construction.
 */
export function solveAdjustment(opts: {
  charges: (LedgerCharge & { key?: string | null })[];
  payments: LedgerPayment[];
  graceDays: number;
  today: Date;
  overDue: Date; // due date of the "over" line (must sort before every real charge)
  restDue: Date; // due date of the "rest" line (must sort after every real charge)
  targetBalance: number;
  targetOverdue: number;
}) {
  const real = opts.charges.filter((c) => !c.key?.startsWith(ADJ_PREFIX));
  const base = buildLedger(real, opts.payments, opts.today, opts.graceDays);
  if (opts.targetOverdue > opts.targetBalance) return { error: "OVERDUE_GT_BALANCE" as const };

  let over = opts.targetOverdue - base.overdue;
  for (let i = 0; i < 8; i++) {
    const lines: LedgerCharge[] = over !== 0
      ? [{ id: "adj-over", type: "OTHER", period: "adj", description: "adj", amount: over, dueDate: opts.overDue }]
      : [];
    const overdueNow = buildLedger([...real, ...lines], opts.payments, opts.today, opts.graceDays).overdue;
    const diff = opts.targetOverdue - overdueNow;
    if (diff === 0) break;
    over += diff;
  }
  const rest = opts.targetBalance - (base.balance + over);
  return { over, rest };
}
