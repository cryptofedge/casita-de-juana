import { appUrl } from "./app-url";
import { db } from "./db";
import { isPlaceholderEmail } from "./setup";

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const mailConfigured = () => !!process.env.RESEND_API_KEY;

/** Who gets owner alerts: OWNER_NOTIFY_EMAIL (comma separated) or every real owner account. */
export async function ownerRecipients(): Promise<string[]> {
  const env = process.env.OWNER_NOTIFY_EMAIL?.split(",").map((s) => s.trim()).filter(Boolean);
  if (env?.length) return env;
  const owners = await db.user.findMany({ where: { role: "OWNER", active: true }, select: { email: true } });
  return owners.map((o) => o.email).filter((e) => !isPlaceholderEmail(e));
}

/** Best-effort email through Resend. Never throws: a mail problem must not break the tenant's request. */
export async function sendMail(opts: { to: string[]; subject: string; text: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key || opts.to.length === 0) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || "Casita de Juana <onboarding@resend.dev>",
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      }),
    });
    if (!res.ok) console.error("[mail] Resend error", res.status, await res.text());
  } catch (e) {
    console.error("[mail] failed", e);
  }
}

/** Tell the owner(s) that a tenant posted something. `path` is where they should click to review it. */
export async function notifyOwner(opts: { subject: string; lines: string[]; path: string }) {
  try {
    const to = await ownerRecipients();
    const link = `${appUrl()}${opts.path}`;
    const text = `${opts.lines.join("\n")}\n\nOpen: ${link}\n\n- Casita de Juana`;
    const html = `<div style="font-family:system-ui,sans-serif;max-width:520px">
  <h2 style="color:#19778a;margin:0 0 12px">${esc(opts.subject)}</h2>
  ${opts.lines.map((l) => `<p style="margin:4px 0">${esc(l)}</p>`).join("")}
  <p style="margin:20px 0"><a href="${link}" style="background:#19778a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Open in Casita de Juana</a></p>
  <p style="color:#777;font-size:12px">You get this because a tenant posted something on the site.</p>
</div>`;
    await sendMail({ to, subject: `[Casita de Juana] ${opts.subject}`, text, html });
  } catch (e) {
    console.error("[mail] notifyOwner failed", e);
  }
}
