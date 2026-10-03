"use client";

import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { FileField } from "@/components/forms/file-field";
import { Field, FormError, Input } from "@/components/ui/form-controls";
import { useT } from "@/lib/i18n/provider";
import { edenorteBillSchema, nicSchema, type ActionResult } from "@/lib/validators";

type Act = (fd: FormData) => Promise<ActionResult<unknown>>;

export function EdenorteBillForm({ action, defaultPeriod }: { action: Act; defaultPeriod: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err, setFiles, fileKey } = useActionForm({
    schema: edenorteBillSchema,
    defaultValues: { period: defaultPeriod, kwh: "", amount: "", dueDate: "" },
    action,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bill month" htmlFor="eb-period" error={err("period")}>
          <Input id="eb-period" type="month" {...form.register("period")} />
        </Field>
        <Field label="Due date (optional)" htmlFor="eb-due" error={err("dueDate")}>
          <Input id="eb-due" type="date" {...form.register("dueDate")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Energy used (kWh)" htmlFor="eb-kwh" error={err("kwh")}>
          <Input id="eb-kwh" inputMode="decimal" {...form.register("kwh")} />
        </Field>
        <Field label="Total on the bill (DOP)" htmlFor="eb-amount" error={err("amount")}>
          <Input id="eb-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
        </Field>
      </div>
      <FileField key={fileKey} label="Photo or PDF of the bill (optional)" name="bill" onFiles={setFiles} error={err("bill" as never)} />
      <SubmitButton pending={pending} className="w-full">{t("Save bill")}</SubmitButton>
    </form>
  );
}

export function NicForm({ action, current }: { action: Act; current: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: nicSchema,
    defaultValues: { nic: current },
    action,
    resetOnSuccess: false,
  });
  return (
    <form method="post" onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end" noValidate>
      <div className="flex-1">
        <FormError message={serverError} />
        <Field label="Edenorte contract number (NIC)" htmlFor="nic" error={err("nic")} hint="Printed on your Edenorte bill.">
          <Input id="nic" inputMode="numeric" autoComplete="off" {...form.register("nic")} />
        </Field>
      </div>
      <SubmitButton pending={pending} variant="outline">{t("Save")}</SubmitButton>
    </form>
  );
}
