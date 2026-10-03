import { getI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/content-forms";
import { fmtDate } from "@/lib/dates";
import { refreshRateNowAction } from "@/actions/content";
import { ActionButton } from "@/components/forms/action-button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Settings") };
}
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { t: tr, locale } = await getI18n();
  const s = await getSettings();
  return (
    <>
      <PageHeader title={tr("Settings")} />
      <Card className="max-w-xl">
        <CardContent className="pt-4 sm:pt-5">
          <SettingsForm
            rateNote={s.rateUpdatedAt ? tr("Last updated {date}", { date: fmtDate(new Date(s.rateUpdatedAt), locale) }) : tr("Not updated yet. The first update runs tonight, or press the button below.")}
            defaults={{
              usdDopRate: String(s.usdDopRate),
              rateAuto: s.rateAuto === "on",
              propertyName: s.propertyName,
              propertyAddress: s.propertyAddress,
              ownerPhone: s.ownerPhone,
            }}
          />
        </CardContent>
      </Card>

      <Card className="mt-4 max-w-xl">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4 text-sm sm:pt-5">
          <p className="max-w-sm text-muted-foreground">{tr("Fetch today's USD to DOP market rate now (free service, no account needed).")}</p>
          <ActionButton variant="outline" action={refreshRateNowAction}>{tr("Update rate now")}</ActionButton>
        </CardContent>
      </Card>
    </>
  );
}
