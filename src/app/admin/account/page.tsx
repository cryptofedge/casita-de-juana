import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page";
import { InstallApp } from "@/components/shared/install-app";
import { getI18n } from "@/lib/i18n/server";
import { requireOwner } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Account") };
}

export default async function AdminAccount() {
  const user = await requireOwner();
  const { t } = await getI18n();
  return (
    <>
      <PageHeader title={t("Account")} description={t("Signed in as {email}", { email: user.email })} />
      <div className="max-w-xl space-y-4">
        <InstallApp />
        <Card>
          <CardContent className="pt-4 sm:pt-5">
            <h2 className="mb-3 text-lg font-semibold">{t("Change password")}</h2>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
