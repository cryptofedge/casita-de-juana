"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { runBilling } from "@/lib/billing";
import { parseDateInput } from "@/lib/dates";
import { getFile, parseForm } from "@/lib/form-server";
import { toMinor } from "@/lib/money";
import { assertOwner } from "@/lib/session";
import { saveUpload, UploadError } from "@/lib/storage";
import { adjKeys, solveAdjustment } from "@/lib/adjust";
import { addDays, periodOf, todayLocal } from "@/lib/dates";
import { ADJ_PREFIX } from "@/lib/adjust";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import type { PaymentMethod } from "@prisma/client";
import { adjustBalanceSchema, chargeSchema, fail, paymentSchema, type ActionResult } from "@/lib/validators";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
}

export async function recordPaymentAction(fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const p = parseForm(paymentSchema, fd);
  if (!p.ok) return p.result;
  const d = p.data;

  const lease = await db.lease.findUnique({ where: { id: d.leaseId } });
  if (!lease) return fail("Lease not found.");

  let receiptId: string | null = null;
  try {
    receiptId = (await saveUpload(getFile(fd, "receipt"), owner.id))?.id ?? null;
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { receipt: [e.message] });
    throw e;
  }

  let chargeId: string | null = null;
  if (d.chargeId) {
    const target = await db.charge.findFirst({ where: { id: d.chargeId, leaseId: d.leaseId }, select: { id: true } });
    if (!target) return fail("Charge not found.");
    chargeId = target.id;
  }

  await db.payment.create({
    data: {
      leaseId: d.leaseId,
      chargeId,
      amount: toMinor(d.amount), // entered in the lease currency
      method: d.method,
      paidAt: parseDateInput(d.paidAt),
      reference: d.reference || null,
      note: d.note || null,
      receiptId,
      recordedBy: owner.id,
    },
  });
  refresh();
  return { ok: true };
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  await assertOwner();
  await db.payment.delete({ where: { id: paymentId } }).catch(() => null);
  refresh();
  return { ok: true };
}

/** Owner: correct the method of a recorded payment (the amount and what it pays are untouched). */
export async function updatePaymentMethodAction(paymentId: string, method: string): Promise<ActionResult> {
  await assertOwner();
  if (!Object.keys(PAYMENT_METHOD_LABEL).includes(method)) return fail("Choose a valid payment method.");
  await db.payment.update({ where: { id: paymentId }, data: { method: method as PaymentMethod } }).catch(() => null);
  refresh();
  return { ok: true };
}

export async function addChargeAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(chargeSchema, fd);
  if (!p.ok) return p.result;
  const d = p.data;
  const lease = await db.lease.findUnique({ where: { id: d.leaseId } });
  if (!lease) return fail("Lease not found.");
  const due = parseDateInput(d.dueDate);
  await db.charge.create({
    data: {
      leaseId: d.leaseId,
      type: "OTHER",
      period: due.toISOString().slice(0, 7),
      description: d.description,
      amount: toMinor(d.amount),
      dueDate: due,
    },
  });
  refresh();
  return { ok: true };
}

/** Owner can waive/remove a late fee or one-off charge. Rent and electricity are removed at their source. */
export async function deleteChargeAction(chargeId: string): Promise<ActionResult> {
  await assertOwner();
  const c = await db.charge.findUnique({ where: { id: chargeId } });
  if (!c) return fail("Charge not found.");
  if (c.type === "RENT" || c.type === "ELECTRICITY") {
    return fail("Rent is edited on the lease; electricity bills are removed from the Electricity page.");
  }
  if (c.type === "LATE_FEE") {
    // Keep the row (zeroed) so its idempotency key stops billing from re-applying the fee.
    await db.charge.update({ where: { id: chargeId }, data: { amount: 0, description: `${c.description} (waived)` } });
  } else {
    await db.charge.delete({ where: { id: chargeId } });
  }
  refresh();
  return { ok: true };
}

/**
 * Owner sets a tenant's total balance and overdue amount. The app adds up to two labelled
 * "Balance adjustment" charges (one already due, one not yet due) so the ledger shows exactly
 * those figures - and later payments keep applying to them oldest-first like any other charge.
 */
export async function adjustBalanceAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(adjustBalanceSchema, fd);
  if (!p.ok) return p.result;

  const lease = await db.lease.findUnique({ where: { id: p.data.leaseId }, include: { charges: true, payments: true } });
  if (!lease || !lease.active) return fail("Lease not found.");

  const targetBalance = toMinor(p.data.balance);
  const targetOverdue = toMinor(p.data.overdue);
  const today = todayLocal();
  const keys = adjKeys(lease.id);
  // "over" line sorts BEFORE every real charge (so a credit is applied to the oldest debt first and
  // an extra charge is overdue); "rest" line sorts AFTER every real charge (not yet due / total-only credit).
  const real = lease.charges.filter((c) => !c.key?.startsWith(ADJ_PREFIX));
  const times = real.map((c) => c.dueDate.getTime());
  const earliest = times.length ? new Date(Math.min(...times)) : today;
  const latest = times.length ? new Date(Math.max(...times)) : today;
  const overDue = addDays(earliest < today ? earliest : today, -1);
  const restDue = addDays(latest > addDays(today, 30) ? latest : addDays(today, 30), 1);
  const plan = solveAdjustment({ charges: lease.charges, payments: lease.payments, graceDays: lease.graceDays, today, overDue, restDue, targetBalance, targetOverdue });
  if ("error" in plan) {
    const msg = "Overdue cannot be more than the total balance.";
    return fail(msg, { overdue: [msg] });
  }
  await db.$transaction(async (tx) => {
    await tx.charge.deleteMany({ where: { leaseId: lease.id, key: { in: [keys.over, keys.rest] } } });
    if (plan.over !== 0) {
      await tx.charge.create({
        data: { leaseId: lease.id, type: "OTHER", period: periodOf(overDue), description: plan.over > 0 ? "Balance adjustment (overdue)" : "Balance adjustment (credit)", amount: plan.over, dueDate: overDue, key: keys.over },
      });
    }
    if (plan.rest !== 0) {
      await tx.charge.create({
        data: { leaseId: lease.id, type: "OTHER", period: periodOf(restDue), description: plan.rest > 0 ? "Balance adjustment (not yet due)" : "Balance adjustment (credit)", amount: plan.rest, dueDate: restDue, key: keys.rest },
      });
    }
  });
  refresh();
  return { ok: true };
}

export async function runBillingAction(): Promise<ActionResult<{ rent: number; fees: number }>> {
  await assertOwner();
  const r = await runBilling();
  refresh();
  return { ok: true, data: { rent: r.rentCreated, fees: r.lateFees } };
}
