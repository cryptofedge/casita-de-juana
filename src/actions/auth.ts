"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { parseForm } from "@/lib/form-server";
import { LOCALE_COOKIE } from "@/lib/i18n";
import { CURRENCY_COOKIE } from "@/lib/money";
import { acceptInviteSchema, fail, loginSchema, type ActionResult } from "@/lib/validators";

export async function loginAction(fd: FormData): Promise<ActionResult> {
  const p = parseForm(loginSchema, fd);
  if (!p.ok) return p.result;
  try {
    await signIn("credentials", { ...p.data, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return fail("Incorrect email or password.");
    throw e; // the redirect on success
  }
  return { ok: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function acceptInviteAction(token: string, fd: FormData): Promise<ActionResult> {
  const p = parseForm(acceptInviteSchema, fd);
  if (!p.ok) return p.result;

  const user = await db.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.inviteExpires || user.inviteExpires < new Date() || !user.active) {
    return fail("This invitation link is invalid or has expired. Ask the owner for a new one.");
  }
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(p.data.password, 12),
      inviteToken: null,
      inviteExpires: null,
    },
  });
  try {
    await signIn("credentials", { email: user.email, password: p.data.password, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) return fail("Password saved. Please sign in.");
    throw e;
  }
  return { ok: true };
}

export async function setLanguageAction(locale: "en" | "es") {
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale === "es" ? "es" : "en", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setCurrencyAction(currency: "USD" | "DOP") {
  const jar = await cookies();
  jar.set(CURRENCY_COOKIE, currency === "DOP" ? "DOP" : "USD", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
