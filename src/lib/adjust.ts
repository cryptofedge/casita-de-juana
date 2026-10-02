import { buildLedger, type LedgerCharge, type LedgerPayment } from "./ledger";

/** Charges created by "Adjust balance" carry a key with this prefix so they can be replaced cleanly. */
export const ADJ_PREFIX = "adj:";
export const adjKeys = (leaseId: string) => ({ over: `${ADJ_PREFIX}over:${leaseId}`, rest: `${ADJ_PREFIX}rest:${leaseId}` });

/** The ledger as it would look with NO adjustment lines: the floor the owner can adjust upward from. */
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
 * Given the owner's target total balance and target overdue amount, returns the two adjustment
 * amounts to add (minor units), or an error code when a target is below what the ledger already shows.
 */
export function planAdjustment(base: { balance: number; overdue: number }, targetBalance: number, targetOverdue: number) {
  if (targetOverdue > targetBalance) return { error: "OVERDUE_GT_BALANCE" as const };
  if (base.balance < 0) return { error: "CREDIT" as const };
  const over = targetOverdue - base.overdue;
  const rest = targetBalance - targetOverdue - (base.balance - base.overdue);
  if (over < 0) return { error: "OVERDUE_TOO_LOW" as const };
  if (rest < 0) return { error: "BALANCE_TOO_LOW" as const };
  return { over, rest };
}
