"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { parseForm } from "@/lib/form-server";
import { getSessionUser } from "@/lib/session";
import { changePasswordSchema, fail, type ActionResult } from "@/lib/validators";

// Guard against someone with a borrowed, unlocked session guessing the current password:
// 5 wrong tries per user per 15 minutes (per server instance).
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW = 15 * 60 * 1000;

function blocked(id: string) {
  const a = attempts.get(id);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW) {
    attempts.delete(id);
    return false;
  }
  return a.count >= 5;
}
function recordFail(id: string) {
  const a = attempts.get(id);
  if (!a || Date.now() - a.first > WINDOW) attempts.set(id, { count: 1, first: Date.now() });
  else a.count += 1;
}

/** Lets the signed-in owner or tenant change their own password. */
export async function changePasswordAction(fd: FormData): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("Not authorized.");
  const p = parseForm(changePasswordSchema, fd);
  if (!p.ok) return p.result;
  if (blocked(user.id)) return fail("Too many attempts. Try again in 15 minutes.");

  const ok = !!user.passwordHash && (await bcrypt.compare(p.data.current, user.passwordHash));
  if (!ok) {
    recordFail(user.id);
    return fail("Current password is incorrect.", { current: ["Current password is incorrect."] });
  }
  if (user.role === "OWNER" && p.data.password.length < 10) {
    return fail("Owners need at least 10 characters.", { password: ["Owners need at least 10 characters."] });
  }
  if (p.data.password === p.data.current) {
    return fail("New password must be different.", { password: ["New password must be different."] });
  }

  attempts.delete(user.id);
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(p.data.password, 12) } });
  return { ok: true };
}
