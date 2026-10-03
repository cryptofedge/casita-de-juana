"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getFiles, parseForm } from "@/lib/form-server";
import { getSessionUser } from "@/lib/session";
import { saveUpload, UploadError } from "@/lib/storage";
import { fail, messageSchema, ticketSchema, ticketStatusSchema, type ActionResult } from "@/lib/validators";

const MAX_PHOTOS = 5;

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
}

async function saveMany(files: File[], userId: string) {
  if (files.length > MAX_PHOTOS) throw new UploadError(`Attach at most ${MAX_PHOTOS} files.`);
  const out = [];
  for (const f of files) {
    const a = await saveUpload(f, userId);
    if (a) out.push(a);
  }
  return out;
}

/** Tenant submits a request. Scope (unit) always comes from the tenant's own lease, never from the form. */
export async function createTicketAction(fd: FormData): Promise<ActionResult<{ id: string }>> {
  const user = await getSessionUser();
  if (!user || user.role !== "TENANT") return fail("Not authorized.");
  const lease = await db.lease.findFirst({ where: { tenantId: user.id, active: true }, include: { unit: true } });
  if (!lease) return fail("You do not have an active lease.");

  const p = parseForm(ticketSchema, fd);
  if (!p.ok) return p.result;

  let files;
  try {
    files = await saveMany(getFiles(fd, "photos"), user.id);
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { photos: [e.message] });
    throw e;
  }

  const ticket = await db.ticket.create({
    data: {
      unitId: lease.unitId,
      createdById: user.id,
      ...p.data,
      attachments: { create: files.map((f) => ({ fileId: f.id })) },
    },
  });
  refresh();
  return { ok: true, data: { id: ticket.id } };
}

/** Owner or the ticket's own tenant can post to the thread. */
export async function addMessageAction(fd: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Not authorized.");
  const p = parseForm(messageSchema, fd);
  if (!p.ok) return p.result;

  const ticket = await db.ticket.findUnique({ where: { id: p.data.ticketId } });
  if (!ticket) return fail("Request not found.");
  if (user.role === "TENANT" && ticket.createdById !== user.id) return fail("Not authorized.");

  let files;
  try {
    files = await saveMany(getFiles(fd, "photos"), user.id);
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { photos: [e.message] });
    throw e;
  }

  await db.$transaction(async (tx) => {
    const msg = await tx.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, body: p.data.body },
    });
    if (files.length) {
      await tx.ticketAttachment.createMany({
        data: files.map((f) => ({ ticketId: ticket.id, messageId: msg.id, fileId: f.id })),
      });
    }
    // A tenant replying on a resolved ticket reopens it.
    if (user.role === "TENANT" && (ticket.status === "RESOLVED" || ticket.status === "CLOSED")) {
      await tx.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN" } });
    } else {
      await tx.ticket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    }
  });
  refresh();
  return { ok: true };
}

export async function setTicketStatusAction(fd: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return fail("Not authorized.");
  const p = parseForm(ticketStatusSchema, fd);
  if (!p.ok) return p.result;
  await db.ticket.update({ where: { id: p.data.ticketId }, data: { status: p.data.status } });
  refresh();
  return { ok: true };
}
