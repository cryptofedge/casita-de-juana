"use client";

import { useState, useTransition } from "react";
import { addMessageAction, createTicketAction, setTicketStatusAction } from "@/actions/maintenance";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { FileField } from "@/components/forms/file-field";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui/form-controls";
import { CATEGORY_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";
import { messageSchema, ticketSchema } from "@/lib/validators";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const { t } = useT();
  const { form, submit, pending, serverError, err, setFiles, fileKey } = useActionForm({
    schema: messageSchema,
    defaultValues: { ticketId, body: "" },
    action: addMessageAction,
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-3" noValidate>
      <FormError message={serverError} />
      <input type="hidden" {...form.register("ticketId")} />
      <Field label="Reply" htmlFor="body" error={err("body")}>
        <Textarea id="body" rows={3} placeholder="Write a message…" {...form.register("body")} />
      </Field>
      <FileField key={fileKey} label="Attach photos (optional)" name="photos" multiple onFiles={setFiles} accept="image/*" error={err("photos" as never)} />
      <SubmitButton pending={pending}>{t("Send message")}</SubmitButton>
    </form>
  );
}

export function NewTicketForm() {
  const { t } = useT();
  const router = useRouter();
  const { form, submit, pending, serverError, err, setFiles, fileKey } = useActionForm({
    schema: ticketSchema,
    defaultValues: { category: "PLUMBING" as const, priority: "MEDIUM" as const, title: "", description: "" },
    action: createTicketAction,
    onSuccess: (r) => {
      const id = (r.data as { id: string } | undefined)?.id;
      router.push(id ? `/portal/requests/${id}` : "/portal/requests");
    },
  });
  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="What is this about?" htmlFor="category" error={err("category")}>
        <Select id="category" {...form.register("category")}>
          {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
        </Select>
      </Field>
      <Field label="How urgent is it?" htmlFor="priority" error={err("priority")}>
        <Select id="priority" {...form.register("priority")}>
          {Object.entries(PRIORITY_LABEL).map(([v, l]) => <option key={v} value={v}>{v === "URGENT" ? t("Urgent - safety or no water/power") : t(l)}</option>)}
        </Select>
      </Field>
      <Field label="Short title" htmlFor="title" error={err("title")}>
        <Input id="title" placeholder="e.g. Leaking kitchen tap" {...form.register("title")} />
      </Field>
      <Field label="Details" htmlFor="description" error={err("description")}>
        <Textarea id="description" rows={5} placeholder="Describe the problem, where it is, and when it started." {...form.register("description")} />
      </Field>
      <FileField key={fileKey} label="Photos of the damage (optional)" name="photos" multiple onFiles={setFiles} accept="image/*" capture hint="Up to 5 photos" error={err("photos" as never)} />
      <SubmitButton pending={pending} size="lg" className="w-full">{t("Send request")}</SubmitButton>
    </form>
  );
}

export function StatusControl({ ticketId, status }: { ticketId: string; status: string }) {
  const { t } = useT();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor="status" className="mb-1 block text-sm font-medium">Status</label>
      <Select
        id="status"
        value={status}
        disabled={pending}
        onChange={(e) => {
          const fd = new FormData();
          fd.set("ticketId", ticketId);
          fd.set("status", e.target.value);
          setError(null);
          start(async () => {
            const r = await setTicketStatusAction(fd);
            if (!r.ok) setError(r.error);
          });
        }}
      >
        {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
      </Select>
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
