import type { Metadata } from "next";
import { Pin } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";

import { requireTenant } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Notice board") };
}
export const dynamic = "force-dynamic";

export default async function Notices() {
  await requireTenant();
  const { t, locale } = await getI18n();
  const items = await db.announcement.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("Notice board")}</h1>
      {items.length === 0 ? <EmptyState title={t("No notices right now")} /> : items.map((n) => (
        <Card key={n.id} className={`p-4 ${n.pinned ? "border-gold/60 bg-warning-soft" : ""}`}>
          {n.pinned && <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#8a5a00]"><Pin className="size-3.5" /> {t("Pinned")}</div>}
          <h2 className="font-display text-lg font-semibold">{n.title}</h2>
          <p className="mt-1 whitespace-pre-wrap text-[15px]">{n.body}</p>
          <div className="mt-2 text-xs text-muted-foreground">{fmtDate(n.createdAt, locale)}</div>
        </Card>
      ))}
    </div>
  );
}
