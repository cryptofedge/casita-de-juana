"use client";

import { useTransition } from "react";
import { setCurrencyAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/lib/money";

/** USD / DOP display switch. Amounts are converted using the owner-set exchange rate. */
export function CurrencyToggle({ value }: { value: CurrencyCode }) {
  const [pending, start] = useTransition();
  return (
    <div
      role="group"
      aria-label="Display currency"
      className={cn("inline-flex rounded-full border bg-card p-0.5 text-xs font-semibold", pending && "opacity-60")}
    >
      {(["USD", "DOP"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          onClick={() => value !== c && start(() => setCurrencyAction(c))}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors",
            value === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
