"use client";

import { useState, useTransition } from "react";
import { useForm, type DefaultValues, type FieldValues, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import type { ActionResult } from "@/lib/validators";
import { useDialogClose } from "@/components/forms/form-dialog";

type FileMap = Record<string, File[]>;

/**
 * react-hook-form + zod on the client, a server action on submit.
 * Values are sent as FormData so file inputs (receipts, photos) work too.
 */
export function useActionForm<T extends FieldValues>(opts: {
  schema: z.ZodType<T>;
  defaultValues: DefaultValues<T>;
  action: (fd: FormData) => Promise<ActionResult<unknown>>;
  onSuccess?: (res: Extract<ActionResult<unknown>, { ok: true }>) => void;
  resetOnSuccess?: boolean;
  closeOnSuccess?: boolean;
}) {
  const closeDialog = useDialogClose();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<T>({ resolver: zodResolver(opts.schema as any) as any, defaultValues: opts.defaultValues });
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [files, setFilesState] = useState<FileMap>({}); // selected File objects per input name
  const [fileKey, setFileKey] = useState(0);

  const setFiles = (name: string, list: File[]) => {
    setFilesState((prev) => ({ ...prev, [name]: list }));
  };

  const submit = form.handleSubmit((values) => {
    setServerError(null);
    start(async () => {
      const fd = new FormData();
      for (const [k, v] of Object.entries(values)) fd.append(k, v == null ? "" : String(v));
      for (const [k, list] of Object.entries(files)) list.forEach((f) => fd.append(k, f));

      const res = await opts.action(fd);
      if (!res.ok) {
        setServerError(res.error);
        for (const [field, msgs] of Object.entries(res.fieldErrors ?? {})) {
          if (msgs?.[0]) form.setError(field as Path<T>, { message: msgs[0] });
        }
        return;
      }
      if (opts.resetOnSuccess !== false) {
        form.reset(opts.defaultValues);
        setFilesState({});
        setFileKey((k) => k + 1); // remounts file inputs so they clear
      }
      opts.onSuccess?.(res);
      if (opts.closeOnSuccess !== false) closeDialog();
    });
  });

  const err = (name: Path<T>) => {
    const e = form.formState.errors[name];
    return e?.message ? String(e.message) : undefined;
  };

  return { form, submit, pending, serverError, setFiles, fileKey, err };
}
