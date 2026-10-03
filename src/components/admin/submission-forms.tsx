"use client";

import { approveSubmissionAction, rejectSubmissionAction } from "@/actions/submissions";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form-controls";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { useT } from "@/lib/i18n/provider";
import { approveSubmissionSchema, rejectSubmissionSchema } from "@/lib/validators";

export function ApproveSubmissionForm({
  submission,
  charges,
  currency,
  defaultChargeId = "",
}: {
  submission: { id: string; amount: string; method: "CASH" | "BANK_TRANSFER" | "ZELLE" | "PAYPAL" | "STRIPE"; paidAt: string };
  charges: { id: string; label: string }[];
  currency: "USD" | "DOP";
  defaultChargeId?: string;
}) {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: approveSubmissionSchema,
    defaultValues: { submissionId: submission.id, amount: submission.amount, method: submission.method, paidAt: submission.paidAt, chargeId: defaultChargeId },
    action: approveSubmissionAction,
    resetOnSuccess: false,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <input type="hidden" {...form.register("submissionId")} />
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("Amount ({cur})", { cur: currency })} htmlFor="ap-amount" error={err("amount")} hint="Correct it if the tenant typed it wrong.">
          <Input id="ap-amount" inputMode="decimal" {...form.register("amount")} />
        </Field>
        <Field label="Date received" htmlFor="ap-date" error={err("paidAt")}>
          <Input id="ap-date" type="date" {...form.register("paidAt")} />
        </Field>
      </div>
      <Field label="Method" htmlFor="ap-method" error={err("method")}>
        <Select id="ap-method" {...form.register("method")}>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{t(l)}</option>
          ))}
        </Select>
      </Field>
      {charges.length > 0 && (
        <Field label="Apply to" htmlFor="ap-charge" error={err("chargeId")} hint="Choose which charge this payment is for. Leave on automatic to pay the oldest charge first.">
          <Select id="ap-charge" {...form.register("chargeId")}>
            <option value="">{t("Oldest charge first (automatic)")}</option>
            {charges.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
        </Field>
      )}
      <SubmitButton pending={pending} className="w-full">{t("Approve and post payment")}</SubmitButton>
    </form>
  );
}

export function RejectSubmissionForm({ submissionId }: { submissionId: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: rejectSubmissionSchema,
    defaultValues: { submissionId, reason: "" },
    action: rejectSubmissionAction,
    resetOnSuccess: false,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <input type="hidden" {...form.register("submissionId")} />
      <Field label="Reason (optional)" htmlFor="rj-reason" error={err("reason")} hint="The tenant will see this reason.">
        <Textarea id="rj-reason" rows={3} {...form.register("reason")} />
      </Field>
      <SubmitButton pending={pending} variant="destructive" className="w-full">{t("Reject payment")}</SubmitButton>
    </form>
  );
}
