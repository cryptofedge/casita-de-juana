"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/dates";
import { getFile, parseForm } from "@/lib/form-server";
import { toMinor } from "@/lib/money";
import { assertOwner, assertTenant } from "@/lib/session";
import { saveUpload, UploadError } from "@/lib/storage";
import {
  approveSubmissionSchema,
  fail,
  rejectSubmissionSchema,
  submissionSchema,
  type ActionResult,
} from "@/lib/validators";

const MAX_PENDING = 3;

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
}

/** Tenant: send proof of a payment. Nothing is posted to the balance until the owner approves. */
export async function submitPaymentProofAction(fd: FormData): Promise<ActionResult> {
  const ctx = await assertTenant();
  if (!ctx.lease) return fail("You do not have an active lease.");
  const p = parseForm(submissionSchema, fd);
  if (!p.ok) return p.result;

  const file = getFile(fd, "receipt");
  if (!file) return fail("Attach a screenshot or receipt of the payment.", { receipt: ["Attach a screenshot or receipt of the payment."] });

  const waiting = await db.paymentSubmission.count({ where: { leaseId: ctx.lease.id, status: "PENDING" } });
  if (waiting >= MAX_PENDING) return fail("You already have 3 payments waiting for review.");

  let receiptId: string;
  try {
    receiptId = (await saveUpload(file, ctx.user.id))!.id;
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { receipt: [e.message] });
    throw e;
  }

  await db.paymentSubmission.create({
    data: {
      leaseId: ctx.lease.id, // always the signed-in tenant's own lease, never from the form
      amount: toMinor(p.data.amount),
      method: p.data.method,
      applyTo: p.data.applyTo,
      paidAt: parseDateInput(p.data.paidAt),
      reference: p.data.reference || null,
      note: p.data.note || null,
      receiptId,
    },
  });
  refresh();
  return { ok: true };
}

/** Owner: approve (optionally correcting amount/method/date and choosing the charge) -> posts a real Payment. */
export async function approveSubmissionAction(fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const p = parseForm(approveSubmissionSchema, fd);
  if (!p.ok) return p.result;

  const sub = await db.paymentSubmission.findUnique({ where: { id: p.data.submissionId } });
  if (!sub) return fail("Submission not found.");
  if (sub.status !== "PENDING") return fail("This submission was already reviewed.");

  let chargeId: string | null = null;
  if (p.data.chargeId) {
    const c = await db.charge.findFirst({ where: { id: p.data.chargeId, leaseId: sub.leaseId }, select: { id: true } });
    if (!c) return fail("Charge not found.");
    chargeId = c.id;
  }

  await db.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        leaseId: sub.leaseId,
        amount: toMinor(p.data.amount),
        method: p.data.method,
        paidAt: parseDateInput(p.data.paidAt),
        reference: sub.reference,
        note: sub.note ? `${sub.note} (sent by tenant)` : "Sent by tenant",
        receiptId: sub.receiptId,
        chargeId,
        recordedBy: owner.id,
      },
    });
    await tx.paymentSubmission.update({
      where: { id: sub.id },
      data: { status: "APPROVED", reviewedAt: new Date(), paymentId: payment.id },
    });
  });
  refresh();
  return { ok: true };
}

/** Owner: reject with an optional reason the tenant will see. */
export async function rejectSubmissionAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(rejectSubmissionSchema, fd);
  if (!p.ok) return p.result;
  const sub = await db.paymentSubmission.findUnique({ where: { id: p.data.submissionId } });
  if (!sub) return fail("Submission not found.");
  if (sub.status !== "PENDING") return fail("This submission was already reviewed.");
  await db.paymentSubmission.update({
    where: { id: sub.id },
    data: { status: "REJECTED", reviewedAt: new Date(), rejectReason: p.data.reason || null },
  });
  refresh();
  return { ok: true };
}
