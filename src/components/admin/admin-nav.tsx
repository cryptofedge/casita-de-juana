"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  FolderOpen,
  LayoutDashboard,
  Megaphone,
  Menu,
  Phone,
  Settings,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
  LogOut,
} from "lucide-react";
import { SideNavLink } from "@/components/shared/nav-link";
import { BrandMark } from "@/components/shared/brand";
import { logoutAction } from "@/actions/auth";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: <LayoutDashboard />, exact: true },
  { href: "/admin/finance", label: "Rent & Payments", icon: <Wallet /> },
  { href: "/admin/utilities", label: "Electricity", icon: <Zap /> },
  { href: "/admin/maintenance", label: "Maintenance", icon: <Wrench /> },
  { href: "/admin/tenants", label: "Tenants & Units", icon: <Users /> },
  { href: "/admin/announcements", label: "Notice Board", icon: <Megaphone /> },
  { href: "/admin/documents", label: "Document Vault", icon: <FolderOpen /> },
  { href: "/admin/contacts", label: "Emergency Contacts", icon: <Phone /> },
  { href: "/admin/settings", label: "Settings", icon: <Settings /> },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {ITEMS.map((i) => (
        <SideNavLink key={i.href} href={i.href} exact={i.exact} icon={i.icon} onNavigate={onNavigate}>
          {i.label}
        </SideNavLink>
      ))}
    </nav>
  );
}

function SignOut() {
  return (
    <form action={logoutAction}>
      <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary">
        <LogOut className="size-[18px]" /> Sign out
      </button>
    </form>
  );
}

export function AdminSidebar() {
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 border-r bg-card p-4 lg:flex">
      <BrandMark subtitle="Owner back-office" className="px-1 pb-2" />
      <div className="flex-1 overflow-y-auto">
        <NavList />
      </div>
      <SignOut />
    </aside>
  );
}

export function AdminMobileMenu() {
  const [open, setOpen] = useState(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        className="rounded-lg p-2 hover:bg-secondary lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-6" />
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#10242b]/50" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 bg-card p-4 shadow-xl outline-none">
          <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Site navigation</DialogPrimitive.Description>
          <div className="flex items-center justify-between">
            <BrandMark subtitle="Owner back-office" />
            <DialogPrimitive.Close className="rounded-md p-1.5 hover:bg-secondary" aria-label="Close menu">
              <X className="size-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto">
            <NavList onNavigate={() => setOpen(false)} />
          </div>
          <SignOut />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
