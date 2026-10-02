import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "./db";

/** Loads the signed-in user from the DB so deactivated accounts lose access immediately. */
export const getSessionUser = cache(async () => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.user.findUnique({ where: { id } });
  if (!user || !user.active) return null;
  return user;
});

export async function requireOwner() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "OWNER") redirect("/portal");
  return user;
}

/**
 * The tenant context. EVERY tenant-facing query must derive its scope from
 * this (lease/unit/user ids) and never from client-supplied ids.
 */
export const getTenantContext = cache(async () => {
  const user = await getSessionUser();
  if (!user) return null;
  if (user.role !== "TENANT") return null;
  const lease = await db.lease.findFirst({
    where: { tenantId: user.id, active: true },
    include: { unit: true },
    orderBy: { startDate: "desc" },
  });
  return { user, lease };
});

export async function requireTenant() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "TENANT") redirect("/admin");
  const ctx = await getTenantContext();
  if (!ctx) redirect("/login");
  return ctx;
}

/** For server actions: throws instead of redirecting. */
export async function assertOwner() {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") throw new Error("Not authorized");
  return user;
}

export async function assertTenant() {
  const ctx = await getTenantContext();
  if (!ctx) throw new Error("Not authorized");
  return ctx;
}
