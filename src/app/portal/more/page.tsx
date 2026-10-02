import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight, FolderOpen, LogOut, Megaphone, Phone } from "lucide-react";
import { logoutAction } from "@/actions/auth";
import { requireTenant } from "@/lib/session";
import { getI18n } from "@/lib/i18n/server";

import { Card } from "@/components/ui/card";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("More") };
}

const LINKS = [
  { href: "/portal/notices", label: "Notice board", icon: <Megaphone className="size-5 text-primary" /> },
  { href: "/portal/documents", label: "My documents", icon: <FolderOpen className="size-5 text-primary" /> },
  { href: "/portal/contacts", label: "Emergency contacts", icon: <Phone className="size-5 text-destructive" /> },
];

export default async function More() {
  const { user, lease } = await requireTenant();
  const { t } = await getI18n();
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">{t("More")}</h1>
      <Card className="p-4">
        <div className="font-semibold">{user.name}</div>
        <div className="text-sm text-muted-foreground">{user.email}{lease ? ` · ${t("Apt {unit}", { unit: lease.unit.label })}` : ""}</div>
      </Card>
      <Card className="divide-y">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-4 active:bg-secondary">
            {l.icon}<span className="flex-1 font-medium">{t(l.label)}</span><ChevronRight className="size-5 text-muted-foreground" />
          </Link>
        ))}
      </Card>
      <form action={logoutAction}>
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border bg-card py-3.5 font-semibold text-muted-foreground active:bg-secondary">
          <LogOut className="size-5" /> {t("Sign out")}
        </button>
      </form>
    </div>
  );
}
