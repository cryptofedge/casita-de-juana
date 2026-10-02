import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";

import { DOC_TYPE_LABEL } from "@/lib/labels";
import { requireTenant } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("My documents") };
}
export const dynamic = "force-dynamic";

export default async function PortalDocuments() {
  const { user } = await requireTenant();
  const { t, locale } = await getI18n();
  // Own documents + shared ones (house rules). Shared IDs are never exposed.
  const docs = await db.document.findMany({
    where: { OR: [{ tenantId: user.id }, { tenantId: null, type: { not: "ID" } }] },
    include: { file: true },
    orderBy: { createdAt: "desc" },
  });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t("My documents")}</h1>
      {docs.length === 0 ? <EmptyState title={t("No documents yet")} /> : (
        <Card className="divide-y">
          {docs.map((d) => (
            <a key={d.id} href={`/api/files/${d.file.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-4 active:bg-secondary">
              <FileText className="size-6 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{d.title}</div>
                <div className="text-xs text-muted-foreground">{t(DOC_TYPE_LABEL[d.type])} · {fmtDate(d.createdAt, locale)}</div>
              </div>
            </a>
          ))}
        </Card>
      )}
    </div>
  );
}
