import { db } from "./db";

export interface ActivityItem {
  id: string;
  at: Date;
  kind: "ticket" | "message" | "proof" | "bill";
  who: string;
  unit: string;
  detail: string;
  href: string;
}

const KEY = "activitySeenAt";

/** Tenant activity the owner has not marked as seen yet (newest first). */
export async function getNewActivity(): Promise<ActivityItem[]> {
  const row = await db.setting.findUnique({ where: { key: KEY } });
  const parsed = row ? new Date(row.value) : null;
  const since = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(Date.now() - 14 * 86_400_000);

  const [tickets, messages, proofs, tenants] = await Promise.all([
    db.ticket.findMany({ where: { createdAt: { gt: since } }, include: { unit: true, createdBy: true } }),
    db.ticketMessage.findMany({ where: { createdAt: { gt: since }, author: { role: "TENANT" } }, include: { author: true, ticket: { include: { unit: true } } } }),
    db.paymentSubmission.findMany({ where: { createdAt: { gt: since } }, include: { lease: { include: { tenant: true, unit: true } } } }),
    db.user.findMany({ where: { role: "TENANT" }, select: { id: true, name: true } }),
  ]);
  const names = new Map(tenants.map((t) => [t.id, t.name]));
  const bills = await db.utilityBill.findMany({
    where: { createdAt: { gt: since }, unitId: { not: null }, createdBy: { in: [...names.keys()] } },
    include: { unit: true },
  });

  const items: ActivityItem[] = [
    ...tickets.map((t) => ({ id: `t${t.id}`, at: t.createdAt, kind: "ticket" as const, who: t.createdBy.name, unit: t.unit.label, detail: t.title, href: `/admin/maintenance/${t.id}` })),
    ...messages.map((m) => ({ id: `m${m.id}`, at: m.createdAt, kind: "message" as const, who: m.author.name, unit: m.ticket.unit.label, detail: m.ticket.title, href: `/admin/maintenance/${m.ticketId}` })),
    ...proofs.map((p) => ({ id: `p${p.id}`, at: p.createdAt, kind: "proof" as const, who: p.lease.tenant.name, unit: p.lease.unit.label, detail: "", href: "/admin/finance" })),
    ...bills.map((b) => ({ id: `b${b.id}`, at: b.createdAt, kind: "bill" as const, who: names.get(b.createdBy) ?? "", unit: b.unit?.label ?? "", detail: b.period, href: "/admin/edenorte" })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 15);
}

export async function markActivitySeen() {
  const value = new Date().toISOString();
  await db.setting.upsert({ where: { key: KEY }, update: { value }, create: { key: KEY, value } });
}
