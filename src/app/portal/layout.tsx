import { Home, MoreHorizontal, Receipt, Wrench, Zap } from "lucide-react";
import { BrandMark } from "@/components/shared/brand";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { TabLink } from "@/components/shared/nav-link";
import { I18nProvider } from "@/lib/i18n/provider";
import { getI18n } from "@/lib/i18n/server";
import { requireTenant } from "@/lib/session";
import { getDisplayCurrency } from "@/lib/settings";

export default async function PortalLayout({ children }: LayoutProps<"/portal">) {
  const { user, lease } = await requireTenant();
  const currency = await getDisplayCurrency(lease?.currency ?? "USD");
  const { locale, t } = await getI18n();
  return (
    <I18nProvider locale={locale}>
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur">
          <BrandMark subtitle={lease ? `${t("Apt {unit}", { unit: lease.unit.label })} · ${user.name.split(" ")[0]}` : user.name} />
          <div className="flex flex-col items-end gap-1">
            <CurrencyToggle value={currency} />
            <LanguageToggle value={locale} />
          </div>
        </header>
        <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
        <nav
          aria-label={t("Main")}
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-2xl border-t bg-card/95 backdrop-blur"
        >
          <TabLink href="/portal" exact icon={<Home />}>{t("Home")}</TabLink>
          <TabLink href="/portal/payments" icon={<Receipt />}>{t("Rent")}</TabLink>
          <TabLink href="/portal/electricity" icon={<Zap />}>{t("Power")}</TabLink>
          <TabLink href="/portal/requests" icon={<Wrench />}>{t("Requests")}</TabLink>
          <TabLink href="/portal/more" icon={<MoreHorizontal />}>{t("More")}</TabLink>
        </nav>
      </div>
    </I18nProvider>
  );
}
