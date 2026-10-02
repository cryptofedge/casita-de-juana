import type { Metadata } from "next";
import { getI18n } from "@/lib/i18n/server";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sign in") };
}

export default async function LoginPage() {
  const { t } = await getI18n();
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">{t("Sign in")}</h2>
      <LoginForm />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("New tenant? Use the invitation link the owner sent you. Forgot your password? Ask the owner for a new link.")}
      </p>
    </div>
  );
}
