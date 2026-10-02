import { getI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/content-forms";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Settings") };
}
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { t: tr } = await getI18n();
  const s = await getSettings();
  return (
    <>
      <PageHeader title={tr("Settings")} />
      <Card className="max-w-xl">
        <CardContent className="pt-4 sm:pt-5">
          <SettingsForm
            defaults={{
              usdDopRate: String(s.usdDopRate),
              propertyName: s.propertyName,
              propertyAddress: s.propertyAddress,
              ownerPhone: s.ownerPhone,
            }}
          />
        </CardContent>
      </Card>
    </>
  );
}
