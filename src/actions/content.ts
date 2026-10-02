"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseDateInput } from "@/lib/dates";
import { getFile, parseForm } from "@/lib/form-server";
import { assertOwner } from "@/lib/session";
import { setSetting } from "@/lib/settings";
import { saveUpload, UploadError } from "@/lib/storage";
import {
  announcementSchema,
  contactSchema,
  documentSchema,
  fail,
  settingsSchema,
  type ActionResult,
} from "@/lib/validators";

function refresh() {
  revalidatePath("/admin", "layout");
  revalidatePath("/portal", "layout");
}

// ---- Announcements ---------------------------------------------------------
export async function createAnnouncementAction(fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const p = parseForm(announcementSchema, fd, { booleans: ["pinned"] });
  if (!p.ok) return p.result;
  await db.announcement.create({
    data: {
      title: p.data.title,
      body: p.data.body,
      pinned: p.data.pinned,
      expiresAt: p.data.expiresAt ? parseDateInput(p.data.expiresAt) : null,
      authorId: owner.id,
    },
  });
  refresh();
  return { ok: true };
}

export async function toggleAnnouncementPinAction(id: string): Promise<ActionResult> {
  await assertOwner();
  const a = await db.announcement.findUnique({ where: { id } });
  if (!a) return fail("Not found.");
  await db.announcement.update({ where: { id }, data: { pinned: !a.pinned } });
  refresh();
  return { ok: true };
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  await assertOwner();
  await db.announcement.delete({ where: { id } }).catch(() => null);
  refresh();
  return { ok: true };
}

// ---- Document vault --------------------------------------------------------
export async function uploadDocumentAction(fd: FormData): Promise<ActionResult> {
  const owner = await assertOwner();
  const p = parseForm(documentSchema, fd);
  if (!p.ok) return p.result;
  const file = getFile(fd, "file");
  if (!file) return fail("Choose a file to upload.", { file: ["Required"] });

  // Personal documents (leases, IDs) must belong to a tenant; only house rules / other may be shared.
  if (!p.data.tenantId && (p.data.type === "LEASE" || p.data.type === "ID")) {
    return fail("Leases and IDs must be assigned to a tenant.", { tenantId: ["Choose a tenant"] });
  }
  if (p.data.tenantId) {
    const t = await db.user.findFirst({ where: { id: p.data.tenantId, role: "TENANT" } });
    if (!t) return fail("Tenant not found.");
  }

  try {
    const asset = await saveUpload(file, owner.id);
    await db.document.create({
      data: { title: p.data.title, type: p.data.type, tenantId: p.data.tenantId || null, fileId: asset!.id },
    });
  } catch (e) {
    if (e instanceof UploadError) return fail(e.message, { file: [e.message] });
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function deleteDocumentAction(id: string): Promise<ActionResult> {
  await assertOwner();
  await db.document.delete({ where: { id } }).catch(() => null);
  refresh();
  return { ok: true };
}

// ---- Emergency contacts ----------------------------------------------------
export async function createContactAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(contactSchema, fd);
  if (!p.ok) return p.result;
  await db.contact.create({
    data: { ...p.data, role: p.data.role || null, notes: p.data.notes || null },
  });
  refresh();
  return { ok: true };
}

export async function deleteContactAction(id: string): Promise<ActionResult> {
  await assertOwner();
  await db.contact.delete({ where: { id } }).catch(() => null);
  refresh();
  return { ok: true };
}

// ---- Settings --------------------------------------------------------------
export async function saveSettingsAction(fd: FormData): Promise<ActionResult> {
  await assertOwner();
  const p = parseForm(settingsSchema, fd);
  if (!p.ok) return p.result;
  await Promise.all(
    (Object.keys(p.data) as (keyof typeof p.data)[]).map((k) => setSetting(k, String(p.data[k]))),
  );
  refresh();
  return { ok: true, message: "Settings saved" };
}
