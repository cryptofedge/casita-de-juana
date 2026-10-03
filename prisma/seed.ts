/**
 * Demo data: 1 owner, 3 tenants (Apt 1, 2A, 2B), leases, rent + electricity
 * history, payments, maintenance tickets, notices, contacts and documents.
 *
 *   npm run db:seed
 *
 * WARNING: this wipes every table first. It is meant for development/demo.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type Currency, type PaymentMethod } from "@prisma/client";
import { addDays, addMonths, currentPeriod, dueDateFor, fmtPeriod, periodStart, todayLocal } from "../src/lib/dates";
import { runBilling } from "../src/lib/billing";

const db = new PrismaClient();

/** Smallest valid single-page PDF containing a line of text (placeholder documents). */
function tinyPdf(text: string) {
  const safe = text.replace(/[()\\]/g, "");
  const stream = `BT /F1 20 Tf 60 740 Td (${safe}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => (out += `${String(o).padStart(10, "0")} 00000 n \n`));
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

async function pdfAsset(title: string, filename: string, ownerId: string) {
  const buf = tinyPdf(`${title} - sample document`);
  return db.fileAsset.create({
    data: { data: new Uint8Array(buf), filename, mime: "application/pdf", size: buf.length, uploadedBy: ownerId },
  });
}

async function wipe() {
  await db.ticketAttachment.deleteMany();
  await db.ticketMessage.deleteMany();
  await db.ticket.deleteMany();
  await db.meterReading.deleteMany();
  await db.paymentSubmission.deleteMany();
  await db.payment.deleteMany();
  await db.charge.deleteMany();
  await db.document.deleteMany();
  await db.fileAsset.deleteMany();
  await db.announcement.deleteMany();
  await db.contact.deleteMany();
  await db.lease.deleteMany();
  await db.unit.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();
}

interface Scenario {
  label: string;
  floor: number;
  bedrooms: number;
  tenant: { name: string; email: string; phone: string };
  currency: Currency;
  rent: number; // major units
  ratePerKwh: number; // major units, lease currency
  method: PaymentMethod;
  baseKwh: number;
  monthlyKwh: number[]; // oldest -> newest usage
  /** how far the tenant is paid up */
  paid: "UP_TO_DATE" | "PARTIAL_CURRENT" | "ONE_MONTH_BEHIND";
}

const SCENARIOS: Scenario[] = [
  {
    label: "1", floor: 1, bedrooms: 2,
    tenant: { name: "Carlos Peña", email: "carlos.pena@example.com", phone: "+1 809 555 0111" },
    currency: "USD", rent: 450, ratePerKwh: 0.22, method: "BANK_TRANSFER",
    baseKwh: 12040, monthlyKwh: [182, 171, 205, 198, 190], paid: "UP_TO_DATE",
  },
  {
    label: "2A", floor: 2, bedrooms: 1,
    tenant: { name: "María Santos", email: "maria.santos@example.com", phone: "+1 809 555 0122" },
    currency: "DOP", rent: 18000, ratePerKwh: 14.5, method: "CASH",
    baseKwh: 8310, monthlyKwh: [140, 152, 131, 160, 149], paid: "PARTIAL_CURRENT",
  },
  {
    label: "2B", floor: 2, bedrooms: 1,
    tenant: { name: "James Wilson", email: "james.wilson@example.com", phone: "+1 809 555 0133" },
    currency: "USD", rent: 400, ratePerKwh: 0.22, method: "PAYPAL",
    baseKwh: 5120, monthlyKwh: [120, 133, 128, 141, 150], paid: "ONE_MONTH_BEHIND",
  },
];

async function main() {
  await wipe();
  const today = todayLocal();
  const nowP = currentPeriod();
  const firstP = addMonths(nowP, -5);

  const ownerPw = await bcrypt.hash(process.env.SEED_OWNER_PASSWORD || "Owner#2026", 12);
  const tenantPw = await bcrypt.hash(process.env.SEED_TENANT_PASSWORD || "Tenant#2026", 12);

  const owner = await db.user.create({
    data: { name: "Juana Rodríguez", email: "owner@casitadejuana.test", phone: "+1 809 555 0100", role: "OWNER", passwordHash: ownerPw },
  });

  await db.setting.createMany({
    data: [
      { key: "usdDopRate", value: "60" },
      { key: "propertyName", value: "Casita de Juana" },
      { key: "propertyAddress", value: "Ortega, Dominican Republic" },
      { key: "ownerPhone", value: "+1 809 555 0100" },
    ],
  });

  const houseRules = await pdfAsset("House Rules", "house-rules.pdf", owner.id);
  await db.document.create({ data: { title: "House rules & quiet hours", type: "HOUSE_RULES", fileId: houseRules.id } });

  for (const s of SCENARIOS) {
    const unit = await db.unit.create({ data: { label: s.label, floor: s.floor, bedrooms: s.bedrooms } });
    const tenant = await db.user.create({
      data: { ...s.tenant, role: "TENANT", passwordHash: tenantPw },
    });
    const major = (n: number) => Math.round(n * 100);
    const lease = await db.lease.create({
      data: {
        unitId: unit.id, tenantId: tenant.id,
        startDate: periodStart(firstP), monthlyRent: major(s.rent), currency: s.currency,
        dueDay: 1, graceDays: 5,
        lateFeeFlat: major(s.currency === "USD" ? 10 : 600), lateFeePercent: 0,
        deposit: major(s.rent),
      },
    });

    const leasePdf = await pdfAsset(`Lease Apt ${s.label}`, `lease-apt-${s.label}.pdf`, owner.id);
    await db.document.create({ data: { title: `Lease agreement - Apt ${s.label}`, type: "LEASE", fileId: leasePdf.id, tenantId: tenant.id } });

    // Charges (created "on time" so late fees apply naturally to the overdue ones)
    type C = { id: string; amount: number; dueDate: Date };
    const charges: C[] = [];
    let kwh = s.baseKwh;
    for (let i = 0; i < 6; i++) {
      const p = addMonths(firstP, i);
      const due = dueDateFor(p, 1);
      const rent = await db.charge.create({
        data: { leaseId: lease.id, type: "RENT", period: p, description: `Rent - ${fmtPeriod(p)}`, amount: lease.monthlyRent, dueDate: due, key: `rent:${lease.id}:${p}`, createdAt: due },
      });
      charges.push(rent);

      // Electricity for completed months only (billed on the 10th of the next month)
      if (p < nowP) {
        const used = s.monthlyKwh[i];
        const subtotal = Math.round(used * s.ratePerKwh * 100);
        const elecDue = addDays(dueDateFor(addMonths(p, 1), 1), 9);
        const readingDate = addDays(periodStart(addMonths(p, 1)), 0);
        const charge = await db.charge.create({
          data: {
            leaseId: lease.id, type: "ELECTRICITY", period: p,
            description: `Electricity - ${fmtPeriod(p)} (${used} kWh)`,
            amount: subtotal, dueDate: elecDue, key: `elec:${unit.id}:${p}`, createdAt: readingDate,
          },
        });
        await db.meterReading.create({
          data: {
            unitId: unit.id, period: p, previousKwh: kwh, currentKwh: kwh + used, ratePerKwh: s.ratePerKwh,
            currency: s.currency, subtotal, dueDate: elecDue, readingDate, chargeId: charge.id,
          },
        });
        kwh += used;
        charges.push(charge);
      }
    }

    // Payments
    const sorted = [...charges].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    const currentRentDue = dueDateFor(nowP, 1);
    const lastRentDue = dueDateFor(addMonths(nowP, -1), 1);
    let n = 0;
    for (const c of sorted) {
      let amount = 0;
      if (s.paid === "UP_TO_DATE" && c.dueDate <= today) amount = c.amount;
      if (s.paid === "PARTIAL_CURRENT") {
        if (c.dueDate < currentRentDue) amount = c.amount;
        else if (c.dueDate.getTime() === currentRentDue.getTime()) amount = Math.round(c.amount / 2);
      }
      if (s.paid === "ONE_MONTH_BEHIND" && c.dueDate < lastRentDue) amount = c.amount;
      if (amount <= 0) continue;
      const paidAt = new Date(Math.min(addDays(c.dueDate, (n++ % 3) + 1).getTime(), today.getTime()));
      await db.payment.create({
        data: {
          leaseId: lease.id, amount, method: s.method, paidAt,
          reference: s.method === "BANK_TRANSFER" ? `TRX-${1000 + n}` : null,
          note: amount < c.amount ? "Partial payment - balance to follow" : null,
          recordedBy: owner.id,
        },
      });
    }
  }

  // Maintenance
  const units = Object.fromEntries((await db.unit.findMany()).map((u) => [u.label, u]));
  const tenants = Object.fromEntries((await db.user.findMany({ where: { role: "TENANT" } })).map((u) => [u.email, u]));
  const ago = (d: number) => new Date(Date.now() - d * 86_400_000);

  const t1 = await db.ticket.create({
    data: {
      unitId: units["1"].id, createdById: tenants["carlos.pena@example.com"].id, category: "PLUMBING", priority: "MEDIUM",
      status: "IN_PROGRESS", title: "Kitchen faucet is dripping", description: "The kitchen faucet drips constantly even when fully closed. It started last week and the drip is getting faster.",
      createdAt: ago(4),
    },
  });
  await db.ticketMessage.createMany({
    data: [
      { ticketId: t1.id, authorId: owner.id, body: "Thanks Carlos - my plumber will come by Thursday morning. Will someone be home?", createdAt: ago(3) },
      { ticketId: t1.id, authorId: tenants["carlos.pena@example.com"].id, body: "Yes, I work from home on Thursday. Any time after 9 works.", createdAt: ago(3) },
    ],
  });
  await db.ticket.create({
    data: {
      unitId: units["2B"].id, createdById: tenants["james.wilson@example.com"].id, category: "ELECTRICAL", priority: "URGENT",
      status: "OPEN", title: "Bedroom outlet sparks when plugging in", description: "The outlet next to the bed sparks and smells slightly burnt. I stopped using it. Please check as soon as possible.",
      createdAt: ago(1),
    },
  });
  await db.ticket.create({
    data: {
      unitId: units["2A"].id, createdById: tenants["maria.santos@example.com"].id, category: "IMPROVEMENT_IDEA", priority: "LOW",
      status: "OPEN", title: "Motion light for the stairs", description: "It gets very dark on the stairs at night. A motion-sensor light would make it safer for everyone.",
      createdAt: ago(6),
    },
  });
  const t4 = await db.ticket.create({
    data: {
      unitId: units["1"].id, createdById: tenants["carlos.pena@example.com"].id, category: "STRUCTURAL", priority: "LOW",
      status: "RESOLVED", title: "Patio door sticks", description: "The patio door is hard to slide, especially after rain.", createdAt: ago(25),
    },
  });
  await db.ticketMessage.create({
    data: { ticketId: t4.id, authorId: owner.id, body: "Rail cleaned and lubricated. Let me know if it sticks again!", createdAt: ago(22) },
  });

  // Notice board
  await db.announcement.createMany({
    data: [
      { title: "Water shut-off this Saturday, 9am - 1pm", body: "The municipal water supply will be interrupted for pipe maintenance. Please store water in advance. Thanks for your patience!", pinned: true, authorId: owner.id, createdAt: ago(1) },
      { title: "Fumigation day", body: "The whole building will be fumigated next month. Details to follow. Please keep pets and food covered on that day.", pinned: false, authorId: owner.id, createdAt: ago(5) },
      { title: "Quiet hours reminder", body: "Quiet hours are 10pm - 7am. Please be considerate of your neighbours.", pinned: false, authorId: owner.id, createdAt: ago(20) },
    ],
  });

  // Contacts - 911 is the national emergency number; the rest are placeholders for the owner to replace.
  await db.contact.createMany({
    data: [
      { name: "Emergency services (911)", role: "Police, ambulance, fire", category: "EMERGENCY", phone: "911", sortOrder: 0 },
      { name: "Trusted plumber", role: "Plumbing", category: "PLUMBER", phone: "+1 809 555 0101", notes: "Placeholder number - update in Admin > Emergency Contacts", sortOrder: 1 },
      { name: "Trusted electrician", role: "Electrical", category: "ELECTRICIAN", phone: "+1 809 555 0102", notes: "Placeholder number - update in Admin > Emergency Contacts", sortOrder: 2 },
      { name: "Juana (owner)", role: "Landlord", category: "OTHER", phone: "+1 809 555 0100", sortOrder: 3 },
    ],
  });

  const r = await runBilling();
  console.log("Seed complete.", r);
  console.log("Owner:  owner@casitadejuana.test");
  console.log("Tenants: carlos.pena@example.com (Apt 1), maria.santos@example.com (Apt 2A), james.wilson@example.com (Apt 2B)");
  console.log("Passwords come from SEED_OWNER_PASSWORD / SEED_TENANT_PASSWORD in .env");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
