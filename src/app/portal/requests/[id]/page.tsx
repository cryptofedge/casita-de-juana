import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { requireTenant } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";

import { PriorityBadge, TicketStatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BackLink } from "@/components/shared/page";
import { ReplyForm } from "@/components/shared/ticket-parts";
import { TicketThread } from "@/components/shared/ticket-thread";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Requests") };
}
export const dynamic = "force-dynamic";

export default async function PortalTicket({ params }: PageProps<"/portal/requests/[id]">) {
  const { user } = await requireTenant();
  const { t, locale } = await getI18n();
  const { id } = await params;
  // `createdById: user.id` is the access check: other tenants' tickets 404.
  const ticket = await db.ticket.findFirst({
    where: { id, createdById: user.id },
    include: {
      attachments: { include: { file: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <div className="space-y-4">
      <BackLink href="/portal/requests">{t("My requests")}</BackLink>
      <div>
        <h1 className="text-2xl font-semibold">{ticket.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <TicketStatusBadge status={ticket.status} label={t(STATUS_LABEL[ticket.status])} />
          <PriorityBadge priority={ticket.priority} label={t(PRIORITY_LABEL[ticket.priority])} />
          <span>{t(CATEGORY_LABEL[ticket.category])}</span>
        </div>
      </div>
      <TicketThread
        description={ticket.description}
        createdAt={ticket.createdAt}
        authorName={t("You")}
        locale={locale}
        ownerLabel={t("Owner")}
        attachments={ticket.attachments}
        messages={ticket.messages.map((m) => ({ ...m, author: { id: m.author.id, name: m.author.name, role: m.author.role } }))}
        viewerId={user.id}
      />
      <Card>
        <CardContent className="pt-4"><ReplyForm ticketId={ticket.id} /></CardContent>
      </Card>
    </div>
  );
}
