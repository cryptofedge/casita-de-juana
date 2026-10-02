import { db } from "./db";
import {
  addMonths,
  currentPeriod,
  dueDateFor,
  fmtPeriod,
  periodOf,
  periodStart,
  todayLocal,
  addDays,
} from "./dates";
import { buildLedger, computeLateFee } from "./ledger";

/**
 * Generates any missing monthly RENT charges (from each lease's start month
 * through the current month) and applies late fees to overdue rent.
 * Both steps are idempotent (unique `key`), so this is safe to run as often
 * as you like - on page loads and from the cron endpoint.
 */
export async function runBilling() {
  const today = todayLocal();
  const nowPeriod = currentPeriod();

  const leases = await db.lease.findMany({ where: { active: true } });

  // 1. Rent charges
  const rentRows = [];
  for (const lease of leases) {
    let p = periodOf(lease.startDate);
    const earliest = addMonths(nowPeriod, -36);
    if (p < earliest) p = earliest;
    for (; p <= nowPeriod; p = addMonths(p, 1)) {
      if (lease.endDate && periodStart(p) > lease.endDate) break;
      rentRows.push({
        leaseId: lease.id,
        type: "RENT" as const,
        period: p,
        description: `Rent - ${fmtPeriod(p)}`,
        amount: lease.monthlyRent,
        dueDate: dueDateFor(p, lease.dueDay),
        key: `rent:${lease.id}:${p}`,
      });
    }
  }
  const rent = rentRows.length ? await db.charge.createMany({ data: rentRows, skipDuplicates: true }) : { count: 0 };

  // 2. Late fees
  const feeRows = [];
  for (const lease of leases) {
    if (lease.lateFeeFlat <= 0 && lease.lateFeePercent <= 0) continue;
    const [charges, payments] = await Promise.all([
      db.charge.findMany({ where: { leaseId: lease.id } }),
      db.payment.findMany({ where: { leaseId: lease.id } }),
    ]);
    const ledger = buildLedger(charges, payments, today, lease.graceDays);
    const createdAt = new Map(charges.map((c) => [c.id, c.createdAt]));
    for (const row of ledger.rows) {
      if (row.type !== "RENT" || row.status !== "OVERDUE") continue;
      // Charges that were back-filled after the fact are not penalised retroactively.
      const lateSince = addDays(row.dueDate, lease.graceDays + 1);
      if ((createdAt.get(row.id) ?? today) > addDays(lateSince, 1)) continue;
      const fee = computeLateFee(row.remaining, lease.lateFeeFlat, lease.lateFeePercent);
      if (fee <= 0) continue;
      feeRows.push({
        leaseId: lease.id,
        type: "LATE_FEE" as const,
        period: row.period,
        description: `Late fee - ${fmtPeriod(row.period)} rent`,
        amount: fee,
        dueDate: today,
        parentChargeId: row.id,
        key: `late:${row.id}`,
      });
    }
  }
  const fees = feeRows.length ? await db.charge.createMany({ data: feeRows, skipDuplicates: true }) : { count: 0 };

  return { rentCreated: rent.count, lateFees: fees.count };
}

let lastRun = 0;
/** Throttled variant for page loads. */
export async function runBillingThrottled(minutes = 10) {
  if (Date.now() - lastRun < minutes * 60_000) return;
  lastRun = Date.now();
  await runBilling();
}

export async function getLeaseLedger(leaseId: string) {
  const lease = await db.lease.findUniqueOrThrow({ where: { id: leaseId } });
  const [charges, payments] = await Promise.all([
    db.charge.findMany({ where: { leaseId }, orderBy: { dueDate: "asc" } }),
    db.payment.findMany({ where: { leaseId }, orderBy: { paidAt: "desc" }, include: { receipt: true } }),
  ]);
  const ledger = buildLedger(charges, payments, todayLocal(), lease.graceDays);
  return { lease, ledger, payments };
}
