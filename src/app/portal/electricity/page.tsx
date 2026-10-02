import Image from "next/image";
import type { Metadata } from "next";
import { Zap } from "lucide-react";
import { db } from "@/lib/db";
import { fmtDate, fmtPeriod } from "@/lib/dates";
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
    </div>
  );
}
