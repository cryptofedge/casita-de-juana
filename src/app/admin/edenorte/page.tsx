import type { Metadata } from "next";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { addMonths, currentPeriod, fmtDate, fmtPeriod } from "@/lib/dates";
import { moneyFormatter } from "@/lib/money";
import { getI18n } from "@/lib/i18n/server";
import { getMoneyContext, getSettings } from "@/lib/settings";
import { addBuildingBillAction, deleteBillAction, saveOwnerNicAction } from "@/actions/edenorte";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { EdenorteBillForm, NicForm } from "@/components/shared/edenorte-forms";
import { UsageChart } from "@/components/shared/usage-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, FileLink, PageHeader, TableWrap, Td, Th } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Edenorte") };
}
export const dynamic = "force-dynamic";

const PORTAL = "https://ofv.edenorte.com.do";

export default async function EdenortePage() {
  const { t: tr, locale } = await getI18n();
  const { display, rate } = await getMoneyContext();
  const m = moneyFormatter(display, rate);
  const settings = await getSettings();

  const [bills, readings, ownAccounts] = await Promise.all([
    db.utilityBill.findMany({ where: { unitId: null }, orderBy: { period: "desc" }, take: 24, include: { file: true } }),
    db.meterReading.findMany({ select: { period: true, previousKwh: true, currentKwh: true } }),
    db.lease.findMany({
      where: { active: true, edenorteAccess: true, ownEdenorteNic: { not: null } },
      include: { tenant: true, unit: true },
      orderBy: { unit: { label: "asc" } },
    }),
  ]);

  // total kWh the unit sub-meters recorded per month, to compare with the main Edenorte bill
  const sub = new Map<string, number>();
  for (const r of readings) sub.set(r.period, (sub.get(r.period) ?? 0) + (r.currentKwh - r.previousKwh));

  const tenantBills = ownAccounts.length
    ? await db.utilityBill.findMany({
        where: { unitId: { in: ownAccounts.map((l) => l.unitId) } },
        orderBy: { period: "desc" },
        include: { file: true },
      })
    : [];

  const chart = [...bills].reverse().slice(-12).map((b) => ({ label: fmtPeriod(b.period, locale).slice(0, 3), value: b.kwh }));

  return (
    <>
      <PageHeader
        title={tr("Edenorte electricity")}
        description={tr("Track your main Edenorte account and see usage. Edenorte offers no public connection, so you log each bill here.")}
        actions={
          <>
            <Button asChild variant="outline">
              <a href={PORTAL} target="_blank" rel="noopener noreferrer"><ExternalLink /> {tr("Open Edenorte Oficina Virtual")}</a>
            </Button>
            <FormDialog trigger={<Button><Plus /> {tr("Log a bill")}</Button>} title="Log an Edenorte bill" description="Copy the figures from the bill or the Oficina Virtual.">
              <EdenorteBillForm action={addBuildingBillAction} defaultPeriod={addMonths(currentPeriod(), -1)} />
            </FormDialog>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>{tr("Main account usage (kWh)")}</CardTitle></CardHeader>
            <CardContent>
              {chart.length === 0 ? <EmptyState title={tr("No bills logged yet")}>{tr("Log your first Edenorte bill to see the usage chart.")}</EmptyState> : <UsageChart points={chart} label={tr("Monthly kWh on the main Edenorte account")} />}
            </CardContent>
          </Card>

          {bills.length > 0 && (
            <TableWrap>
              <thead>
                <tr>
                  <Th>{tr("Month")}</Th><Th className="text-right">{tr("Main bill (kWh)")}</Th><Th className="text-right">{tr("Unit sub-meters (kWh)")}</Th>
                  <Th className="text-right">{tr("Amount")}</Th><Th>{tr("Due")}</Th><Th>{tr("Bill")}</Th><Th><span className="sr-only">{tr("Actions")}</span></Th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => (
                  <tr key={b.id}>
                    <Td className="whitespace-nowrap font-medium">{fmtPeriod(b.period, locale)}</Td>
                    <Td className="text-right tabular-nums">{b.kwh}</Td>
                    <Td className="text-right tabular-nums">{sub.has(b.period) ? sub.get(b.period)!.toFixed(1) : "-"}</Td>
                    <Td className="text-right font-semibold tabular-nums">{m(b.amount, b.currency)}</Td>
                    <Td className="whitespace-nowrap">{b.dueDate ? fmtDate(b.dueDate, locale) : "-"}</Td>
                    <Td>{b.file ? <FileLink id={b.file.id} name={b.file.filename} mime={b.file.mime} label={tr("View")} /> : "-"}</Td>
                    <Td className="text-right">
                      <ActionButton size="sm" variant="ghost" aria-label={tr("Delete bill")} confirm={tr("Delete this bill?")} action={deleteBillAction.bind(null, b.id)}><Trash2 /></ActionButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>{tr("Your Edenorte account")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <NicForm action={saveOwnerNicAction} current={settings.edenorteNic} />
              <p className="text-xs text-muted-foreground">
                {tr("Tip: your password never goes into this app. Use the button above to sign in to Edenorte yourself, then copy the kWh and total into a new bill.")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{tr("Tenants with their own account")}</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {ownAccounts.length === 0 && <p className="text-muted-foreground">{tr("No tenant has added their own Edenorte account. You choose who may, on each tenant's page.")}</p>}
              {ownAccounts.map((l) => {
                const mine = tenantBills.filter((b) => b.unitId === l.unitId).slice(0, 4);
                return (
                  <div key={l.id} className="rounded-lg border p-3">
                    <div className="font-semibold">{tr("Apt {unit}", { unit: l.unit.label })} · {l.tenant.name}</div>
                    <div className="text-xs text-muted-foreground">NIC {l.ownEdenorteNic}</div>
                    {mine.length === 0 ? (
                      <div className="mt-1 text-xs text-muted-foreground">{tr("No bills logged yet")}</div>
                    ) : (
                      <ul className="mt-2 space-y-0.5 text-xs">
                        {mine.map((b) => (
                          <li key={b.id} className="flex justify-between"><span>{fmtPeriod(b.period, locale)}</span><span className="tabular-nums">{b.kwh} kWh · {m(b.amount, b.currency)}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
