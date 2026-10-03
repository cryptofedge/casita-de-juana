import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { db } from "@/lib/db";
import { CONTACT_CATEGORY_LABEL } from "@/lib/labels";
import { requireTenant } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";

import { Plus, Trash2 } from "lucide-react";
import { createMyContactAction, deleteMyContactAction } from "@/actions/content";
import { ContactForm } from "@/components/admin/content-forms";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Emergency contacts") };
}
export const dynamic = "force-dynamic";

export default async function PortalContacts() {
  const { user } = await requireTenant();
  const { t } = await getI18n();
  const all = await db.contact.findMany({ where: { OR: [{ tenantId: null }, { tenantId: user.id }] }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const contacts = all.filter((c) => !c.tenantId);
  const mine = all.filter((c) => c.tenantId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("Emergency contacts")}</h1>
      <p className="-mt-2 text-sm text-muted-foreground">{t("Tap a number to call.")}</p>
      {contacts.length === 0 ? <EmptyState title={t("No contacts yet")} /> : (
        <div className="space-y-3">
          {contacts.map((c) => {
            const emergency = c.category === "EMERGENCY";
            return (
              <a
                key={c.id}
                href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                className={`flex items-center gap-4 rounded-xl border p-4 shadow-sm active:scale-[0.99] ${emergency ? "border-destructive/40 bg-destructive-soft" : "bg-card"}`}
              >
                <div className={`flex size-12 shrink-0 items-center justify-center rounded-full ${emergency ? "bg-destructive text-white" : "bg-info-soft text-primary"}`}>
                  <Phone className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{[t(CONTACT_CATEGORY_LABEL[c.category]), c.role].filter(Boolean).join(" · ")}</div>
                  <div className="font-display text-lg font-semibold">{c.phone}</div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      <section className="space-y-3 border-t pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{t("My own contacts")}</h2>
          <FormDialog trigger={<Button size="sm"><Plus /> {t("Add contact")}</Button>} title="Add a contact">
            <ContactForm action={createMyContactAction} />
          </FormDialog>
        </div>
        <p className="text-sm text-muted-foreground">{t("Family, a doctor, a neighbor. Only you and the owner can see these.")}</p>
        {mine.length === 0 ? <EmptyState title={t("No personal contacts yet")} /> : (
          <div className="space-y-3">
            {mine.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <a href={`tel:${c.phone.replace(/[^d+]/g, "")}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-info-soft text-primary">
                    <Phone className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-sm text-muted-foreground">{[t(CONTACT_CATEGORY_LABEL[c.category]), c.role].filter(Boolean).join(" · ")}</div>
                    <div className="font-display text-lg font-semibold">{c.phone}</div>
                    {c.notes && <div className="text-xs text-muted-foreground">{c.notes}</div>}
                  </div>
                </a>
                <ActionButton size="sm" variant="ghost" aria-label={t("Delete contact")} confirm={t("Delete this contact?")} action={deleteMyContactAction.bind(null, c.id)}><Trash2 /></ActionButton>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
