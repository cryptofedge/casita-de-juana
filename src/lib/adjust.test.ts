import { describe, expect, it } from "vitest";
import { planAdjustment } from "./adjust";

describe("planAdjustment", () => {
  // Rafael: ledger shows $410 total of which $60 overdue; owner wants $1,300 total, $60 overdue.
  it("adds only a not-yet-due line when the overdue part already matches", () => {
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 1300_00, 60_00)).toEqual({ over: 0, rest: 890_00 });
  });
  it("adds an overdue line when more of it should be overdue", () => {
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 1300_00, 500_00)).toEqual({ over: 440_00, rest: 450_00 });
  });
  it("does nothing when targets equal the ledger", () => {
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 410_00, 60_00)).toEqual({ over: 0, rest: 0 });
  });
  it("rejects targets below what the ledger already shows", () => {
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 1300_00, 10_00)).toEqual({ error: "OVERDUE_TOO_LOW" });
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 300_00, 60_00)).toEqual({ error: "BALANCE_TOO_LOW" });
    expect(planAdjustment({ balance: 410_00, overdue: 60_00 }, 100_00, 200_00)).toEqual({ error: "OVERDUE_GT_BALANCE" });
  });
});
