"use client";

import { useMemo } from "react";
import { addChargeAction, recordPaymentAction } from "@/actions/finance";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { FileField } from "@/components/forms/file-field";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form-controls";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { chargeSchema, paymentSchema } from "@/lib/validators";
import { toDateInput } from "@/lib/dates";
import { useT } from "@/lib/i18n/provider";

export interface LeaseOption {
  id: string;
  unit: string;
  tenant: string;
  currency: "USD" | "DOP";
}

export function PaymentForm({ leases, defaultLeaseId, today }: { leases: LeaseOption[]; defaultLeaseId?: string; today: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err, setFiles, fileKey } = useActionForm({
    schema: paymentSchema,
    defaultValues: {
      leaseId: defaultLeaseId ?? leases[0]?.id ?? "",
      amount: "",
      method: "CASH" as const,
      paidAt: today,
      reference: "",
      note: "",
    },
    action: recordPaymentAction,
  });
  const leaseId = form.watch("leaseId");
  const cur = useMemo(() => leases.find((l) => l.id === leaseId)?.currency ?? "USD", [leases, leaseId]);

  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Unit / tenant" htmlFor="leaseId" error={err("leaseId")}>
        <Select id="leaseId" {...form.register("leaseId")}>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>
              {t("Apt {unit}", { unit: l.unit })} - {l.tenant}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Amount ({cur})", { cur })} htmlFor="amount" error={err("amount")} hint="In the lease currency">
          <Input id="amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
        </Field>
        <Field label="Date received" htmlFor="paidAt" error={err("paidAt")}>
          <Input id="paidAt" type="date" {...form.register("paidAt")} />
        </Field>
      </div>
      <Field label="Method" htmlFor="method" error={err("method")}>
        <Select id="method" {...form.register("method")}>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{t(l)}</option>
          ))}
        </Select>
      </Field>
      <Field label="Reference (optional)" htmlFor="reference" error={err("reference")}>
        <Input id="reference" placeholder="Transfer / PayPal transaction ID" {...form.register("reference")} />
      </Field>
      <Field label="Note (optional)" htmlFor="note" error={err("note")}>
        <Textarea id="note" rows={2} {...form.register("note")} />
      </Field>
      <FileField key={fileKey} label="Receipt photo or PDF (optional)" name="receipt" onFiles={setFiles} error={err("receipt" as never)} />
      <SubmitButton pending={pending} className="w-full">{t("Save payment")}</SubmitButton>
    </form>
  );
}

export function ChargeForm({ leases, today }: { leases: LeaseOption[]; today: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: chargeSchema,
    defaultValues: { leaseId: leases[0]?.id ?? "", description: "", amount: "", dueDate: today },
    action: addChargeAction,
  });
  const cur = leases.find((l) => l.id === form.watch("leaseId"))?.currency ?? "USD";
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Unit / tenant" htmlFor="c-leaseId" error={err("leaseId")}>
        <Select id="c-leaseId" {...form.register("leaseId")}>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>{t("Apt {unit}", { unit: l.unit })} - {l.tenant}</option>
          ))}
        </Select>
      </Field>
      <Field label="Description" htmlFor="description" error={err("description")}>
        <Input id="description" placeholder="e.g. Broken window repair" {...form.register("description")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Amount ({cur})", { cur })} htmlFor="c-amount" error={err("amount")}>
          <Input id="c-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
        </Field>
        <Field label="Due date" htmlFor="dueDate" error={err("dueDate")}>
          <Input id="dueDate" type="date" {...form.register("dueDate")} />
        </Field>
      </div>
      <SubmitButton pending={pending} className="w-full">{t("Add charge")}</SubmitButton>
    </form>
  );
}

export { toDateInput };
