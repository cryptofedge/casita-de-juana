"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ActionResult } from "@/lib/validators";
import { useT } from "@/lib/i18n/provider";

/**
 * One-click server action (delete, toggle...) with an optional in-page confirmation and inline error.
 * (An in-page dialog instead of window.confirm: works well on phones and is testable.)
 */
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
  const [asking, setAsking] = useState(false);

  const run = () => {
    setError(null);
    start(async () => {
      const r = await action();
      if (!r.ok) setError(r.error);
      onResult?.(r);
    });
  };

  return (
    <>
      <Button type="button" disabled={pending} onClick={() => (confirm ? setAsking(true) : run())} {...props}>
        {pending && <Loader2 className="animate-spin" />}
        {children}
      </Button>
      {error && (
        <span role="alert" className="ml-2 text-xs font-medium text-destructive">
          {t(error)}
        </span>
      )}
      {confirm && (
        <Dialog open={asking} onOpenChange={setAsking}>
          <DialogContent title={confirm}>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAsking(false)}>
                {t("Cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  setAsking(false);
                  run();
                }}
              >
                {t("Confirm")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
