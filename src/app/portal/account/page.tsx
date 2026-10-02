import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/shared/change-password-form";
import { Card, CardContent } from "@/components/ui/card";
import { BackLink } from "@/components/shared/page";
import { getI18n } from "@/lib/i18n/server";
import { requireTenant } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Change password") };
}

export default async function PortalAccount() {
  const { user } = await requireTenant();
  const { t } = await getI18n();
  return (
    <div className="space-y-4">
      <BackLink href="/portal/more">{t("More")}</BackLink>
      <h1 className="text-2xl font-semibold">{t("Change password")}</h1>
      <p className="-mt-2 text-sm text-muted-foreground">{t("Signed in as {email}", { email: user.email })}</p>
      <Card>
        <CardContent className="pt-4">
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
