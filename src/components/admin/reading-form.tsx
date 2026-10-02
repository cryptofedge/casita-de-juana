"use client";

import { useEffect } from "react";
import { createReadingAction } from "@/actions/utilities";
import { useActionForm } from "@/components/forms/use-action-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { FileField } from "@/components/forms/file-field";
import { Field, FormError, Input, Select } from "@/components/ui/form-controls";
import { meterReadingSchema } from "@/lib/validators";
import { useT } from "@/lib/i18n/provider";

export interface ReadingUnit {
  unitId: string;
  label: string;
  tenant: string;
  currency: "USD" | "DOP";
  lastKwh: number;
  lastRate: number;
}

export function ReadingForm({ units, period, dueDate }: { units: ReadingUnit[]; period: string; dueDate: string }) {
  const { t } = useT();
  const first = units[0];
  const { form, submit, pending, serverError, err, setFiles, fileKey } = useActionForm({
    schema: meterReadingSchema,
    defaultValues: {
      unitId: first?.unitId ?? "",
      period,
      previousKwh: String(first?.lastKwh ?? 0),
      currentKwh: "",
      ratePerKwh: String(first?.lastRate ?? ""),
      dueDate,
    },
    action: createReadingAction,
  });

  const unitId = form.watch("unitId");
  const unit = units.find((u) => u.unitId === unitId);
  useEffect(() => {
    if (!unit) return;
    form.setValue("previousKwh", String(unit.lastKwh));
    if (unit.lastRate) form.setValue("ratePerKwh", String(unit.lastRate));
  }, [unit, form]);

  const [prev, curr, rate] = form.watch(["previousKwh", "currentKwh", "ratePerKwh"]).map((v) => parseFloat(v));
  const kwh = curr >= prev ? curr - prev : NaN;
  const subtotal = kwh * rate;

  return (
    <form method="post" onSubmit={submit} className="space-y-4" noValidate>
      <FormError message={serverError} />
      <Field label="Unit" htmlFor="r-unit" error={err("unitId")}>
        <Select id="r-unit" {...form.register("unitId")}>
          {units.map((u) => <option key={u.unitId} value={u.unitId}>{t("Apt {unit}", { unit: u.label })} - {u.tenant} ({u.currency})</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Billing month" htmlFor="r-period" error={err("period")}>
          <Input id="r-period" type="month" {...form.register("period")} />
        </Field>
        <Field label="Due date" htmlFor="r-due" error={err("dueDate")}>
          <Input id="r-due" type="date" {...form.register("dueDate")} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Previous reading (kWh)" htmlFor="r-prev" error={err("previousKwh")}>
          <Input id="r-prev" inputMode="decimal" {...form.register("previousKwh")} />
        </Field>
        <Field label="Current reading (kWh)" htmlFor="r-curr" error={err("currentKwh")}>
          <Input id="r-curr" inputMode="decimal" {...form.register("currentKwh")} />
        </Field>
      </div>
      <Field label={t("Rate per kWh ({cur})", { cur: unit?.currency ?? "USD" })} htmlFor="r-rate" error={err("ratePerKwh")}>
        <Input id="r-rate" inputMode="decimal" {...form.register("ratePerKwh")} />
      </Field>
      <div className="rounded-lg bg-info-soft px-3 py-2 text-sm">
        {Number.isFinite(kwh) && Number.isFinite(subtotal) ? (
          <>
            <strong>{kwh.toFixed(2)} kWh</strong> × {rate} = <strong>{subtotal.toFixed(2)} {unit?.currency}</strong>
            <span className="block text-xs text-muted-foreground">{t("Added to the tenant balance when you save.")}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{t("Enter the current reading to see the bill.")}</span>
        )}
      </div>
      <FileField key={fileKey} label="Photo of the meter" name="photo" onFiles={setFiles} accept="image/*" capture hint="Proof of reading - visible to the tenant" error={err("photo" as never)} />
      <SubmitButton pending={pending} className="w-full">{t("Save reading & bill tenant")}</SubmitButton>
    </form>
  );
}
