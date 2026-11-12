import { addMonths, periodOf, periodStart } from "./dates";
import type { LedgerCharge, LedgerPayment, LedgerRow } from "./ledger";

/**
 * Month-by-month view of a lease's rent, including months paid IN ADVANCE.
 *
 * Rent is only billed month by month, so money paid beyond everything billed shows up in the ledger as a
 * negative balance ("credit"). Here that credit is spread over the coming months' rent, in order, so the
 * tenant and owner can see e.g. "paid ahead through February 2027". It is an estimate: other charges billed
 * later (electricity, late fees) are also paid from the credit first, oldest first, like any payment.
 */

export type MonthStatus = "PAID" | "PARTIAL" | "OVERDUE" | "DUE" | "PREPAID" | "PART_PREPAID" | "UPCOMING";

export interface RentMonth {
  period: string; // YYYY-MM
  status: MonthStatus;
  /** Rent for the month (minor units). */
  amount: number;
  /** Paid, or covered in advance by the credit (minor units). */
  covered: number;
  current: boolean;
}

export interface RentCalendar {
  months: RentMonth[];
  /** Money paid beyond everything billed so far (minor units, never negative). */
  credit: number;
  /** Coming months whose rent the credit fully covers. */
  monthsAhead: number;
  /** Last month - counting from the current one, with no gaps - whose rent is fully paid. */
  paidThrough: string | null;
  /** First month from now whose rent is not fully covered. */
  nextUnpaid: string | null;
  /** Coming lease months that have not been billed yet, in order (what the credit is applied to). */
  future: string[];
}

const MAX_AHEAD = 36;

/** Lease months after the last billed rent month (rent is billed one month at a time). */
export function futureRentPeriods(opts: {
  lastBilled: string | null;
  nowPeriod: string;
  leaseStart: Date;
  leaseEnd?: Date | null;
  count?: number;
}): string[] {
  const startP = periodOf(opts.leaseStart);
  let p = opts.lastBilled && opts.lastBilled >= opts.nowPeriod ? addMonths(opts.lastBilled, 1) : addMonths(opts.nowPeriod, 1);
  if (p < startP) p = startP;
  const out: string[] = [];
  for (let i = 0; i < (opts.count ?? MAX_AHEAD); i++, p = addMonths(p, 1)) {
    if (opts.leaseEnd && periodStart(p) > opts.leaseEnd) break;
    out.push(p);
  }
  return out;
}

export function rentCalendar(opts: {
  rows: LedgerRow[];
  balance: number;
  monthlyRent: number;
  leaseStart: Date;
  leaseEnd?: Date | null;
  nowPeriod: string;
  /** Months shown before / after the current one (the view grows to include any unpaid or paid-ahead month). */
  before?: number;
  after?: number;
}): RentCalendar {
  const { rows, monthlyRent, nowPeriod } = opts;
  const credit = Math.max(0, -opts.balance);

  const billed = new Map<string, { amount: number; paid: number; overdue: boolean }>();
  for (const r of rows) {
    if (r.type !== "RENT" || r.amount <= 0) continue;
    const b = billed.get(r.period) ?? { amount: 0, paid: 0, overdue: false };
    b.amount += r.amount;
    b.paid += r.paid;
    b.overdue ||= r.status === "OVERDUE";
    billed.set(r.period, b);
  }
  const billedPeriods = [...billed.keys()].sort();
  const lastBilled = billedPeriods.at(-1) ?? null;
  const future = futureRentPeriods({ lastBilled, nowPeriod, leaseStart: opts.leaseStart, leaseEnd: opts.leaseEnd });

  // The credit pays the coming months' rent in order.
  const ahead = new Map<string, number>();
  let left = credit;
  for (const p of future) {
    if (left <= 0 || monthlyRent <= 0) break;
    const use = Math.min(left, monthlyRent);
    ahead.set(p, use);
    left -= use;
  }
  const monthsAhead = [...ahead.values()].filter((v) => v >= monthlyRent).length;

  const leaseStartP = periodOf(opts.leaseStart);
  const inLease = (p: string) => p >= leaseStartP && !(opts.leaseEnd && periodStart(p) > opts.leaseEnd);
  const futureSet = new Set(future);

  const monthOf = (p: string): RentMonth | null => {
    const current = p === nowPeriod;
    const b = billed.get(p);
    if (b) {
      const status: MonthStatus = b.paid >= b.amount ? "PAID" : b.overdue ? "OVERDUE" : b.paid > 0 ? "PARTIAL" : "DUE";
      return { period: p, status, amount: b.amount, covered: Math.min(b.paid, b.amount), current };
    }
    if (!inLease(p)) return null;
    if (futureSet.has(p)) {
      const covered = ahead.get(p) ?? 0;
      const status: MonthStatus = covered >= monthlyRent && monthlyRent > 0 ? "PREPAID" : covered > 0 ? "PART_PREPAID" : "UPCOMING";
      return { period: p, status, amount: monthlyRent, covered, current };
    }
    // A lease month that should have been billed but was not (billing has not run yet).
    return { period: p, status: "DUE", amount: monthlyRent, covered: 0, current };
  };

  // Walk forward from the current month (or the lease start, if later) while rent is fully covered.
  let paidThrough: string | null = null;
  let nextUnpaid: string | null = null;
  const walkStart = nowPeriod > leaseStartP ? nowPeriod : leaseStartP;
  for (let p = walkStart, i = 0; i <= MAX_AHEAD + 1; p = addMonths(p, 1), i++) {
    const m = monthOf(p);
    if (!m) break;
    if (m.status === "PAID" || m.status === "PREPAID") paidThrough = p;
    else {
      nextUnpaid = p;
      break;
    }
  }

  // Visible window: a few months back (earlier if something is still unpaid) through a few months ahead
  // (later if the credit reaches further).
  let from = addMonths(nowPeriod, -(opts.before ?? 2));
  const oldestOpen = billedPeriods.find((p) => {
    const b = billed.get(p)!;
    return b.paid < b.amount;
  });
  if (oldestOpen && oldestOpen < from) from = oldestOpen;
  if (from < leaseStartP) from = leaseStartP;
  let to = addMonths(nowPeriod, opts.after ?? 9);
  const lastAhead = [...ahead.keys()].at(-1);
  if (lastAhead && lastAhead >= to) to = addMonths(lastAhead, 1);
  const cap = addMonths(nowPeriod, 24);
  if (to > cap) to = cap;

  const months: RentMonth[] = [];
  for (let p = from; p <= to; p = addMonths(p, 1)) {
    const m = monthOf(p);
    if (m) months.push(m);
  }
  return { months, credit, monthsAhead, paidThrough, nextUnpaid, future };
}

/** One piece of a payment: what it paid for, and how much went there. */
export interface PaymentUse {
  amount: number;
  period: string;
  /** Set when it paid a billed charge. */
  chargeId?: string;
  type?: LedgerCharge["type"];
  description?: string;
  /** Paid in advance: covers a month whose rent has not been billed yet (period "" = beyond the shown months). */
  ahead?: boolean;
}

/**
 * Explains each payment: which charges it paid and which coming months it covers in advance.
 * Follows the same rules as buildLedger (payments aimed at a charge go there first, the owner's "overdue"
 * credit adjustment pays the oldest rent, everything else pays the oldest open charge first), taking the
 * earliest payment first. Display only - the ledger stays the source of truth for balances and statuses.
 */
export function allocatePayments(opts: {
  charges: LedgerCharge[];
  payments: (LedgerPayment & { createdAt?: Date })[];
  future: string[];
  monthlyRent: number;
}): Map<string, PaymentUse[]> {
  const sorted = [...opts.charges].sort(
    (a, b) => a.dueDate.getTime() - b.dueDate.getTime() || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );
  const need = new Map(sorted.filter((c) => c.amount > 0).map((c) => [c.id, c.amount]));
  const order = [...opts.payments].sort(
    (a, b) => a.paidAt.getTime() - b.paidAt.getTime() || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );
  const uses = new Map<string, PaymentUse[]>(opts.payments.map((p) => [p.id, []]));
  const push = (paymentId: string, use: PaymentUse) => {
    const list = uses.get(paymentId)!;
    const same = list.find((u) => (use.chargeId ? u.chargeId === use.chargeId : !u.chargeId && u.ahead === use.ahead && u.period === use.period));
    if (same) same.amount += use.amount;
    else list.push(use);
  };
  const payCharge = (paymentId: string, c: LedgerCharge, amount: number) =>
    push(paymentId, { amount, period: c.period, chargeId: c.id, type: c.type, description: c.description });

  // 1. Payments aimed at a specific charge.
  const rest = new Map<string, number>();
  for (const p of order) {
    let left = p.amount;
    const target = p.chargeId ? sorted.find((c) => c.id === p.chargeId) : undefined;
    const n = target ? (need.get(target.id) ?? 0) : 0;
    if (target && n > 0) {
      const use = Math.min(left, n);
      need.set(target.id, n - use);
      left -= use;
      if (use > 0) payCharge(p.id, target, use);
    }
    rest.set(p.id, left);
  }

  // 2. The owner's balance adjustments: an "overdue" credit pays the oldest rent; other negative lines act as money too.
  const isCredit = (c: LedgerCharge) => c.amount < 0 && !!c.key?.startsWith("adj:over:");
  let credit = sorted.filter(isCredit).reduce((s, c) => s - c.amount, 0);
  for (const c of sorted) {
    if (credit <= 0) break;
    if (c.type !== "RENT" || c.amount <= 0) continue;
    const n = need.get(c.id) ?? 0;
    const use = Math.min(credit, n);
    need.set(c.id, n - use);
    credit -= use;
  }
  let adjustmentMoney = credit + sorted.filter((c) => c.amount < 0 && !isCredit(c)).reduce((s, c) => s - c.amount, 0);
  for (const c of sorted) {
    if (adjustmentMoney <= 0) break;
    const n = need.get(c.id) ?? 0;
    const use = Math.min(adjustmentMoney, n);
    need.set(c.id, n - use);
    adjustmentMoney -= use;
  }

  // 3. Everything else pays the oldest open charge first, earliest payment first.
  for (const p of order) {
    let left = rest.get(p.id) ?? 0;
    for (const c of sorted) {
      if (left <= 0) break;
      const n = need.get(c.id) ?? 0;
      if (n <= 0) continue;
      const use = Math.min(left, n);
      need.set(c.id, n - use);
      left -= use;
      payCharge(p.id, c, use);
    }
    rest.set(p.id, left);
  }

  // 4. What is left was paid in advance: it covers the coming months' rent, in order.
  let fi = 0;
  let monthLeft = opts.monthlyRent;
  for (const p of order) {
    let left = rest.get(p.id) ?? 0;
    while (left > 0 && fi < opts.future.length && opts.monthlyRent > 0) {
      const use = Math.min(left, monthLeft);
      push(p.id, { amount: use, period: opts.future[fi], ahead: true });
      left -= use;
      monthLeft -= use;
      if (monthLeft <= 0) {
        fi++;
        monthLeft = opts.monthlyRent;
      }
    }
    if (left > 0) push(p.id, { amount: left, period: "", ahead: true });
  }
  return uses;
}
