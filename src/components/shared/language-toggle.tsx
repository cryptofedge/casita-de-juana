"use client";

import { useTransition } from "react";
import { setLanguageAction } from "@/actions/auth";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

/** ES / EN switch (stored in a cookie). */
export function LanguageToggle({ value }: { value: Locale }) {
  const [pending, start] = useTransition();
  return (
    <div
      role="group"
      aria-label="Language / Idioma"
      className={cn("inline-flex rounded-full border bg-card p-0.5 text-xs font-semibold", pending && "opacity-60")}
    >
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={value === l}
          onClick={() => value !== l && start(() => setLanguageAction(l))}
          className={cn(
            "rounded-full px-3 py-1.5 transition-colors",
            value === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
