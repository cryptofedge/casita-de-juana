"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { createUnitAction, inviteTenantAction, regenerateInviteAction, updateLeaseAction } from "@/actions/tenants";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { ActionButton } from "@/components/forms/action-button";
import { Button } from "@/components/ui/button";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form-controls";
import { inviteTenantSchema, leaseUpdateSchema, unitSchema } from "@/lib/validators";
import { useT } from "@/lib/i18n/provider";

export function CopyLink({ link, label = "Invitation link" }: { link: string; label?: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2 rounded-lg border bg-info-soft p-3">
      <div className="text-sm font-semibold">{t(label)}</div>
      <p className="text-xs text-muted-foreground">
        {t("Send this link to the tenant (WhatsApp, SMS or email). It expires in 7 days and can be used once.")}
      </p>
      <div className="flex gap-2">
        <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t(label)} />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={t("Copy link")}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              /* clipboard blocked - the field is selectable */
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

export function UnitForm() {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: unitSchema,
    defaultValues: { label: "", floor: "1", bedrooms: "1", notes: "" },
    action: createUnitAction,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <div className="grid grid-cols-3 gap-3">
        <Field label="Unit name" htmlFor="label" error={err("label")}>
          <Input id="label" placeholder="3A" {...form.register("label")} />
        </Field>
        <Field label="Floor" htmlFor="floor" error={err("floor")}>
          <Input id="floor" inputMode="numeric" {...form.register("floor")} />
        </Field>
        <Field label="Bedrooms" htmlFor="bedrooms" error={err("bedrooms")}>
          <Input id="bedrooms" inputMode="numeric" {...form.register("bedrooms")} />
        </Field>
      </div>
      <Field label="Notes (optional)" htmlFor="notes" error={err("notes")}>
        <Textarea id="notes" rows={2} {...form.register("notes")} />
      </Field>
      <SubmitButton pending={pending} className="w-full">{t("Add unit")}</SubmitButton>
    </form>
  );
}

export function InviteTenantForm({ units, today }: { units: { id: string; label: string }[]; today: string }) {
  const { t } = useT();
  const [result, setResult] = useState<{ link: string; name: string } | null>(null);
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: inviteTenantSchema,
    defaultValues: {
      name: "", email: "", phone: "", unitId: units[0]?.id ?? "", startDate: today, monthlyRent: "",
      currency: "USD" as const, dueDay: "1", graceDays: "5", lateFeeFlat: "0", lateFeePercent: "0", deposit: "0",
    },
    action: inviteTenantAction,
    resetOnSuccess: false,
    closeOnSuccess: false,
    onSuccess: (r) => setResult((r.data as { link: string; name: string }) ?? null),
  });
  if (result) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          {t("{name} was added and assigned to the unit. Share their personal link so they can choose a password.", { name: result.name })}
        </p>
        <CopyLink link={result.link} />
      </div>
    );
  }
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Full name" htmlFor="name" error={err("name")}>
        <Input id="name" autoComplete="off" {...form.register("name")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Email" htmlFor="email" error={err("email")}>
          <Input id="email" type="email" inputMode="email" autoComplete="off" {...form.register("email")} />
        </Field>
        <Field label="Phone / WhatsApp" htmlFor="phone" error={err("phone")}>
          <Input id="phone" type="tel" autoComplete="off" {...form.register("phone")} />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Assign to unit" htmlFor="unitId" error={err("unitId")}>
          <Select id="unitId" {...form.register("unitId")}>
            {units.map((u) => <option key={u.id} value={u.id}>{t("Apt {unit}", { unit: u.label })}</option>)}
          </Select>
        </Field>
        <Field label="Lease start" htmlFor="startDate" error={err("startDate")}>
          <Input id="startDate" type="date" {...form.register("startDate")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly rent" htmlFor="monthlyRent" error={err("monthlyRent")}>
          <Input id="monthlyRent" inputMode="decimal" placeholder="0.00" {...form.register("monthlyRent")} />
        </Field>
        <Field label="Currency" htmlFor="currency" error={err("currency")}>
          <Select id="currency" {...form.register("currency")}>
            <option value="USD">USD</option>
            <option value="DOP">DOP</option>
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Due day" htmlFor="dueDay" error={err("dueDay")} hint="1-28"><Input id="dueDay" inputMode="numeric" {...form.register("dueDay")} /></Field>
        <Field label="Grace days" htmlFor="graceDays" error={err("graceDays")}><Input id="graceDays" inputMode="numeric" {...form.register("graceDays")} /></Field>
        <Field label="Late fee (flat)" htmlFor="lateFeeFlat" error={err("lateFeeFlat")}><Input id="lateFeeFlat" inputMode="decimal" {...form.register("lateFeeFlat")} /></Field>
        <Field label="Late fee %" htmlFor="lateFeePercent" error={err("lateFeePercent")}><Input id="lateFeePercent" inputMode="decimal" {...form.register("lateFeePercent")} /></Field>
      </div>
      <Field label="Security deposit" htmlFor="deposit" error={err("deposit")}>
        <Input id="deposit" inputMode="decimal" {...form.register("deposit")} />
      </Field>
      <SubmitButton pending={pending} className="w-full">{t("Add tenant & create invite link")}</SubmitButton>
    </form>
  );
}

export function LeaseForm({
  lease,
}: {
  lease: {
    id: string; startDate: string; endDate: string; monthlyRent: string; currency: "USD" | "DOP";
    dueDay: string; graceDays: string; lateFeeFlat: string; lateFeePercent: string; deposit: string;
  };
}) {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: leaseUpdateSchema,
    defaultValues: { leaseId: lease.id, ...lease },
    action: updateLeaseAction,
    resetOnSuccess: false,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <input type="hidden" {...form.register("leaseId")} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lease start" htmlFor="l-start" error={err("startDate")}><Input id="l-start" type="date" {...form.register("startDate")} /></Field>
        <Field label="Lease end (optional)" htmlFor="l-end" error={err("endDate")}><Input id="l-end" type="date" {...form.register("endDate")} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Monthly rent" htmlFor="l-rent" error={err("monthlyRent")}><Input id="l-rent" inputMode="decimal" {...form.register("monthlyRent")} /></Field>
        <Field label="Currency" htmlFor="l-cur" error={err("currency")}>
          <Select id="l-cur" {...form.register("currency")}><option value="USD">USD</option><option value="DOP">DOP</option></Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Due day" htmlFor="l-due" error={err("dueDay")}><Input id="l-due" inputMode="numeric" {...form.register("dueDay")} /></Field>
        <Field label="Grace days" htmlFor="l-grace" error={err("graceDays")}><Input id="l-grace" inputMode="numeric" {...form.register("graceDays")} /></Field>
        <Field label="Late fee (flat)" htmlFor="l-flat" error={err("lateFeeFlat")}><Input id="l-flat" inputMode="decimal" {...form.register("lateFeeFlat")} /></Field>
        <Field label="Late fee %" htmlFor="l-pct" error={err("lateFeePercent")}><Input id="l-pct" inputMode="decimal" {...form.register("lateFeePercent")} /></Field>
      </div>
      <Field label="Security deposit" htmlFor="l-dep" error={err("deposit")}><Input id="l-dep" inputMode="decimal" {...form.register("deposit")} /></Field>
      <p className="text-xs text-muted-foreground">{t("Changing the rent affects future months only; charges already created are not rewritten.")}</p>
      <SubmitButton pending={pending} className="w-full">{t("Save lease")}</SubmitButton>
    </form>
  );
}

export function ResetLinkButton({ userId }: { userId: string }) {
  const { t } = useT();
  const [link, setLink] = useState<string | null>(null);
  return (
    <div className="space-y-3">
      <ActionButton
        variant="outline"
        action={regenerateInviteAction.bind(null, userId)}
        onResult={(r) => r.ok && setLink((r.data as { link: string }).link)}
      >
        {t("New sign-in / password reset link")}
      </ActionButton>
      {link && <CopyLink link={link} label="New link" />}
    </div>
  );
}
