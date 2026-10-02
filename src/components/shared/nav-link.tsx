"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

export function SideNavLink({
  href,
  exact,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  exact?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  const active = isActive(usePathname(), href, exact);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors [&_svg]:size-[18px]",
        active ? "bg-primary text-primary-foreground" : "text-secondary-foreground hover:bg-secondary",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

export function TabLink({
  href,
  exact,
  icon,
  children,
}: {
  href: string;
  exact?: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const active = isActive(usePathname(), href, exact);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors [&_svg]:size-6",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className={cn("rounded-full px-4 py-0.5", active && "bg-info-soft")}>{icon}</span>
      {children}
    </Link>
  );
}
