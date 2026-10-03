"use client";

import { submitPaymentProofAction } from "@/actions/submissions";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { FileField } from "@/components/forms/file-field";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form-controls";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { useT } from "@/lib/i18n/provider";
import { submissionSchema } from "@/lib/validators";

export function SubmitProofForm({ currency, today }: { currency: "USD" | "DOP"; today: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err, setFiles, fileKey } = useActionForm({
    schema: submissionSchema,
    defaultValues: { amount: "", method: "ZELLE" as const, paidAt: today, reference: "", note: "" },
    action: submitPaymentProofAction,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Amount you paid ({cur})", { cur: currency })} htmlFor="sp-amount" error={err("amount")}>
          <Input id="sp-amount" inputMode="decimal" placeholder="0.00" {...form.register("amount")} />
        </Field>
        <Field label="Date you paid" htmlFor="sp-date" error={err("paidAt")}>
          <Input id="sp-date" type="date" {...form.register("paidAt")} />
        </Field>
      </div>
      <Field label="How did you pay?" htmlFor="sp-method" error={err("method")}>
        <Select id="sp-method" {...form.register("method")}>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{t(l)}</option>
          ))}
        </Select>
      </Field>
      <FileField key={fileKey} label="Screenshot or receipt" name="receipt" onFiles={setFiles} capture error={err("receipt" as never)} />
      <Field label="Reference (optional)" htmlFor="sp-ref" error={err("reference")}>
        <Input id="sp-ref" placeholder="Confirmation number" {...form.register("reference")} />
      </Field>
      <Field label="Note (optional)" htmlFor="sp-note" error={err("note")}>
        <Textarea id="sp-note" rows={2} {...form.register("note")} />
      </Field>
      <SubmitButton pending={pending} size="lg" className="w-full">{t("Send for review")}</SubmitButton>
    </form>
  );
}
