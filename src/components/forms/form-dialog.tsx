"use client";

import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

const CloseCtx = createContext<() => void>(() => {});
export const useDialogClose = () => useContext(CloseCtx);

/** Wraps a (client) form in a modal. The form closes it via useActionForm's onSuccess. */
export function FormDialog({
  trigger,
  title,
  description,
  refreshOnClose,
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  /** Re-fetch server data when the dialog closes (for flows that must not re-render while open). */
  refreshOnClose?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const change = (next: boolean) => {
    setOpen(next);
    if (!next && refreshOnClose) router.refresh();
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={title} description={description}>
        <CloseCtx.Provider value={() => change(false)}>{children}</CloseCtx.Provider>
      </DialogContent>
    </Dialog>
  );
}
