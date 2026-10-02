import { db } from "./db";

/** Emails on this domain mark a placeholder owner that is waiting to be claimed on /setup. */
export const PLACEHOLDER_DOMAIN = "casita-setup.invalid";

export const isPlaceholderEmail = (email: string) => email.toLowerCase().endsWith(`@${PLACEHOLDER_DOMAIN}`);

/** True until a real (non-placeholder) owner exists. Drives the first-run /setup page. */
export async function needsSetup(): Promise<boolean> {
  const owners = await db.user.findMany({ where: { role: "OWNER", active: true }, select: { email: true } });
  return !owners.some((o) => !isPlaceholderEmail(o.email));
}
