import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getDisplayCurrency, getSettings } from "@/lib/settings";
import { buildStatement } from "@/lib/statement";
import { currentPeriod, toDateInput } from "@/lib/dates";
import { PAYMENT_METHOD_LABEL, CHARGE_TYPE_LABEL } from "@/lib/labels";

export const dynamic = "force-dynamic";

/** Neutralises spreadsheet formula injection and quotes the value. */
function cell(v: string | number | null | undefined) {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}
const money = (minor: number) => (minor / 100).toFixed(2);

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "OWNER") return new NextResponse("Unauthorized", { status: 401 });

  const month = new URL(req.url).searchParams.get("month") ?? currentPeriod();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return new NextResponse("Bad month", { status: 400 });

  const [settings, currency] = await Promise.all([getSettings(), getDisplayCurrency()]);
  const st = await buildStatement(month, currency, settings.usdDopRate);

  const out: string[] = [];
  out.push([cell(`${settings.propertyName} - Financial statement ${month}`)].join(","));
  out.push([cell("Currency"), cell(currency), cell("USD/DOP rate"), cell(settings.usdDopRate)].join(","));
  out.push("");
  out.push(["Unit", "Tenant", "Opening balance", "Billed", "Paid", "Closing balance"].map(cell).join(","));
  for (const r of st.rows) {
    out.push([cell(r.unit), cell(r.tenant), money(r.opening), money(r.billed), money(r.paid), money(r.closing)].join(","));
  }
  out.push(["", cell("TOTAL"), money(st.totals.opening), money(st.totals.billed), money(st.totals.paid), money(st.totals.closing)].join(","));
  out.push("");
  out.push(["Date", "Unit", "Tenant", "Kind", "Type", "Description", "Reference", `Amount (${currency})`].map(cell).join(","));
  for (const l of st.lines) {
    const type = l.kind === "PAYMENT" ? PAYMENT_METHOD_LABEL[l.type] ?? l.type : CHARGE_TYPE_LABEL[l.type] ?? l.type;
    out.push(
      [cell(toDateInput(l.date)), cell(l.unit), cell(l.tenant), cell(l.kind === "PAYMENT" ? "Payment" : "Charge"), cell(type), cell(l.description), cell(l.reference), l.kind === "PAYMENT" ? `-${money(l.amount)}` : money(l.amount)].join(","),
    );
  }

  return new NextResponse("﻿" + out.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="casita-statement-${month}-${currency}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
