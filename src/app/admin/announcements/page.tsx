import type { Metadata } from "next";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { deleteAnnouncementAction, toggleAnnouncementPinAction } from "@/actions/content";
import { AnnouncementForm } from "@/components/admin/content-forms";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";

export const metadata: Metadata = { title: "Notice Board" };
export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const items = await db.announcement.findMany({ orderBy: [{ pinned: "desc" }, { createdAt: "desc" }] });
  return (
    <>
      <PageHeader
        title="Notice Board"
        description="Broadcasts for scheduled shut-offs, fumigation, quiet hours and more. Pinned notices stay at the top of every tenant's dashboard."
        actions={
          <FormDialog trigger={<Button><Plus /> New announcement</Button>} title="New announcement">
            <AnnouncementForm />
          </FormDialog>
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No announcements yet" />
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg font-semibold">{a.title}</h3>
                    {a.pinned && <Badge tone="clay">Pinned</Badge>}
                    {a.expiresAt && a.expiresAt < new Date() && <Badge>Expired</Badge>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{a.body}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Posted {fmtDate(a.createdAt)}{a.expiresAt ? ` · hides ${fmtDate(a.expiresAt)}` : ""}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <ActionButton size="sm" variant="ghost" aria-label={a.pinned ? "Unpin" : "Pin"} action={toggleAnnouncementPinAction.bind(null, a.id)}>
                    {a.pinned ? <PinOff /> : <Pin />}
                  </ActionButton>
                  <ActionButton size="sm" variant="ghost" aria-label="Delete" confirm="Delete this announcement?" action={deleteAnnouncementAction.bind(null, a.id)}>
                    <Trash2 />
                  </ActionButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
