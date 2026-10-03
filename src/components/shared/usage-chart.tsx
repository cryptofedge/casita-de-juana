import { cn } from "@/lib/utils";

/** Simple accessible bar chart of monthly kWh. */
export function UsageChart({
  points,
  label,
  className,
}: {
  points: { label: string; value: number }[];
  label: string;
  className?: string;
}) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.value));
  return (
    <div className={cn("flex h-40 items-end gap-1.5", className)} role="img" aria-label={label}>
      {points.map((p) => (
        <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="text-[10px] font-medium text-muted-foreground">{Math.round(p.value)}</div>
          <div className="w-full rounded-t-md bg-gold/90" style={{ height: `${Math.max(2, (p.value / max) * 100)}px` }} />
          <div className="w-full truncate text-center text-[11px] text-muted-foreground">{p.label}</div>
        </div>
      ))}
    </div>
  );
}
