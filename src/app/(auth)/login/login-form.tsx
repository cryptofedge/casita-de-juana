"use client";

import { loginAction } from "@/actions/auth";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FormError, Input } from "@/components/ui/form-controls";
import { loginSchema } from "@/lib/validators";
import { useT } from "@/lib/i18n/provider";

export function LoginForm() {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: loginSchema,
    defaultValues: { email: "", password: "" },
    action: loginAction,
    resetOnSuccess: false,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Email" htmlFor="email" error={err("email")}>
        <Input id="email" type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={err("password")}>
        <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
      </Field>
      <SubmitButton pending={pending} className="w-full" size="lg">
        {t("Sign in")}
      </SubmitButton>
    </form>
  );
}
