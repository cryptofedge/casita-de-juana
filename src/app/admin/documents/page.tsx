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

export const metadata: Metadata = { title: "Document Vault" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const [docs, leases] = await Promise.all([
    db.document.findMany({ orderBy: { createdAt: "desc" }, include: { file: true, tenant: true } }),
    db.lease.findMany({ where: { active: true }, include: { tenant: true, unit: true }, orderBy: { unit: { label: "asc" } } }),
  ]);
  const tenants = leases.map((l) => ({ id: l.tenantId, name: l.tenant.name, unit: l.unit.label }));

  return (
    <>
      <PageHeader
        title="Document Vault"
        description="Leases, house rules and IDs. Tenants only see their own documents plus shared ones (like house rules)."
        actions={
          tenants.length > 0 && (
            <FormDialog trigger={<Button><Plus /> Upload document</Button>} title="Upload a document">
              <DocumentForm tenants={tenants} />
            </FormDialog>
          )
        }
      />
      {docs.length === 0 ? (
        <EmptyState title="The vault is empty" />
      ) : (
        <TableWrap>
          <thead><tr><Th>Document</Th><Th>Type</Th><Th>Visible to</Th><Th>Added</Th><Th>Size</Th><Th><span className="sr-only">Actions</span></Th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <Td><FileLink id={d.file.id} name={d.file.filename} mime={d.file.mime} label={d.title} /></Td>
                <Td><Badge>{DOC_TYPE_LABEL[d.type]}</Badge></Td>
                <Td>{d.tenant ? d.tenant.name : <Badge tone="teal">All tenants</Badge>}</Td>
                <Td className="whitespace-nowrap">{fmtDate(d.createdAt)}</Td>
                <Td className="whitespace-nowrap">{formatBytes(d.file.size)}</Td>
                <Td className="text-right">
                  <ActionButton size="sm" variant="ghost" aria-label="Delete document" confirm="Delete this document?" action={deleteDocumentAction.bind(null, d.id)}><Trash2 /></ActionButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
