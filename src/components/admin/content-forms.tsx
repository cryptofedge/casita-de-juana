"use client";

import { useState } from "react";
import {
  createAnnouncementAction,
  createContactAction,
  saveSettingsAction,
  uploadDocumentAction,
} from "@/actions/content";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { FileField } from "@/components/forms/file-field";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form-controls";
import { CONTACT_CATEGORY_LABEL, DOC_TYPE_LABEL } from "@/lib/labels";
import { announcementSchema, contactSchema, documentSchema, settingsSchema } from "@/lib/validators";
import { useT } from "@/lib/i18n/provider";

export function AnnouncementForm() {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: announcementSchema,
    defaultValues: { title: "", body: "", pinned: false, expiresAt: "" },
    action: createAnnouncementAction,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Title" htmlFor="a-title" error={err("title")}>
        <Input id="a-title" placeholder="e.g. Water shut-off Saturday 9am-1pm" {...form.register("title")} />
      </Field>
      <Field label="Message" htmlFor="a-body" error={err("body")}>
        <Textarea id="a-body" rows={5} {...form.register("body")} />
      </Field>
      <Field label="Hide after (optional)" htmlFor="a-exp" error={err("expiresAt")} hint="The notice disappears from tenant dashboards after this date">
        <Input id="a-exp" type="date" {...form.register("expiresAt")} />
      </Field>
      <label className="flex items-center gap-3 rounded-lg border bg-secondary/40 p-3 text-sm font-medium">
        <input type="checkbox" className="size-5 accent-[var(--primary)]" {...form.register("pinned")} />
        {t("Pin to every tenant's dashboard")}
      </label>
      <SubmitButton pending={pending} className="w-full">{t("Post announcement")}</SubmitButton>
    </form>
  );
}

export function DocumentForm({ tenants }: { tenants: { id: string; name: string; unit: string }[] }) {
  const { t } = useT();
  const [type, setType] = useState("LEASE");
  const { form, submit, pending, serverError, err, setFiles, fileKey } = useActionForm({
    schema: documentSchema,
    defaultValues: { title: "", type: "LEASE" as const, tenantId: tenants[0]?.id ?? "" },
    action: uploadDocumentAction,
  });
  const typeReg = form.register("type");
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Title" htmlFor="d-title" error={err("title")}>
        <Input id="d-title" placeholder="e.g. Lease agreement - Apt 2A" {...form.register("title")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" htmlFor="d-type" error={err("type")}>
          <Select id="d-type" {...typeReg} onChange={(e) => { setType(e.target.value); typeReg.onChange(e); }}>
            {Object.entries(DOC_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </Select>
        </Field>
        <Field label="Visible to" htmlFor="d-tenant" error={err("tenantId")}>
          <Select id="d-tenant" {...form.register("tenantId")}>
            {(type === "HOUSE_RULES" || type === "OTHER") && <option value="">{t("All tenants")}</option>}
            {tenants.map((tn) => <option key={tn.id} value={tn.id}>{tn.name} ({t("Apt {unit}", { unit: tn.unit })})</option>)}
          </Select>
        </Field>
      </div>
      <FileField key={fileKey} label="File" name="file" onFiles={setFiles} error={err("file" as never)} />
      <SubmitButton pending={pending} className="w-full">{t("Upload")}</SubmitButton>
    </form>
  );
}

export function ContactForm() {
  const { t } = useT();
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: contactSchema,
    defaultValues: { name: "", role: "", category: "PLUMBER" as const, phone: "", notes: "" },
    action: createContactAction,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Name" htmlFor="c-name" error={err("name")}><Input id="c-name" {...form.register("name")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" htmlFor="c-cat" error={err("category")}>
          <Select id="c-cat" {...form.register("category")}>
            {Object.entries(CONTACT_CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </Select>
        </Field>
        <Field label="Phone" htmlFor="c-phone" error={err("phone")}><Input id="c-phone" type="tel" {...form.register("phone")} /></Field>
      </div>
      <Field label="Role / what they do (optional)" htmlFor="c-role" error={err("role")}><Input id="c-role" {...form.register("role")} /></Field>
      <Field label="Notes (optional)" htmlFor="c-notes" error={err("notes")}><Input id="c-notes" {...form.register("notes")} /></Field>
      <SubmitButton pending={pending} className="w-full">{t("Add contact")}</SubmitButton>
    </form>
  );
}

export function SettingsForm({ defaults }: { defaults: { usdDopRate: string; propertyName: string; propertyAddress: string; ownerPhone: string } }) {
  const { t } = useT();
  const [saved, setSaved] = useState(false);
  const { form, submit, pending, serverError, err } = useActionForm({
    schema: settingsSchema,
    defaultValues: defaults,
    action: saveSettingsAction,
    resetOnSuccess: false,
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500); },
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Property name" htmlFor="s-name" error={err("propertyName")}><Input id="s-name" {...form.register("propertyName")} /></Field>
      <Field label="Address" htmlFor="s-addr" error={err("propertyAddress")}><Input id="s-addr" {...form.register("propertyAddress")} /></Field>
      <Field label="Owner phone" htmlFor="s-phone" error={err("ownerPhone")}><Input id="s-phone" type="tel" {...form.register("ownerPhone")} /></Field>
      <Field label="Exchange rate: DOP per 1 USD" htmlFor="s-rate" error={err("usdDopRate")} hint="Used for the USD / DOP display toggle and consolidated totals. Lease and bill amounts stay in their own currency.">
        <Input id="s-rate" inputMode="decimal" {...form.register("usdDopRate")} />
      </Field>
      <div className="flex items-center gap-3">
        <SubmitButton pending={pending}>{t("Save settings")}</SubmitButton>
        {saved && <span role="status" className="text-sm font-medium text-success">{t("Saved ✓")}</span>}
      </div>
    </form>
  );
}
