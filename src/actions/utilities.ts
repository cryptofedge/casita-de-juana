"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fmtPeriod, parseDateInput } from "@/lib/dates";
import { getFile, parseForm } from "@/lib/form-server";
import { assertOwner } from "@/lib/session";
import { saveUpload, UploadError } from "@/lib/storage";
import { fail, meterReadingSchema, type ActionResult } from "@/lib/validators";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
}

/**
 * Saves a monthly sub-meter reading and automatically adds the electricity bill
 * to the unit's tenant balance (a Charge of type ELECTRICITY).
 */
export async function createReadingAction(fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const p = parseForm(meterReadingSchema, fd);
  if (!p.ok) return p.result;
  const d = p.data;

  const lease = await db.lease.findFirst({ where: { unitId: d.unitId, active: true } });
  if (!lease) return fail("That unit has no active tenant to bill.", { unitId: ["No active tenant"] });
  if (await db.meterReading.findUnique({ where: { unitId_period: { unitId: d.unitId, period: d.period } } })) {
    return fail("A reading for that unit and month already exists.", { period: ["Already recorded"] });
  }

  let photoId: string | null = null;
  try {
    photoId = (await saveUpload(getFile(fd, "photo"), owner.id))?.id ?? null;
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { photo: [e.message] });
    throw e;
  }

  const prev = parseFloat(d.previousKwh);
  const curr = parseFloat(d.currentKwh);
  const rate = parseFloat(d.ratePerKwh);
  const kwh = Math.round((curr - prev) * 100) / 100;
  const subtotal = Math.round(kwh * rate * 100); // minor units of the lease currency
  const due = parseDateInput(d.dueDate);

  await db.$transaction(async (tx) => {
    const charge = await tx.charge.create({
      data: {
        leaseId: lease.id,
        type: "ELECTRICITY",
        period: d.period,
        description: `Electricity - ${fmtPeriod(d.period)} (${kwh} kWh)`,
        amount: subtotal,
        dueDate: due,
        key: `elec:${d.unitId}:${d.period}`,
      },
    });
    await tx.meterReading.create({
      data: {
        unitId: d.unitId,
        period: d.period,
        previousKwh: prev,
        currentKwh: curr,
        ratePerKwh: rate,
        currency: lease.currency,
        subtotal,
        dueDate: due,
        photoId,
        chargeId: charge.id,
      },
    });
  });
  refresh();
  return { ok: true };
}

export async function deleteReadingAction(readingId: string): Promise<ActionResult> {
  await assertOwner();
  const r = await db.meterReading.findUnique({ where: { id: readingId } });
  if (!r) return fail("Reading not found.");
  await db.$transaction(async (tx) => {
    await tx.meterReading.delete({ where: { id: readingId } });
    if (r.chargeId) await tx.charge.delete({ where: { id: r.chargeId } });
  });
  refresh();
  return { ok: true };
}
