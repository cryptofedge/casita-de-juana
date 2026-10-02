import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { PriorityBadge, TicketStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, TableWrap, Td, Th } from "@/components/shared/page";
import { cn } from "@/lib/utils";
import type { TicketStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Maintenance" };
export const dynamic = "force-dynamic";

const FILTERS = ["ACTIVE", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED", "ALL"] as const;

export default async function MaintenancePage({ searchParams }: PageProps<"/admin/maintenance">) {
  const sp = await searchParams;
  const f = (FILTERS as readonly string[]).includes(String(sp.status)) ? String(sp.status) : "ACTIVE";
  const where =
    f === "ALL" ? {} : f === "ACTIVE" ? { status: { in: ["OPEN", "IN_PROGRESS"] as TicketStatus[] } } : { status: f as TicketStatus };

  const tickets = await db.ticket.findMany({
    where,
    include: { unit: true, createdBy: true, _count: { select: { messages: true } } },
    orderBy: { updatedAt: "desc" },
  });
  // urgent first within the list
  const rank = { URGENT: 0, MEDIUM: 1, LOW: 2 } as const;
  tickets.sort((a, b) => rank[a.priority] - rank[b.priority] || b.updatedAt.getTime() - a.updatedAt.getTime());

  return (
    <>
      <PageHeader title="Maintenance & Ideas" description="Requests, complaints and improvement ideas from tenants." />
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <Link
            key={s}
            href={`/admin/maintenance?status=${s}`}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium",
              f === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-secondary",
            )}
          >
            {s === "ACTIVE" ? "Active" : s === "ALL" ? "All" : STATUS_LABEL[s]}
          </Link>
        ))}
      </div>
      {tickets.length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <TableWrap>
          <thead>
            <tr><Th>Request</Th><Th>Unit</Th><Th>Category</Th><Th>Priority</Th><Th>Status</Th><Th>Updated</Th></tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} className="hover:bg-secondary/40">
                <Td>
                  <Link href={`/admin/maintenance/${t.id}`} className="font-semibold hover:underline">{t.title}</Link>
                  <span className="block text-xs text-muted-foreground">{t.createdBy.name} · {t._count.messages} message{t._count.messages === 1 ? "" : "s"}</span>
                </Td>
                <Td className="font-semibold">{t.unit.label}</Td>
                <Td>{CATEGORY_LABEL[t.category]}</Td>
                <Td><PriorityBadge priority={t.priority} /></Td>
                <Td><TicketStatusBadge status={t.status} /></Td>
                <Td className="whitespace-nowrap">{fmtDate(t.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
