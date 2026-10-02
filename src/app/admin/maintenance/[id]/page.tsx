import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireOwner } from "@/lib/session";
import { CATEGORY_LABEL } from "@/lib/labels";
import { fmtDate } from "@/lib/dates";
import { PriorityBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BackLink } from "@/components/shared/page";
import { ReplyForm, StatusControl } from "@/components/shared/ticket-parts";
import { TicketThread } from "@/components/shared/ticket-thread";
import Link from "next/link";

export const metadata: Metadata = { title: "Request" };
export const dynamic = "force-dynamic";

export default async function AdminTicket({ params }: PageProps<"/admin/maintenance/[id]">) {
  const owner = await requireOwner();
  const { id } = await params;
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      unit: true,
      createdBy: true,
      attachments: { include: { file: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: true } },
    },
  });
  if (!ticket) notFound();

  return (
    <>
      <BackLink href="/admin/maintenance">All requests</BackLink>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h1 className="text-2xl font-semibold">{ticket.title}</h1>
          <div className="mb-4 mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <PriorityBadge priority={ticket.priority} />
            <span>{CATEGORY_LABEL[ticket.category]}</span>
          </div>
          <TicketThread
            description={ticket.description}
            createdAt={ticket.createdAt}
            authorName={ticket.createdBy.name}
            attachments={ticket.attachments}
            messages={ticket.messages.map((m) => ({ ...m, author: { id: m.author.id, name: m.author.name, role: m.author.role } }))}
            viewerId={owner.id}
          />
          <Card className="mt-6">
            <CardContent className="pt-4 sm:pt-5"><ReplyForm ticketId={ticket.id} /></CardContent>
          </Card>
        </div>
        <aside>
          <Card>
            <CardContent className="space-y-4 pt-4 text-sm sm:pt-5">
              <StatusControl ticketId={ticket.id} status={ticket.status} />
              <dl className="grid grid-cols-2 gap-y-1.5">
                <dt className="text-muted-foreground">Unit</dt><dd className="text-right font-medium">Apt {ticket.unit.label}</dd>
                <dt className="text-muted-foreground">Tenant</dt>
                <dd className="text-right font-medium"><Link className="hover:underline" href={`/admin/tenants/${ticket.createdById}`}>{ticket.createdBy.name}</Link></dd>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="text-right font-medium">{ticket.createdBy.phone ? <a className="text-primary hover:underline" href={`tel:${ticket.createdBy.phone}`}>{ticket.createdBy.phone}</a> : "-"}</dd>
                <dt className="text-muted-foreground">Opened</dt><dd className="text-right font-medium">{fmtDate(ticket.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
