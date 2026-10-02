import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { needsSetup } from "@/lib/setup";
import { SetupForm } from "./setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Set up your account") };
}

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  // Once a real owner exists this page disappears for good.
  if (!(await needsSetup())) redirect("/login");
  const { t } = await getI18n();
  const enabled = !!process.env.SETUP_CODE?.trim();

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{t("Set up your account")}</h2>
      {enabled ? (
        <>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">
            {t("Welcome! Create the owner login for Casita de Juana. You will need the setup code you were given.")}
          </p>
          <SetupForm />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          {t("Setup is turned off. Ask the person who set up the site to add a SETUP_CODE.")}
        </p>
      )}
    </div>
  );
}
