"use client";

import { Camera } from "lucide-react";
import { Field } from "@/components/ui/form-controls";
import { useT } from "@/lib/i18n/provider";

/**
 * Shrinks big phone photos in the browser (max 1800px, JPEG) so uploads stay small and fast
 * on mobile data and under the host's request-size limit. Anything it cannot decode
 * (HEIC on most desktops, PDFs) is passed through unchanged.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 700 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close();
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

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
    <Field label={label} hint={hint ?? "JPG, PNG, WebP, HEIC or PDF · max 4 MB"} error={error} htmlFor={name}>
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
          onChange={async (e) => {
            const list = await Promise.all(Array.from(e.target.files ?? []).map(shrinkImage));
            onFiles(name, list);
            const lbl = document.getElementById(`${name}-label`);
            if (lbl) lbl.textContent = list.length ? list.map((f) => f.name).join(", ") : placeholder;
          }}
        />
      </label>
    </Field>
  );
}
