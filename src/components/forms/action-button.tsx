"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionResult } from "@/lib/validators";
import { useT } from "@/lib/i18n/provider";

/** One-click server action (delete, toggle...) with optional confirm and inline error. */
export function ActionButton({
  action,
  confirm,
  children,
  onResult,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  action: () => Promise<ActionResult<unknown>>;
  confirm?: string;
  onResult?: (r: ActionResult<unknown>) => void;
}) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setError(null);
          start(async () => {
            const r = await action();
            if (!r.ok) setError(r.error);
            onResult?.(r);
          });
        }}
        {...props}
      >
        {pending && <Loader2 className="animate-spin" />}
        {children}
      </Button>
      {error && (
        <span role="alert" className="ml-2 text-xs font-medium text-destructive">
          {t(error)}
        </span>
      )}
    </>
  );
}
