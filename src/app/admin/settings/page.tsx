import { getI18n } from "@/lib/i18n/server";
import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/content-forms";
import { mailConfigured, ownerRecipients } from "@/lib/mail";
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
  const mailOn = mailConfigured();
  const recipients = await ownerRecipients();
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

      <Card className="mt-4 max-w-xl">
        <CardContent className="space-y-1 pt-4 text-sm sm:pt-5">
          <h2 className="text-lg font-semibold">{tr("Email alerts")}</h2>
          <p className={mailOn ? "font-medium text-success" : "font-medium text-accent"}>
            {mailOn ? tr("On: you get an email whenever a tenant posts something.") : tr("Off: ask whoever set up the site to add RESEND_API_KEY.")}
          </p>
          {mailOn && <p className="text-muted-foreground">{tr("Sent to: {emails}", { emails: recipients.join(", ") || "-" })}</p>}
        </CardContent>
      </Card>
    </>
  );
}
