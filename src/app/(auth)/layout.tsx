import Image from "next/image";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { I18nProvider } from "@/lib/i18n/provider";
import { getI18n } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const { locale, t } = await getI18n();
  return (
    <I18nProvider locale={locale}>
      <main className="flex min-h-dvh flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#e3f1f3,transparent_60%)] px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-3 flex justify-end">
            <LanguageToggle value={locale} />
          </div>
          <div className="mb-6 flex flex-col items-center text-center">
            <Image src="/brand/logo.png" alt="Casita de Juana, Ortega, Dominican Republic" width={152} height={152} priority className="rounded-full shadow-md" />
            <h1 className="mt-4 text-3xl font-semibold text-primary">Casita de Juana</h1>
            <p className="text-sm text-muted-foreground">{t("Tenant portal & property office")}</p>
          </div>
          {children}
        </div>
      </main>
    </I18nProvider>
  );
}
