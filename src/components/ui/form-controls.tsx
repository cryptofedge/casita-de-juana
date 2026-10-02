"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

const control =
  "w-full rounded-lg border border-input bg-card px-3 h-11 sm:h-10 text-foreground placeholder:text-muted-foreground/70 disabled:opacity-60 focus-visible:border-ring";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = "text", placeholder, ...props }, ref) => {
    const { t } = useT();
    return <input ref={ref} type={type} placeholder={placeholder ? t(placeholder) : undefined} className={cn(control, className)} {...props} />;
  },
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, placeholder, ...props }, ref) => {
    const { t } = useT();
    return <textarea ref={ref} placeholder={placeholder ? t(placeholder) : undefined} className={cn(control, "h-auto min-h-24 py-2.5", className)} {...props} />;
  },
);
Textarea.displayName = "Textarea";

/** Native <select>: best UX on phones (OS picker) and fully accessible. */
export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(control, "appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235b6b6f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='m6 9 6 6 6-6'/></svg>\")",
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

/** Label + control + validation message (all text is translated when inside an I18nProvider). */
export function Field({
  label,
  error,
  hint,
  className,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const { t } = useT();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{t(label)}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{t(hint)}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  const { t } = useT();
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-sm text-destructive">
      {t(message)}
    </div>
  );
}
