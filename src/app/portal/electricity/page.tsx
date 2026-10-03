import Image from "next/image";
import type { Metadata } from "next";
import { ExternalLink, Plus, Trash2, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { addMonths, currentPeriod, fmtDate, fmtPeriod } from "@/lib/dates";
import { getSessionUser } from "@/lib/session";
import { addTenantBillAction, deleteBillAction, saveTenantNicAction } from "@/actions/edenorte";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { EdenorteBillForm, NicForm } from "@/components/shared/edenorte-forms";
import { UsageChart } from "@/components/shared/usage-chart";
import { Button } from "@/components/ui/button";
import { getI18n } from "@/lib/i18n/server";

import { moneyFormatter } from "@/lib/money";
import { requireTenant } from "@/lib/session";
import { getMoneyContext } from "@/lib/settings";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Electricity") };
}
export const dynamic = "force-dynamic";

export default async function PortalElectricity() {
  const { lease } = await requireTenant();
  const { t, locale } = await getI18n();
  if (!lease) return <EmptyState title={t("No active lease")} />;
  const { display, rate } = await getMoneyContext(lease.currency);
  const m = moneyFormatter(display, rate);

  // Scoped by the tenant's own unit
  const readings = await db.meterReading.findMany({
    where: { unitId: lease.unitId },
    orderBy: { period: "desc" },
    include: { photo: true },
  });
  const latest = readings[0];
  const user = await getSessionUser();
  const ownBills = user
    ? await db.utilityBill.findMany({ where: { unitId: lease.unitId, createdBy: user.id }, orderBy: { period: "desc" }, take: 24 })
    : [];
  const usage = [...readings].reverse().slice(-12).map((r) => ({ label: fmtPeriod(r.period, locale).slice(0, 3), value: r.currentKwh - r.previousKwh }));
  const ownUsage = [...ownBills].reverse().slice(-12).map((b) => ({ label: fmtPeriod(b.period, locale).slice(0, 3), value: b.kwh }));

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("Electricity")}</h1>
      <p className="-mt-3 text-sm text-muted-foreground">{t("Your private sub-meter for Apt {unit}.", { unit: lease.unit.label })}</p>

      {!latest ? (
        <EmptyState title={t("No readings yet")}>{t("Your first electricity bill will show up here.")}</EmptyState>
      ) : (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Zap className="size-4 text-gold" /> {t("Latest bill · {period}", { period: fmtPeriod(latest.period, locale) })}</div>
          <div className="font-display text-4xl font-semibold">{m(latest.subtotal, latest.currency)}</div>
          <div className="mt-1 text-sm text-muted-foreground">{(latest.currentKwh - latest.previousKwh).toFixed(1)} kWh × {latest.ratePerKwh} {latest.currency}/kWh · {t("due {date}", { date: fmtDate(latest.dueDate, locale) })}</div>
        </Card>
      )}

      {usage.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-3 text-lg font-semibold">{t("Your usage (kWh per month)")}</h2>
          <UsageChart points={usage} label={t("Monthly kWh used in your unit")} />
        </Card>
      )}

      {readings.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{t("History")}</h2>
          <div className="space-y-2">
            {readings.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{fmtPeriod(r.period, locale)}</div>
                    <div className="text-xs text-muted-foreground">{t("Meter read {date}", { date: fmtDate(r.readingDate, locale) })}</div>
                  </div>
                  <div className="font-semibold tabular-nums">{m(r.subtotal, r.currency)}</div>
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">{t("Previous")}</dt><dd className="font-semibold tabular-nums">{r.previousKwh}</dd></div>
                  <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">{t("Current")}</dt><dd className="font-semibold tabular-nums">{r.currentKwh}</dd></div>
                  <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">{t("Used")}</dt><dd className="font-semibold tabular-nums">{(r.currentKwh - r.previousKwh).toFixed(1)}</dd></div>
                  <div className="rounded-lg bg-muted p-2"><dt className="text-muted-foreground">{t("Rate")}</dt><dd className="font-semibold tabular-nums">{r.ratePerKwh}</dd></div>
                </dl>
                {r.photo && r.photo.mime.startsWith("image/") && r.photo.mime !== "image/heic" && (
                  <a href={`/api/files/${r.photo.id}`} target="_blank" rel="noopener noreferrer" className="mt-3 block">
                    <Image src={`/api/files/${r.photo.id}`} alt={t("Meter photo for {period}", { period: fmtPeriod(r.period, locale) })} width={640} height={360} unoptimized className="h-36 w-full rounded-lg border object-cover" />
                    <span className="text-xs text-muted-foreground">{t("Meter photo · tap to enlarge")}</span>
                  </a>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3 border-t pt-5">
        <h2 className="text-lg font-semibold">{t("Do you have your own Edenorte account?")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("Save your contract number (NIC) and log your own Edenorte bills here to track your usage. Your Edenorte password is never needed.")}
        </p>
        <Card className="p-4">
          <NicForm action={saveTenantNicAction} current={lease.ownEdenorteNic ?? ""} />
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href="https://ofv.edenorte.com.do" target="_blank" rel="noopener noreferrer"><ExternalLink /> {t("Open Edenorte Oficina Virtual")}</a>
          </Button>
        </Card>
        {lease.ownEdenorteNic && (
          <>
            <FormDialog trigger={<Button className="w-full"><Plus /> {t("Log my Edenorte bill")}</Button>} title="Log an Edenorte bill" description="Copy the figures from the bill or the Oficina Virtual.">
              <EdenorteBillForm action={addTenantBillAction} defaultPeriod={addMonths(currentPeriod(), -1)} />
            </FormDialog>
            {ownUsage.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-3 font-semibold">{t("My Edenorte account (kWh per month)")}</h3>
                <UsageChart points={ownUsage} label={t("Monthly kWh on your own Edenorte account")} />
              </Card>
            )}
            {ownBills.map((b) => (
              <Card key={b.id} className="flex items-center justify-between gap-3 p-4">
                <div>
                  <div className="font-semibold">{fmtPeriod(b.period, locale)}</div>
                  <div className="text-sm text-muted-foreground">{b.kwh} kWh · {m(b.amount, b.currency)}</div>
                </div>
                <ActionButton size="sm" variant="ghost" aria-label={t("Delete bill")} confirm={t("Delete this bill?")} action={deleteBillAction.bind(null, b.id)}><Trash2 /></ActionButton>
              </Card>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
