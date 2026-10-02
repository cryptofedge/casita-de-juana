"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/app-url";
import { runBilling } from "@/lib/billing";
import { parseDateInput, periodOf, todayLocal } from "@/lib/dates";
import { parseForm } from "@/lib/form-server";
import { toMinor } from "@/lib/money";
import { assertOwner } from "@/lib/session";
import {
  fail,
  inviteTenantSchema,
  leaseUpdateSchema,
  unitSchema,
  type ActionResult,
} from "@/lib/validators";

const INVITE_DAYS = 7;

function inviteLink(token: string) {
  return `${appUrl()}/invite/${token}`;
}

function newInvite() {
  return {
    inviteToken: randomBytes(24).toString("hex"),
    inviteExpires: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  };
}

export async function createUnitAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(unitSchema, fd);
  if (!p.ok) return p.result;
  const label = p.data.label.toUpperCase();
  if (await db.unit.findUnique({ where: { label } })) return fail(`Unit ${label} already exists.`, { label: ["Already exists"] });
  await db.unit.create({
    data: { label, floor: +p.data.floor, bedrooms: +p.data.bedrooms, notes: p.data.notes || null },
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

export async function toggleUnitAction(unitId: string): Promise<ActionResult> {
  await assertOwner();
  const unit = await db.unit.findUnique({ where: { id: unitId }, include: { leases: { where: { active: true } } } });
  if (!unit) return fail("Unit not found.");
  if (unit.active && unit.leases.length) return fail("End the active lease before deactivating this unit.");
  await db.unit.update({ where: { id: unitId }, data: { active: !unit.active } });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Creates the tenant login + lease and returns a one-time invite link. */
export async function inviteTenantAction(fd: FormData): Promise<ActionResult<{ link: string; name: string }>> {
  await assertOwner();
  const p = parseForm(inviteTenantSchema, fd);
  if (!p.ok) return p.result;
  const d = p.data;

  const unit = await db.unit.findUnique({
    where: { id: d.unitId },
    include: { leases: { where: { active: true } } },
  });
  if (!unit || !unit.active) return fail("That unit is not available.", { unitId: ["Unit not available"] });
  if (unit.leases.length) return fail(`Unit ${unit.label} already has an active tenant.`, { unitId: ["Already occupied"] });
  if (await db.user.findUnique({ where: { email: d.email } })) {
    return fail("A user with that email already exists.", { email: ["Email already in use"] });
  }

  const invite = newInvite();
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: d.name, email: d.email, phone: d.phone || null, role: "TENANT", ...invite },
    });
    await tx.lease.create({
      data: {
        unitId: d.unitId,
        tenantId: user.id,
        startDate: parseDateInput(d.startDate),
        monthlyRent: toMinor(d.monthlyRent),
        currency: d.currency,
        dueDay: +d.dueDay,
        graceDays: +d.graceDays,
        lateFeeFlat: toMinor(d.lateFeeFlat),
        lateFeePercent: parseFloat(d.lateFeePercent),
        deposit: toMinor(d.deposit),
      },
    });
  });
  await runBilling();
  // No revalidatePath here on purpose: re-rendering the page would unmount the dialog that is
  // about to show the invite link. The dialog refreshes the page when it is closed instead.
  return { ok: true, data: { link: inviteLink(invite.inviteToken), name: d.name } };
}

/** New invite / password-reset link for an existing tenant. */
export async function regenerateInviteAction(userId: string): Promise<ActionResult<{ link: string }>> {
  await assertOwner();
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "TENANT") return fail("Tenant not found.");
  const invite = newInvite();
  await db.user.update({ where: { id: userId }, data: invite });
  return { ok: true, data: { link: inviteLink(invite.inviteToken) } };
}

export async function updateLeaseAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(leaseUpdateSchema, fd);
  if (!p.ok) return p.result;
  const d = p.data;
  const lease = await db.lease.findUnique({ where: { id: d.leaseId } });
  if (!lease) return fail("Lease not found.");
  // Moving the start date later is a correction: drop the rent months (and their late fees) before it,
  // otherwise billing would keep the wrongly back-filled months on the ledger.
  const newStart = parseDateInput(d.startDate);
  if (periodOf(newStart) > periodOf(lease.startDate)) {
    await db.charge.deleteMany({
      where: { leaseId: d.leaseId, type: { in: ["RENT", "LATE_FEE"] }, period: { lt: periodOf(newStart) } },
    });
  }
  await db.lease.update({
    where: { id: d.leaseId },
    data: {
      startDate: parseDateInput(d.startDate),
      endDate: d.endDate ? parseDateInput(d.endDate) : null,
      monthlyRent: toMinor(d.monthlyRent),
      currency: d.currency,
      dueDay: +d.dueDay,
      graceDays: +d.graceDays,
      lateFeeFlat: toMinor(d.lateFeeFlat),
      lateFeePercent: parseFloat(d.lateFeePercent),
      deposit: toMinor(d.deposit),
    },
  });
  revalidatePath("/admin", "layout");
  return { ok: true };
}

/** Ends the lease; the tenant can no longer sign in to see data for the unit. */
export async function endLeaseAction(leaseId: string): Promise<ActionResult> {
  await assertOwner();
  const lease = await db.lease.findUnique({ where: { id: leaseId } });
  if (!lease) return fail("Lease not found.");
  await db.$transaction([
    db.lease.update({ where: { id: leaseId }, data: { active: false, endDate: lease.endDate ?? todayLocal() } }),
    db.user.update({ where: { id: lease.tenantId }, data: { active: false } }),
  ]);
  revalidatePath("/admin", "layout");
  return { ok: true };
}
