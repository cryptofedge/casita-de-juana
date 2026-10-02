"use client";

import { completeSetupAction } from "@/actions/setup";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FormError, Input } from "@/components/ui/form-controls";
import { useT } from "@/lib/i18n/provider";
import { setupSchema } from "@/lib/validators";

export function SetupForm() {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: setupSchema,
    defaultValues: { code: "", name: "", email: "", password: "", confirm: "" },
    action: completeSetupAction,
    resetOnSuccess: false,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Setup code" htmlFor="code" error={err("code")}>
        <Input id="code" type="password" autoComplete="off" {...form.register("code")} />
      </Field>
      <Field label="Your name" htmlFor="name" error={err("name")}>
        <Input id="name" autoComplete="name" {...form.register("name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={err("email")}>
        <Input id="email" type="email" inputMode="email" autoComplete="email" {...form.register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={err("password")} hint="At least 10 characters">
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={err("confirm")}>
        <Input id="confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
      </Field>
      <SubmitButton pending={pending} className="w-full" size="lg">
        {t("Create owner account")}
      </SubmitButton>
    </form>
  );
}
