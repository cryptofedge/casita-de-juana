import { getI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { DOC_TYPE_LABEL } from "@/lib/labels";
import { formatBytes } from "@/lib/storage";
import { deleteDocumentAction } from "@/actions/content";
import { DocumentForm } from "@/components/admin/content-forms";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, FileLink, PageHeader, TableWrap, Td, Th } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Document Vault") };
}
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const { t: tr, locale } = await getI18n();
  const [docs, leases] = await Promise.all([
    db.document.findMany({ orderBy: { createdAt: "desc" }, include: { file: true, tenant: true } }),
    db.lease.findMany({ where: { active: true }, include: { tenant: true, unit: true }, orderBy: { unit: { label: "asc" } } }),
  ]);
  const tenants = leases.map((l) => ({ id: l.tenantId, name: l.tenant.name, unit: l.unit.label }));

  return (
    <>
      <PageHeader
        title={tr("Document Vault")}
        description={tr("Leases, house rules and IDs. Tenants only see their own documents plus shared ones (like house rules).")}
        actions={
          tenants.length > 0 && (
            <FormDialog trigger={<Button><Plus /> {tr("Upload document")}</Button>} title="Upload a document">
              <DocumentForm tenants={tenants} />
            </FormDialog>
          )
        }
      />
      {docs.length === 0 ? (
        <EmptyState title={tr("The vault is empty")} />
      ) : (
        <TableWrap>
          <thead><tr><Th>{tr("Document")}</Th><Th>{tr("Type")}</Th><Th>{tr("Visible to")}</Th><Th>{tr("Added")}</Th><Th>{tr("Size")}</Th><Th><span className="sr-only">{tr("Actions")}</span></Th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <Td><FileLink id={d.file.id} name={d.file.filename} mime={d.file.mime} label={d.title} /></Td>
                <Td><Badge>{tr(DOC_TYPE_LABEL[d.type])}</Badge></Td>
                <Td>{d.tenant ? d.tenant.name : <Badge tone="teal">{tr("All tenants")}</Badge>}</Td>
                <Td className="whitespace-nowrap">{fmtDate(d.createdAt, locale)}</Td>
                <Td className="whitespace-nowrap">{formatBytes(d.file.size)}</Td>
                <Td className="text-right">
                  <ActionButton size="sm" variant="ghost" aria-label={tr("Delete document")} confirm={tr("Delete this document?")} action={deleteDocumentAction.bind(null, d.id)}><Trash2 /></ActionButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
