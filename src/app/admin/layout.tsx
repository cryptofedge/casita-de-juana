import { AdminMobileMenu, AdminSidebar } from "@/components/admin/admin-nav";
import { CurrencyToggle } from "@/components/shared/currency-toggle";
import { Logo } from "@/components/shared/brand";
import { requireOwner } from "@/lib/session";
import { getDisplayCurrency } from "@/lib/settings";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireOwner();
  const currency = await getDisplayCurrency();
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b bg-background/90 px-4 py-2.5 backdrop-blur">
          <AdminMobileMenu />
          <Logo size={32} className="lg:hidden" />
          <div className="ml-auto flex items-center gap-3">
            <CurrencyToggle value={currency} />
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.name}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
