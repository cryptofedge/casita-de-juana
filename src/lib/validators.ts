import { z } from "zod";

// All form fields are strings (what an <input> produces); server actions
// convert them (e.g. toMinor) after validation. One schema serves the client
// (react-hook-form) and the server action.

export const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter an amount like 125.00");
export const moneyPositive = money.refine((v) => parseFloat(v) > 0, "Must be greater than 0");
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const periodStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month");
const intStr = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/, "Whole number")
    .refine((v) => +v >= min && +v <= max, `Between ${min} and ${max}`);
const decimalStr = z.string().trim().regex(/^\d+(\.\d+)?$/, "Enter a number");
const currency = z.enum(["USD", "DOP"]);
const optional = (max = 500) => z.string().trim().max(max).optional().or(z.literal(""));

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(1, "Enter your password"),
});

export const acceptInviteSchema = z
  .object({
    password: z.string().min(8, "At least 8 characters").max(100),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const setupSchema = z
  .object({
    code: z.string().trim().min(1, "Enter the setup code"),
    name: z.string().trim().min(2, "Required").max(100),
    email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
    password: z.string().min(10, "At least 10 characters").max(100),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(8, "At least 8 characters").max(100),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const unitSchema = z.object({
  label: z.string().trim().min(1, "Required").max(10),
  floor: intStr(1, 99),
  bedrooms: intStr(0, 20),
  notes: optional(),
});

export const inviteTenantSchema = z.object({
  name: z.string().trim().min(2, "Required").max(100),
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  phone: optional(40),
  unitId: z.string().min(1, "Choose a unit"),
  startDate: dateStr,
  monthlyRent: moneyPositive,
  currency,
  dueDay: intStr(1, 28),
  graceDays: intStr(0, 30),
  lateFeeFlat: money,
  lateFeePercent: decimalStr,
  deposit: money,
});

export const leaseUpdateSchema = inviteTenantSchema
  .pick({
    startDate: true,
    monthlyRent: true,
    currency: true,
    dueDay: true,
    graceDays: true,
    lateFeeFlat: true,
    lateFeePercent: true,
    deposit: true,
  })
  .extend({ leaseId: z.string().min(1), endDate: z.union([dateStr, z.literal("")]).optional() });

export const paymentSchema = z.object({
  leaseId: z.string().min(1, "Choose a unit"),
  amount: moneyPositive,
  method: z.enum(["CASH", "BANK_TRANSFER", "ZELLE", "PAYPAL", "STRIPE"]),
  paidAt: dateStr,
  chargeId: z.string().optional(),
  reference: optional(120),
  note: optional(300),
});

export const depositSchema = z.object({ leaseId: z.string().min(1), deposit: money });

export const adjustBalanceSchema = z.object({
  leaseId: z.string().min(1),
  balance: money,
  overdue: money,
});

export const submissionSchema = z.object({
  amount: moneyPositive,
  method: z.enum(["CASH", "BANK_TRANSFER", "ZELLE", "PAYPAL", "STRIPE"]),
  paidAt: dateStr,
  applyTo: z.enum(["BALANCE", "OVERDUE"]),
  reference: optional(120),
  note: optional(300),
});

export const approveSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  amount: moneyPositive,
  method: z.enum(["CASH", "BANK_TRANSFER", "ZELLE", "PAYPAL", "STRIPE"]),
  paidAt: dateStr,
  chargeId: z.string().optional(),
});

export const rejectSubmissionSchema = z.object({
  submissionId: z.string().min(1),
  reason: optional(300),
});

export const edenorteBillSchema = z.object({
  period: periodStr,
  kwh: decimalStr,
  amount: money,
  dueDate: z.union([dateStr, z.literal("")]).optional(),
});

export const nicSchema = z.object({
  nic: z
    .string()
    .trim()
    .max(30, "Too long")
    .regex(/^[A-Za-z0-9\- ]*$/, "Use only letters, numbers and hyphens"),
});

export const chargeSchema = z.object({
  leaseId: z.string().min(1, "Choose a unit"),
  description: z.string().trim().min(2, "Required").max(120),
  amount: moneyPositive,
  dueDate: dateStr,
});

export const meterReadingSchema = z
  .object({
    unitId: z.string().min(1, "Choose a unit"),
    period: periodStr,
    previousKwh: decimalStr,
    currentKwh: decimalStr,
    ratePerKwh: decimalStr,
    dueDate: dateStr,
  })
  .refine((v) => parseFloat(v.currentKwh) >= parseFloat(v.previousKwh), {
    path: ["currentKwh"],
    message: "Must be at least the previous reading",
  });

export const ticketSchema = z.object({
  category: z.enum(["PLUMBING", "ELECTRICAL", "STRUCTURAL", "COMPLAINT", "IMPROVEMENT_IDEA"]),
  priority: z.enum(["LOW", "MEDIUM", "URGENT"]),
  title: z.string().trim().min(3, "Give it a short title").max(120),
  description: z.string().trim().min(5, "Tell us a bit more").max(4000),
});

export const messageSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(1, "Write a message").max(4000),
});

export const ticketStatusSchema = z.object({
  ticketId: z.string().min(1),
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3, "Required").max(140),
  body: z.string().trim().min(3, "Required").max(4000),
  pinned: z.boolean(),
  expiresAt: z.union([dateStr, z.literal("")]).optional(),
});

export const documentSchema = z.object({
  title: z.string().trim().min(2, "Required").max(140),
  type: z.enum(["LEASE", "HOUSE_RULES", "ID", "OTHER"]),
  tenantId: z.string(), // "" = shared with all tenants
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Required").max(100),
  role: optional(100),
  category: z.enum(["EMERGENCY", "PLUMBER", "ELECTRICIAN", "OTHER"]),
  phone: z.string().trim().min(3, "Required").max(40),
  notes: optional(300),
});

export const settingsSchema = z.object({
  usdDopRate: decimalStr.refine((v) => parseFloat(v) > 0, "Must be greater than 0"),
  propertyName: z.string().trim().min(2).max(100),
  propertyAddress: z.string().trim().max(200),
  ownerPhone: z.string().trim().max(40),
});

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function fail(error: string, fieldErrors?: Record<string, string[] | undefined>): ActionResult {
  return { ok: false, error, fieldErrors };
}
