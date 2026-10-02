import type { Metadata } from "next";
import { Plus, Trash2, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { addMonths, currentPeriod, dueDateFor, fmtDate, fmtPeriod, toDateInput } from "@/lib/dates";
import { moneyFormatter } from "@/lib/money";
import { getMoneyContext } from "@/lib/settings";
import { deleteReadingAction } from "@/actions/utilities";
import { ReadingForm } from "@/components/admin/reading-form";
import { ActionButton } from "@/components/forms/action-button";
import { FormDialog } from "@/components/forms/form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, FileLink, PageHeader, TableWrap, Td, Th } from "@/components/shared/page";

export const metadata: Metadata = { title: "Electricity" };
export const dynamic = "force-dynamic";

export default async function UtilitiesPage() {
  const { display, rate } = await getMoneyContext();
  const m = moneyFormatter(display, rate);

  const [leases, readings] = await Promise.all([
    db.lease.findMany({ where: { active: true }, include: { unit: true, tenant: true }, orderBy: { unit: { label: "asc" } } }),
    db.meterReading.findMany({
      orderBy: [{ period: "desc" }, { unit: { label: "asc" } }],
      take: 60,
      include: { unit: true, photo: true },
    }),
  ]);

  const units = await Promise.all(
    leases.map(async (l) => {
      const last = await db.meterReading.findFirst({ where: { unitId: l.unitId }, orderBy: { period: "desc" } });
      return {
        unitId: l.unitId, label: l.unit.label, tenant: l.tenant.name, currency: l.currency,
        lastKwh: last?.currentKwh ?? 0, lastRate: last?.ratePerKwh ?? 0,
      };
    }),
  );

  // Default to the month after the latest reading (never past the current month), due the 10th of the following month.
  const latestPeriod = readings[0]?.period;
  const nowP = currentPeriod();
  const billingMonth = latestPeriod ? (addMonths(latestPeriod, 1) > nowP ? nowP : addMonths(latestPeriod, 1)) : addMonths(nowP, -1);
  const dueDefault = toDateInput(dueDateFor(addMonths(billingMonth, 1), 10));

  return (
    <>
      <PageHeader
        title="Electricity"
        description="Sub-meter readings per unit. Saving a reading bills the tenant automatically."
        actions={
          units.length > 0 && (
            <FormDialog trigger={<Button><Plus /> New reading</Button>} title="Record meter reading" description="Previous reading and rate are pre-filled from the last bill.">
              <ReadingForm units={units} period={billingMonth} dueDate={dueDefault} />
            </FormDialog>
          )
        }
      />

      {readings.length === 0 ? (
        <EmptyState title="No readings yet">Record the first sub-meter reading to start billing electricity.</EmptyState>
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>Month</Th><Th>Unit</Th><Th className="text-right">Previous</Th><Th className="text-right">Current</Th>
              <Th className="text-right">Usage</Th><Th className="text-right">Rate</Th><Th className="text-right">Bill</Th><Th>Due</Th><Th>Photo</Th><Th><span className="sr-only">Actions</span></Th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => (
              <tr key={r.id}>
                <Td className="whitespace-nowrap font-medium">{fmtPeriod(r.period)}</Td>
                <Td className="font-semibold">{r.unit.label}</Td>
                <Td className="text-right tabular-nums">{r.previousKwh}</Td>
                <Td className="text-right tabular-nums">{r.currentKwh}</Td>
                <Td className="text-right tabular-nums"><span className="inline-flex items-center gap-1"><Zap className="size-3.5 text-gold" />{(r.currentKwh - r.previousKwh).toFixed(1)} kWh</span></Td>
                <Td className="text-right tabular-nums">{r.ratePerKwh} {r.currency}</Td>
                <Td className="text-right font-semibold tabular-nums">{m(r.subtotal, r.currency)}</Td>
                <Td className="whitespace-nowrap">{fmtDate(r.dueDate)}</Td>
                <Td>{r.photo ? <FileLink id={r.photo.id} name={r.photo.filename} mime={r.photo.mime} label="View" /> : <span className="text-muted-foreground">-</span>}</Td>
                <Td className="text-right">
                  <ActionButton size="sm" variant="ghost" aria-label="Delete reading" confirm="Delete this reading and remove its bill from the tenant balance?" action={deleteReadingAction.bind(null, r.id)}>
                    <Trash2 />
                  </ActionButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
