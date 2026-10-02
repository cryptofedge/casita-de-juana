import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";

import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { requireTenant } from "@/lib/session";
import { PriorityBadge, TicketStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("My requests") };
}
export const dynamic = "force-dynamic";

export default async function PortalRequests() {
  const { user, lease } = await requireTenant();
  const { t, locale } = await getI18n();
  // Only tickets this tenant submitted
  const tickets = await db.ticket.findMany({
    where: { createdById: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("My requests")}</h1>
        {lease && <Button asChild><Link href="/portal/requests/new"><Plus /> {t("New")}</Link></Button>}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">{t("Repairs, complaints and ideas to improve the building.")}</p>
      {tickets.length === 0 ? (
        <EmptyState title={t("No requests yet")}>{t("Something broken? Have an idea? Tap “New”.")}</EmptyState>
      ) : (
        <div className="space-y-2">
          {tickets.map((tk) => (
            <Link key={tk.id} href={`/portal/requests/${tk.id}`} className="block">
              <Card className="p-4 active:bg-secondary">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold">{tk.title}</div>
                  <TicketStatusBadge status={tk.status} label={t(STATUS_LABEL[tk.status])} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{t(CATEGORY_LABEL[tk.category])}</span>·<span>{fmtDate(tk.createdAt, locale)}</span>·<span>{t(tk._count.messages === 1 ? "{n} message" : "{n} messages", { n: tk._count.messages })}</span>
                  <PriorityBadge priority={tk.priority} label={t(PRIORITY_LABEL[tk.priority])} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
