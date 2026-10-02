import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import type { Metadata } from "next";
import { Building2, Plus, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { runBilling } from "@/lib/billing";
import { toDateInput, todayLocal } from "@/lib/dates";
import { buildLedger } from "@/lib/ledger";
import { moneyFormatter } from "@/lib/money";
import { getMoneyContext } from "@/lib/settings";
import { toggleUnitAction } from "@/actions/tenants";
import { InviteTenantForm, UnitForm } from "@/components/admin/tenant-forms";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Badge, PaymentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Tenants & Units") };
}
export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  const { t: tr } = await getI18n();
  await runBilling();
  const { display, rate } = await getMoneyContext();
  const m = moneyFormatter(display, rate);
  const today = todayLocal();

  const units = await db.unit.findMany({
    orderBy: [{ floor: "asc" }, { label: "asc" }],
    include: { leases: { where: { active: true }, include: { tenant: true, charges: true, payments: true } } },
  });
  const vacant = units.filter((u) => u.active && u.leases.length === 0).map((u) => ({ id: u.id, label: u.label }));
  const floors = [...new Set(units.map((u) => u.floor))];

  return (
    <>
      <PageHeader
        title={tr("Tenants & Units")}
        description={tr("Each tenant is assigned to exactly one unit and only sees that unit's data.")}
        actions={
          <>
            {vacant.length > 0 && (
              <FormDialog trigger={<Button><UserPlus /> {tr("Add tenant")}</Button>} title="Add a tenant" description="Creates their login and lease. You then share a private sign-up link." refreshOnClose>
                <InviteTenantForm units={vacant} today={toDateInput(today)} />
              </FormDialog>
            )}
            <FormDialog trigger={<Button variant="outline"><Plus /> {tr("Add unit")}</Button>} title="Add a unit" description="Use this when the property expands.">
              <UnitForm />
            </FormDialog>
          </>
        }
      />

      {floors.map((floor) => (
        <section key={floor} className="mb-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Building2 className="size-5 text-primary" /> {tr("Floor {n}", { n: floor })}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {units.filter((u) => u.floor === floor).map((u) => {
              const lease = u.leases[0];
              const ledger = lease ? buildLedger(lease.charges, lease.payments, today, lease.graceDays) : null;
              const worst = ledger?.rows.find((r) => r.status === "OVERDUE") ?? ledger?.rows.find((r) => r.status === "PARTIAL");
              return (
                <Card key={u.id} className={`p-4 ${!u.active ? "opacity-60" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-display text-xl font-semibold">{tr("Apt {unit}", { unit: u.label })}</div>
                      <div className="text-sm text-muted-foreground">{tr(u.bedrooms === 1 ? "{n} bed" : "{n} beds", { n: u.bedrooms })}{u.notes ? ` · ${u.notes}` : ""}</div>
                    </div>
                    {!u.active ? <Badge>{tr("Inactive")}</Badge> : lease ? <Badge tone="green">{tr("Occupied")}</Badge> : <Badge tone="amber">{tr("Vacant")}</Badge>}
                  </div>
                  {lease && ledger && (
                    <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
                      <div className="min-w-0">
                        <Link href={`/admin/tenants/${lease.tenantId}`} className="block truncate font-semibold hover:underline">{lease.tenant.name}</Link>
                        <div className="text-sm text-muted-foreground">{tr("{amount}/mo", { amount: m(lease.monthlyRent, lease.currency) })}</div>
                      </div>
                      <div className="text-right">
                        {worst && <PaymentStatusBadge status={worst.status} />}
                        <div className={`mt-1 text-sm font-semibold ${ledger.balance > 0 ? "text-destructive" : "text-success"}`}>
                          {ledger.balance > 0 ? tr("{amount} due", { amount: m(ledger.balance, lease.currency) }) : tr("Settled")}
                        </div>
                      </div>
                    </div>
                  )}
                  {!lease && (
                    <div className="mt-3 border-t pt-3">
                      <ActionButton size="sm" variant="ghost" action={toggleUnitAction.bind(null, u.id)}>
                        {u.active ? tr("Deactivate unit") : tr("Reactivate unit")}
                      </ActionButton>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
