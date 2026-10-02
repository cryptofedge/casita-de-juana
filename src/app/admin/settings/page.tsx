import type { Metadata } from "next";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/content-forms";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();
  return (
    <>
      <PageHeader title="Settings" />
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
