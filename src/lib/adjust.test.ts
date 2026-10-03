import { describe, expect, it } from "vitest";
import { buildLedger, type LedgerCharge } from "./ledger";
import { planAdjustment, solveAdjustment } from "./adjust";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);
const today = d("2026-10-02");

describe("planAdjustment", () => {
  it("adds a not-yet-due line when only the total is raised", () => {
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 1300_00, 60_00)).toEqual({ over: 0, rest: 890_00 });
  });
  it("adds an overdue line when more should be overdue", () => {
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 1300_00, 500_00)).toEqual({ over: 440_00, rest: 450_00 });
  });
  it("allows targets BELOW the ledger by using credits", () => {
    // ledger says 1,360 total / 1,360 overdue; owner wants 1,300 total / 60 overdue
    expect(planAdjustment({ balance: 1360_00, overdue: 1360_00 }, 1300_00, 60_00)).toEqual({ over: -1300_00, rest: 1240_00 });
    expect(planAdjustment({ balance: 1360_00, overdue: 1360_00 }, 1000_00, 1000_00)).toEqual({ over: -360_00, rest: 0 });
  });
  it("only rejects overdue greater than the total", () => {
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 100_00, 200_00)).toEqual({ error: "OVERDUE_GT_BALANCE" });
  });
});

describe("adjustment lines produce exactly the requested figures in the ledger", () => {
  // Real charges: $1,300 from Sep 1 (overdue) and October rent $350 with $290 paid ($60 overdue).
  const base: LedgerCharge[] = [
    { id: "prev", type: "OTHER", period: "2026-09", description: "Previous months balance", amount: 1300_00, dueDate: d("2026-09-01") },
    { id: "oct", type: "RENT", period: "2026-10", description: "Rent", amount: 350_00, dueDate: d("2026-10-01") },
  ];
  const payments = [{ id: "p", amount: 290_00, paidAt: d("2026-10-02") }];

  function apply(targetBalance: number, targetOverdue: number) {
    const b = buildLedger(base, payments, today, 0);
    const plan = planAdjustment({ balance: b.balance, overdue: b.overdue }, targetBalance, targetOverdue);
    if ("error" in plan) throw new Error(plan.error);
    const adj: LedgerCharge[] = [];
    // over line goes before everything, rest line after everything
    if (plan.over !== 0) adj.push({ id: "over", type: "OTHER", period: "x", description: "adj", amount: plan.over, dueDate: d("2026-08-31") });
    if (plan.rest !== 0) adj.push({ id: "rest", type: "OTHER", period: "x", description: "adj", amount: plan.rest, dueDate: d("2026-11-01") });
    return buildLedger([...base, ...adj], payments, today, 0);
  }

  it("lowering the overdue amount (credit) works", () => {
    const l = apply(1300_00, 60_00);
    expect(l.balance).toBe(1300_00);
    expect(l.overdue).toBe(60_00);
  });
  it("raising both works", () => {
    const l = apply(2000_00, 1500_00);
    expect(l.balance).toBe(2000_00);
    expect(l.overdue).toBe(1500_00);
  });
  it("lowering total only (credit at the end) keeps overdue", () => {
    const l = apply(1000_00, 1000_00);
    expect(l.balance).toBe(1000_00);
    expect(l.overdue).toBe(1000_00);
  });
});

describe("solveAdjustment", () => {
  const d2 = (s: string) => new Date(`${s}T00:00:00.000Z`);
  it("hits the exact overdue target even when payments spilled onto not-yet-due charges", () => {
    const charges: LedgerCharge[] = [
      { id: "a", type: "OTHER", period: "2026-09", description: "old", amount: 100_00, dueDate: d2("2026-09-01") },
      { id: "b", type: "OTHER", period: "2026-12", description: "future", amount: 500_00, dueDate: d2("2026-12-01") },
    ];
    const payments = [{ id: "p", amount: 300_00, paidAt: d2("2026-10-01") }]; // pays "old" fully, 200 of "future"
    const today2 = d2("2026-10-02");
    const r = solveAdjustment({ charges, payments, graceDays: 0, today: today2, overDue: d2("2026-08-31"), restDue: d2("2027-01-01"), targetBalance: 1000_00, targetOverdue: 250_00 });
    if ("error" in r) throw new Error(r.error);
    const lines: LedgerCharge[] = [];
    if (r.over !== 0) lines.push({ id: "o", type: "OTHER", period: "x", description: "adj", amount: r.over, dueDate: d2("2026-08-31") });
    if (r.rest !== 0) lines.push({ id: "r", type: "OTHER", period: "x", description: "adj", amount: r.rest, dueDate: d2("2027-01-01") });
    const l = buildLedger([...charges, ...lines], payments, today2, 0);
    expect(l.overdue).toBe(250_00);
    expect(l.balance).toBe(1000_00);
  });
});
