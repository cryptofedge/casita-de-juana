"use client";

import { useState } from "react";
import { changePasswordAction } from "@/actions/account";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FormError, Input } from "@/components/ui/form-controls";
import { useT } from "@/lib/i18n/provider";
import { changePasswordSchema } from "@/lib/validators";

export function ChangePasswordForm() {
  const { t } = useT();
  const [done, setDone] = useState(false);
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: changePasswordSchema,
    defaultValues: { current: "", password: "", confirm: "" },
    action: changePasswordAction,
    onSuccess: () => setDone(true),
  });
  return (
    <form
      method="post"
      onSubmit={(e) => {
        setDone(false);
        return submit(e);
      }}
      className="space-y-4"
      noValidate
    >
      <FormError message={serverError} />
      {done && (
        <div role="status" className="rounded-lg border border-success/30 bg-success-soft px-3 py-2 text-sm font-medium text-success">
          {t("Password updated ✓")}
        </div>
      )}
      <Field label="Current password" htmlFor="current" error={err("current")}>
        <Input id="current" type="password" autoComplete="current-password" {...form.register("current")} />
      </Field>
      <Field label="New password" htmlFor="password" error={err("password")} hint="Use a long password you do not use anywhere else.">
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" error={err("confirm")}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <SubmitButton pending={pending} className="w-full sm:w-auto">
        {t("Update password")}
      </SubmitButton>
    </form>
  );
}
