import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Casita de Juana"
      width={size}
      height={size}
      priority
      className={cn("shrink-0 rounded-full", className)}
    />
  );
}

export function BrandMark({ subtitle, className }: { subtitle?: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Logo size={44} />
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold text-primary">Casita de Juana</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}
