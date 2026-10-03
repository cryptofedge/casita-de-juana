import { describe, expect, it } from "vitest";
import { buildLedger, computeLateFee, type LedgerCharge } from "./ledger";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const rent = (period: string, amount = 100_00): LedgerCharge => ({
  id: `r-${period}`,
  type: "RENT",
  period,
  description: `Rent ${period}`,
  amount,
  dueDate: d(`${period}-01`),
});

describe("buildLedger", () => {
  it("marks a fully paid charge as PAID", () => {
    const l = buildLedger(
      [rent("2026-09")],
      [{ id: "p", amount: 100_00, paidAt: d("2026-09-02") }],
      d("2026-10-02"),
      5,
    );
    expect(l.rows[0].status).toBe("PAID");
    expect(l.balance).toBe(0);
  });

  it("is PENDING before the due date and OVERDUE after the grace period", () => {
    expect(buildLedger([rent("2026-10")], [], d("2026-10-01"), 5).rows[0].status).toBe("PENDING");
    expect(buildLedger([rent("2026-10")], [], d("2026-10-06"), 5).rows[0].status).toBe("PENDING");
    expect(buildLedger([rent("2026-10")], [], d("2026-10-07"), 5).rows[0].status).toBe("OVERDUE");
  });

  it("is PARTIAL when part-paid and not yet late, OVERDUE when late", () => {
    const pay = [{ id: "p", amount: 40_00, paidAt: d("2026-10-02") }];
    const early = buildLedger([rent("2026-10")], pay, d("2026-10-03"), 5);
    expect(early.rows[0].status).toBe("PARTIAL");
    expect(early.rows[0].remaining).toBe(60_00);
    const late = buildLedger([rent("2026-10")], pay, d("2026-10-20"), 5);
    expect(late.rows[0].status).toBe("OVERDUE");
    expect(late.overdue).toBe(60_00);
  });

  it("applies payments oldest charge first and tracks credit", () => {
    const l = buildLedger(
      [rent("2026-09"), rent("2026-10")],
      [{ id: "p", amount: 150_00, paidAt: d("2026-10-01") }],
      d("2026-10-02"),
      5,
    );
    expect(l.rows.map((r) => r.status)).toEqual(["PAID", "PARTIAL"]);
    const credit = buildLedger(
      [rent("2026-10")],
      [{ id: "p", amount: 130_00, paidAt: d("2026-10-01") }],
      d("2026-10-02"),
      5,
    );
    expect(credit.balance).toBe(-30_00);
  });

  it("never flags late fees as overdue", () => {
    const fee: LedgerCharge = {
      id: "f",
      type: "LATE_FEE",
      period: "2026-09",
      description: "Late fee",
      amount: 10_00,
      dueDate: d("2026-09-10"),
    };
    expect(buildLedger([fee], [], d("2026-10-30"), 5).rows[0].status).toBe("PENDING");
  });
});

describe("overdue only refers to rent", () => {
  it("keeps non-rent charges out of overdue but in the balance", () => {
    const elec: LedgerCharge = { id: "e", type: "ELECTRICITY", period: "2026-09", description: "Electricity", amount: 40_00, dueDate: d("2026-09-10") };
    const other: LedgerCharge = { id: "o", type: "OTHER", period: "2026-09", description: "Repair", amount: 25_00, dueDate: d("2026-09-10") };
    const l = buildLedger([elec, other, rent("2026-10")], [], d("2026-10-20"), 5);
    expect(l.balance).toBe(165_00);
    expect(l.overdue).toBe(100_00);
    expect(l.rows.find((r) => r.id === "e")!.status).toBe("PENDING");
  });
});

describe("computeLateFee", () => {
  it("combines flat and percentage", () => {
    expect(computeLateFee(200_00, 10_00, 5)).toBe(20_00);
    expect(computeLateFee(200_00, 0, 0)).toBe(0);
  });
});

describe("payments aimed at a specific charge", () => {
  const prev: LedgerCharge = { id: "prev", type: "OTHER", period: "2026-09", description: "Previous months balance", amount: 1240_00, dueDate: d("2026-09-01") };
  const oct = rent("2026-10", 350_00);
  it("applies the payment to the chosen charge, not the oldest", () => {
    const l = buildLedger([prev, oct], [{ id: "p", amount: 290_00, paidAt: d("2026-10-02"), chargeId: "r-2026-10" }], d("2026-10-02"), 0);
    const byId = Object.fromEntries(l.rows.map((r) => [r.id, r]));
    expect(byId["r-2026-10"].paid).toBe(290_00);
    expect(byId["r-2026-10"].remaining).toBe(60_00);
    expect(byId["prev"].paid).toBe(0);
    expect(l.balance).toBe(1300_00);
    expect(l.overdue).toBe(60_00); // only October rent is overdue; the old balance counts in the total only
  });
  it("sends any excess of a directed payment to the oldest charge", () => {
    const l = buildLedger([prev, oct], [{ id: "p", amount: 400_00, paidAt: d("2026-10-02"), chargeId: "r-2026-10" }], d("2026-10-02"), 0);
    const byId = Object.fromEntries(l.rows.map((r) => [r.id, r]));
    expect(byId["r-2026-10"].paid).toBe(350_00);
    expect(byId["prev"].paid).toBe(50_00);
  });
});
