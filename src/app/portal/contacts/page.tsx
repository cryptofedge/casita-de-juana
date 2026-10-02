import type { Metadata } from "next";
import { Phone } from "lucide-react";
import { db } from "@/lib/db";
import { CONTACT_CATEGORY_LABEL } from "@/lib/labels";
import { requireTenant } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";

import { EmptyState } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Emergency contacts") };
}
export const dynamic = "force-dynamic";

export default async function PortalContacts() {
  await requireTenant();
  const { t } = await getI18n();
  const contacts = await db.contact.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
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
    </div>
  );
}
