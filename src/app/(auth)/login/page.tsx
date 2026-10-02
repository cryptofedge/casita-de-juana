import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";
import { needsSetup } from "@/lib/setup";
import { LoginForm } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Sign in") };
}

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Already signed in (and the account still exists/is active)? Go home. A stale cookie just shows the form.
  const current = await getSessionUser();
  if (current) redirect(current.role === "OWNER" ? "/admin" : "/portal");
  const { t } = await getI18n();
  const unclaimed = await needsSetup();
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">{t("Sign in")}</h2>
      <LoginForm />
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {t("New tenant? Use the invitation link the owner sent you. Forgot your password? Ask the owner for a new link.")}
      </p>
      {unclaimed && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-center text-sm">
          <Link href="/setup" className="font-semibold text-primary hover:underline">
            {t("First time here? Set up the owner account")}
          </Link>
        </p>
      )}
    </div>
  );
}
