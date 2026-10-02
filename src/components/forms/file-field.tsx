"use client";

import { Camera } from "lucide-react";
import { Field } from "@/components/ui/form-controls";
import { useT } from "@/lib/i18n/provider";

/** File / camera input. On phones `capture` lets tenants snap a photo directly. */
export function FileField({
  label,
  name,
  onFiles,
  multiple,
  accept = "image/*,application/pdf",
  hint,
  error,
  capture,
}: {
  label: string;
  name: string;
  onFiles: (name: string, files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  hint?: string;
  error?: string;
  capture?: boolean;
}) {
  const { t } = useT();
  const placeholder = t(multiple ? "Choose files…" : "Choose a file…");
  return (
    <Field label={label} hint={hint ?? "JPG, PNG, WebP, HEIC or PDF · max 10 MB"} error={error} htmlFor={name}>
      <label
        htmlFor={name}
        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-input bg-secondary/40 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary"
      >
        <Camera className="size-4 shrink-0" />
        <span className="truncate" id={`${name}-label`}>
          {placeholder}
        </span>
        <input
          id={name}
          type="file"
          className="sr-only"
          accept={accept}
          multiple={multiple}
          {...(capture ? { capture: "environment" as const } : {})}
          onChange={(e) => {
            const list = Array.from(e.target.files ?? []);
            onFiles(name, list);
            const lbl = document.getElementById(`${name}-label`);
            if (lbl) lbl.textContent = list.length ? list.map((f) => f.name).join(", ") : placeholder;
          }}
        />
      </label>
    </Field>
  );
}
