"use client";

import { acceptInviteAction } from "@/actions/auth";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FormError, Input } from "@/components/ui/form-controls";
import { acceptInviteSchema } from "@/lib/validators";
import { useT } from "@/lib/i18n/provider";

export function InviteForm({ token }: { token: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: acceptInviteSchema,
    defaultValues: { password: "", confirm: "" },
    action: (fd) => acceptInviteAction(token, fd),
    resetOnSuccess: false,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Password" htmlFor="password" error={err("password")} hint="At least 8 characters">
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={err("confirm")}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <SubmitButton pending={pending} className="w-full" size="lg">
        {t("Save password & continue")}
      </SubmitButton>
    </form>
  );
}
