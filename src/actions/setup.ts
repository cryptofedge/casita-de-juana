"use server";

import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { db } from "@/lib/db";
import { parseForm } from "@/lib/form-server";
import { isPlaceholderEmail } from "@/lib/setup";
import { fail, setupSchema, type ActionResult } from "@/lib/validators";

// Brute-force guard for the setup code: 8 wrong tries / 15 min (per server instance).
const fails = { count: 0, first: 0 };
const WINDOW = 15 * 60 * 1000;
const limited = () => fails.count >= 8 && Date.now() - fails.first < WINDOW;
function recordFail() {
  if (Date.now() - fails.first > WINDOW) {
    fails.count = 0;
    fails.first = Date.now();
  }
  fails.count += 1;
}

/**
 * First-run: lets the real owner claim the site. Requires the SETUP_CODE that the person who deployed
 * the site configured, so a stranger who finds the URL first cannot take over an unclaimed site.
 */
export async function completeSetupAction(fd: FormData): Promise<ActionResult> {
  const p = parseForm(setupSchema, fd);
  if (!p.ok) return p.result;

  const expected = process.env.SETUP_CODE?.trim();
  if (!expected) return fail("Setup is turned off. Ask the person who set up the site to add a SETUP_CODE.");
  if (limited()) return fail("Too many attempts. Try again in 15 minutes.");

  const given = Buffer.from(p.data.code.trim());
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) {
    recordFail();
    return fail("Incorrect setup code.", { code: ["Incorrect setup code."] });
  }
  if (isPlaceholderEmail(p.data.email)) {
    return fail("Use your real email address.", { email: ["Use your real email address."] });
  }

  const passwordHash = await bcrypt.hash(p.data.password, 12);
  try {
    await db.$transaction(
      async (tx) => {
        const owners = await tx.user.findMany({ where: { role: "OWNER" } });
        if (owners.some((o) => !isPlaceholderEmail(o.email))) throw new Error("ALREADY_DONE");
        const placeholder = owners[0]; // the dummy owner, if any
        const clash = await tx.user.findUnique({ where: { email: p.data.email } });
        if (clash && clash.id !== placeholder?.id) throw new Error("EMAIL_TAKEN");
        const data = { name: p.data.name, email: p.data.email, passwordHash, active: true };
        if (placeholder) await tx.user.update({ where: { id: placeholder.id }, data });
        else await tx.user.create({ data: { ...data, role: "OWNER" } });
      },
      { isolationLevel: "Serializable" },
    );
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    if (m === "ALREADY_DONE") return fail("This site has already been set up. Please sign in.");
    if (m === "EMAIL_TAKEN") return fail("That email is already in use.", { email: ["That email is already in use."] });
    throw e;
  }

  try {
    await signIn("credentials", { email: p.data.email, password: p.data.password, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return fail("Account created. Please sign in.");
    throw e; // the redirect on success
  }
  return { ok: true };
}
