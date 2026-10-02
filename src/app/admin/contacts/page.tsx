import { getI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { Phone, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { CONTACT_CATEGORY_LABEL } from "@/lib/labels";
import { deleteContactAction } from "@/actions/content";
import { ContactForm } from "@/components/admin/content-forms";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Emergency Contacts") };
}
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const { t: tr } = await getI18n();
  const contacts = await db.contact.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <>
      <PageHeader
        title={tr("Emergency Contacts")}
        description={tr("Shown to tenants as tap-to-call buttons.")}
        actions={<FormDialog trigger={<Button><Plus /> {tr("Add contact")}</Button>} title="Add a contact"><ContactForm /></FormDialog>}
      />
      {contacts.length === 0 ? <EmptyState title={tr("No contacts yet")} /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => (
            <Card key={c.id} className="flex items-center gap-3 p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-info-soft text-primary"><Phone className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{c.name}</div>
                <div className="text-sm text-muted-foreground">{c.role ?? ""} <a className="font-medium text-primary hover:underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a></div>
                {c.notes && <div className="text-xs text-muted-foreground">{c.notes}</div>}
              </div>
              <Badge tone={c.category === "EMERGENCY" ? "red" : "gray"}>{tr(CONTACT_CATEGORY_LABEL[c.category])}</Badge>
              <ActionButton size="sm" variant="ghost" aria-label={tr("Delete contact")} confirm={tr("Delete this contact?")} action={deleteContactAction.bind(null, c.id)}><Trash2 /></ActionButton>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
