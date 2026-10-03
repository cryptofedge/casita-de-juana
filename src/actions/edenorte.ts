"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/dates";
import { getFile, parseForm } from "@/lib/form-server";
import { notifyOwner } from "@/lib/mail";
import { toMinor } from "@/lib/money";
import { assertOwner, assertTenant, getSessionUser } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { saveUpload, UploadError } from "@/lib/storage";
import { edenorteBillSchema, fail, nicSchema, type ActionResult } from "@/lib/validators";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
}

async function saveBill(fd: FormData, unitId: string | null, userId: string): Promise<ActionResult> {
  const p = parseForm(edenorteBillSchema, fd);
  if (!p.ok) return p.result;
  const dup = await db.utilityBill.findFirst({ where: { unitId, period: p.data.period, createdBy: userId } });
  if (dup) return fail("You already logged a bill for that month. Delete it first to replace it.", { period: ["Already logged"] });

  let fileId: string | null = null;
  try {
    fileId = (await saveUpload(getFile(fd, "bill"), userId))?.id ?? null;
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { bill: [e.message] });
    throw e;
  }
  await db.utilityBill.create({
    data: {
      unitId,
      period: p.data.period,
      kwh: parseFloat(p.data.kwh),
      amount: toMinor(p.data.amount),
      currency: "DOP",
      dueDate: p.data.dueDate ? parseDateInput(p.data.dueDate) : null,
      fileId,
      createdBy: userId,
    },
  });
  refresh();
  return { ok: true };
}

/** Owner: save her main Edenorte contract number (NIC). */
export async function saveOwnerNicAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(nicSchema, fd);
  if (!p.ok) return p.result;
  await setSetting("edenorteNic", p.data.nic);
  refresh();
  return { ok: true };
}

/** Owner: log a bill from her main (building) Edenorte account. */
export async function addBuildingBillAction(fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  return saveBill(fd, null, owner.id);
}

/** Owner: allow (or stop allowing) a tenant to add their own Edenorte account. Off by default. */
export async function setEdenorteAccessAction(leaseId: string, enabled: boolean): Promise<ActionResult> {
  await assertOwner();
  const lease = await db.lease.findUnique({ where: { id: leaseId } });
  if (!lease) return fail("Lease not found.");
  await db.lease.update({ where: { id: leaseId }, data: { edenorteAccess: enabled } });
  refresh();
  return { ok: true };
}

/** Tenant with their own Edenorte contract: save the NIC on their own lease. */
export async function saveTenantNicAction(fd: FormData): Promise<ActionResult> {
  const ctx = await assertTenant();
  if (!ctx.lease) return fail("You do not have an active lease.");
  if (!ctx.lease.edenorteAccess) return fail("The owner has not turned this on for your account.");
  const p = parseForm(nicSchema, fd);
  if (!p.ok) return p.result;
  await db.lease.update({ where: { id: ctx.lease.id }, data: { ownEdenorteNic: p.data.nic || null } });
  refresh();
  return { ok: true };
}

/** Tenant with their own Edenorte contract: log one of their own bills (for tracking only; no charge is created). */
export async function addTenantBillAction(fd: FormData): Promise<ActionResult> {
  const ctx = await assertTenant();
  if (!ctx.lease) return fail("You do not have an active lease.");
  if (!ctx.lease.edenorteAccess) return fail("The owner has not turned this on for your account.");
  const res = await saveBill(fd, ctx.lease.unitId, ctx.user.id);
  if (res.ok) {
    after(() =>
      notifyOwner({
        subject: `${ctx.user.name} (Apt ${ctx.lease!.unit.label}) logged an Edenorte bill`,
        lines: ["They have their own Edenorte account and added a monthly bill for tracking."],
        path: "/admin/edenorte",
      }),
    );
  }
  return res;
}

/** Owner can delete any logged bill; a tenant only their own. */
export async function deleteBillAction(id: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Not authorized.");
  const bill = await db.utilityBill.findUnique({ where: { id } });
  if (!bill) return fail("Not found.");
  if (user.role !== "OWNER" && bill.createdBy !== user.id) return fail("Not authorized.");
  await db.utilityBill.delete({ where: { id } });
  refresh();
  return { ok: true };
}
