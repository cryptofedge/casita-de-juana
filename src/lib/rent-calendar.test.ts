import { describe, expect, it } from "vitest";
import { buildLedger, type LedgerCharge, type LedgerPayment } from "./ledger";
import { allocatePayments, futureRentPeriods, rentCalendar } from "./rent-calendar";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const rent = (period: string, amount = 350_00): LedgerCharge => ({
  id: `r-${period}`,
  type: "RENT",
  period,
  description: `Rent ${period}`,
  amount,
  dueDate: d(`${period}-01`),
});
const pay = (id: string, amount: number, date: string, chargeId?: string): LedgerPayment => ({ id, amount, paidAt: d(date), chargeId });

function setup(charges: LedgerCharge[], payments: LedgerPayment[], today = "2026-11-12", leaseStart = "2026-10-01") {
  const ledger = buildLedger(charges, payments, d(today), 0);
  const cal = rentCalendar({
    rows: ledger.rows,
    balance: ledger.balance,
    monthlyRent: 350_00,
    leaseStart: d(leaseStart),
    nowPeriod: today.slice(0, 7),
  });
  return { ledger, cal };
}

describe("rentCalendar", () => {
  it("shows paid months and no credit when the tenant is exactly paid up", () => {
    const { cal } = setup([rent("2026-10"), rent("2026-11")], [pay("a", 350_00, "2026-10-02"), pay("b", 350_00, "2026-11-02")]);
    expect(cal.credit).toBe(0);
    expect(cal.monthsAhead).toBe(0);
    expect(cal.paidThrough).toBe("2026-11");
    expect(cal.nextUnpaid).toBe("2026-12");
    expect(cal.months.find((m) => m.period === "2026-12")?.status).toBe("UPCOMING");
  });

  it("spreads money paid in advance over the coming months", () => {
    // November billed and paid; then December, January and February paid early.
    const { cal } = setup(
      [rent("2026-10"), rent("2026-11")],
      [pay("oct", 350_00, "2026-10-02"), pay("nov", 350_00, "2026-11-02"), pay("dec", 350_00, "2026-11-12"), pay("jan", 350_00, "2026-11-13"), pay("feb", 350_00, "2026-11-20")],
    );
    expect(cal.credit).toBe(1050_00);
    expect(cal.monthsAhead).toBe(3);
    expect(cal.paidThrough).toBe("2027-02");
    expect(cal.nextUnpaid).toBe("2027-03");
    const s = (p: string) => cal.months.find((m) => m.period === p)?.status;
    expect([s("2026-11"), s("2026-12"), s("2027-01"), s("2027-02"), s("2027-03")]).toEqual(["PAID", "PREPAID", "PREPAID", "PREPAID", "UPCOMING"]);
    expect(cal.months.find((m) => m.current)?.period).toBe("2026-11");
  });

  it("marks a partly covered coming month", () => {
    const { cal } = setup([rent("2026-11")], [pay("a", 350_00 + 100_00, "2026-11-02")], "2026-11-12", "2026-11-01");
    expect(cal.monthsAhead).toBe(0);
    expect(cal.paidThrough).toBe("2026-11");
    const dec = cal.months.find((m) => m.period === "2026-12")!;
    expect(dec.status).toBe("PART_PREPAID");
    expect(dec.covered).toBe(100_00);
  });

  it("shows overdue rent and starts the view at the oldest unpaid month", () => {
    const { cal } = setup([rent("2026-06"), rent("2026-07"), rent("2026-08"), rent("2026-09"), rent("2026-10"), rent("2026-11")], [], "2026-11-12", "2026-06-01");
    expect(cal.months[0].period).toBe("2026-06");
    expect(cal.months[0].status).toBe("OVERDUE");
    expect(cal.paidThrough).toBeNull();
    expect(cal.nextUnpaid).toBe("2026-11");
  });

  it("does not show months before the lease starts or after it ends", () => {
    expect(futureRentPeriods({ lastBilled: "2026-11", nowPeriod: "2026-11", leaseStart: d("2026-10-01"), leaseEnd: d("2027-01-31") })).toEqual(["2026-12", "2027-01"]);
    const { cal } = setup([rent("2026-11")], [pay("a", 350_00, "2026-11-02")], "2026-11-12", "2026-11-01");
    expect(cal.months[0].period).toBe("2026-11");
  });
});

describe("allocatePayments", () => {
  it("says which month each payment covered, including months paid ahead", () => {
    const charges = [rent("2026-10"), rent("2026-11")];
    const payments = [pay("oct", 350_00, "2026-10-02"), pay("nov", 350_00, "2026-11-02"), pay("dec", 350_00, "2026-11-12"), pay("jan", 350_00, "2026-11-13")];
    const { cal } = setup(charges, payments);
    const uses = allocatePayments({ charges, payments, future: cal.future, monthlyRent: 350_00 });
    expect(uses.get("oct")).toEqual([expect.objectContaining({ chargeId: "r-2026-10", amount: 350_00 })]);
    expect(uses.get("nov")).toEqual([expect.objectContaining({ chargeId: "r-2026-11", amount: 350_00 })]);
    expect(uses.get("dec")).toEqual([{ amount: 350_00, period: "2026-12", ahead: true }]);
    expect(uses.get("jan")).toEqual([{ amount: 350_00, period: "2027-01", ahead: true }]);
  });

  it("splits a payment across charges and agrees with the ledger's paid amounts", () => {
    const past: LedgerCharge = { id: "past", type: "OTHER", period: "2026-09", description: "Past Balance", amount: 1300_00, dueDate: d("2026-09-01") };
    const charges = [past, rent("2026-10"), rent("2026-11")];
    const payments = [pay("a", 290_00, "2026-10-02"), pay("b", 620_00, "2026-10-29"), pay("c", 1090_00, "2026-11-05"), pay("d", 100_00, "2026-11-06", "r-2026-11")];
    const ledger = buildLedger(charges, payments, d("2026-11-12"), 0);
    const uses = allocatePayments({ charges, payments, future: ["2026-12"], monthlyRent: 350_00 });
    // Payment b finishes the past balance after payment a, then starts on October's rent.
    expect(uses.get("b")).toEqual([
      expect.objectContaining({ chargeId: "past", amount: 620_00 }),
    ]);
    // The directed payment goes to November first.
    expect(uses.get("d")).toEqual([expect.objectContaining({ chargeId: "r-2026-11", amount: 100_00 })]);
    // Per charge, the payments add up to what the ledger says was paid.
    for (const row of ledger.rows) {
      const total = [...uses.values()].flat().filter((u) => u.chargeId === row.id).reduce((s, u) => s + u.amount, 0);
      expect(total).toBe(row.paid);
    }
    // And the money beyond everything billed equals the ledger credit.
    const ahead = [...uses.values()].flat().filter((u) => u.ahead).reduce((s, u) => s + u.amount, 0);
    expect(ahead).toBe(Math.max(0, -ledger.balance));
  });
});
