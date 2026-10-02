import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getI18n } from "@/lib/i18n/server";
import { InviteForm } from "./invite-form";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Set your password") };
}

export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { t } = await getI18n();
  const user = await db.user.findUnique({ where: { inviteToken: token }, include: { leases: { where: { active: true }, include: { unit: true } } } });
  const valid = user && user.active && user.inviteExpires && user.inviteExpires > new Date();

  if (!valid) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center shadow-sm">
        <h2 className="text-xl font-semibold">{t("Link expired")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("This invitation link is invalid or has expired. Please ask the owner to send you a new one.")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <h2 className="text-xl font-semibold">{t("Welcome, {name}!", { name: user.name.split(" ")[0] })}</h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        {user.leases[0] ? t("Create a password to access your portal for Apt {unit}.", { unit: user.leases[0].unit.label }) : t("Create a password to continue.")}
      </p>
      <InviteForm token={token} />
    </div>
  );
}
