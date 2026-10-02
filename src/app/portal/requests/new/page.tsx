import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";

import { BackLink } from "@/components/shared/page";
import { NewTicketForm } from "@/components/shared/ticket-parts";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("New request") };
}

export default async function NewRequest() {
  const { lease } = await requireTenant();
  const { t } = await getI18n();
  if (!lease) redirect("/portal/requests");
  return (
    <div>
      <BackLink href="/portal/requests">{t("My requests")}</BackLink>
      <h1 className="mb-4 text-2xl font-semibold">{t("New request")}</h1>
      <NewTicketForm />
    </div>
  );
}
