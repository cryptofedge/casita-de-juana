import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import type { Metadata } from "next";
import {
  AlertTriangle,
  Building2,
  Wallet,
  Wrench,
  TrendingUp,
} from "lucide-react";
import { db } from "@/lib/db";
import { runBillingThrottled } from "@/lib/billing";
import {
  addMonths,
  currentPeriod,
  fmtDate,
  fmtPeriod,
  periodEnd,
  periodStart,
  todayLocal,
} from "@/lib/dates";
import { buildLedger } from "@/lib/ledger";
import { convert, moneyFormatter } from "@/lib/money";
import { CATEGORY_LABEL } from "@/lib/labels";
import { getMoneyContext } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PaymentStatusBadge,
  PriorityBadge,
  TicketStatusBadge,
} from "@/components/ui/badge";
import { EmptyState, PageHeader, Stat } from "@/components/shared/page";
import { ActionButton } from "@/components/forms/action-button";
import { markActivitySeenAction } from "@/actions/activity";
import { getNewActivity } from "@/lib/activity";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Dashboard") };
}
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { t: tr, locale } = await getI18n();
  await runBillingThrottled();
  const { display, rate } = await getMoneyContext();
  const m = moneyFormatter(display, rate);
  const today = todayLocal();
  const nowP = currentPeriod();

  const news = await getNewActivity();
  const waitingProofs = await db.paymentSubmission.count({
    where: { status: "PENDING" },
  });
  const [units, leases, tickets, recentPayments] = await Promise.all([
    db.unit.findMany({
      where: { active: true },
      orderBy: [{ floor: "asc" }, { label: "asc" }],
    }),
    db.lease.findMany({
      where: { active: true },
      include: { tenant: true, charges: true, payments: true },
    }),
    db.ticket.findMany({
      where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      include: { unit: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    db.payment.findMany({
      where: { paidAt: { gte: periodStart(addMonths(nowP, -5)) } },
      include: { lease: true },
    }),
  ]);

  const cv = (amt: number, cur: "USD" | "DOP") =>
    convert(amt, cur, display, rate);
  const ledgers = leases.map((l) => ({
    lease: l,
    ledger: buildLedger(l.charges, l.payments, today, l.graceDays),
  }));

  const collectedThisMonth = recentPayments
    .filter((p) => p.paidAt >= periodStart(nowP) && p.paidAt < periodEnd(nowP))
    .reduce((s, p) => s + cv(p.amount, p.lease.currency), 0);
  const outstanding = ledgers.reduce(
    (s, x) => s + Math.max(0, cv(x.ledger.balance, x.lease.currency)),
    0,
  );
  const overdue = ledgers.reduce(
    (s, x) => s + cv(x.ledger.overdue, x.lease.currency),
    0,
  );
  const expectedRent = leases.reduce(
    (s, l) => s + cv(l.monthlyRent, l.currency),
    0,
  );
  const occupied = new Set(leases.map((l) => l.unitId)).size;
  const occupancy = units.length
    ? Math.round((occupied / units.length) * 100)
    : 0;
  const urgent = tickets.filter((t) => t.priority === "URGENT").length;

  // Collected per month, last 6 months
  const months = Array.from({ length: 6 }, (_, i) => addMonths(nowP, i - 5));
  const series = months.map((p) => ({
    p,
    total: recentPayments
      .filter((x) => x.paidAt >= periodStart(p) && x.paidAt < periodEnd(p))
      .reduce((s, x) => s + cv(x.amount, x.lease.currency), 0),
  }));
  const max = Math.max(1, ...series.map((s) => s.total));

  const leaseByUnit = new Map(ledgers.map((x) => [x.lease.unitId, x]));

  return (
    <>
      <PageHeader
        title={tr("Dashboard")}
        description={tr("{period} · amounts shown in {cur}", {
          period: fmtPeriod(nowP, locale),
          cur: display,
        })}
      />

      {waitingProofs > 0 && (
        <Link
          href="/admin/finance"
          className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gold/60 bg-warning-soft px-4 py-3 text-sm font-semibold"
        >
          <span>
            {tr("{n} payment(s) waiting for your approval", {
              n: waitingProofs,
            })}
          </span>
          <span className="text-primary">{tr("Review")} →</span>
        </Link>
      )}

      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>{tr("What's new")}</CardTitle>
          {news.length > 0 && (
            <ActionButton
              size="sm"
              variant="outline"
              action={markActivitySeenAction}
            >
              {tr("Mark all as seen")}
            </ActionButton>
          )}
        </CardHeader>
        <CardContent>
          {news.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {tr(
                "Nothing new. Tenant requests, messages, payment proofs and bills will show up here.",
              )}
            </p>
          )}
          <ul className="divide-y text-sm">
            {news.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className="flex items-start justify-between gap-3 py-2 hover:underline"
                >
                  <span>
                    <span className="font-semibold">{n.who}</span> (
                    {tr("Apt {unit}", { unit: n.unit })}){" "}
                    {n.kind === "ticket" &&
                      tr("sent a maintenance request: {title}", {
                        title: n.detail,
                      })}
                    {n.kind === "message" &&
                      tr("replied on: {title}", { title: n.detail })}
                    {n.kind === "proof" &&
                      tr("sent a payment proof to approve")}
                    {n.kind === "bill" &&
                      tr("logged an Edenorte bill for {period}", {
                        period: n.detail,
                      })}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {fmtDate(n.at, locale)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label={tr("Collected this month")}
          value={m(collectedThisMonth, display)}
          sub={tr("of {amount} monthly rent", {
            amount: m(expectedRent, display),
          })}
          tone="good"
          icon={<Wallet className="size-4" />}
        />
        <Stat
          label={tr("Outstanding balance")}
          value={m(outstanding, display)}
          sub={
            overdue > 0
              ? tr("{amount} overdue", { amount: m(overdue, display) })
              : tr("Nothing overdue")
          }
          tone={overdue > 0 ? "bad" : "default"}
          icon={<AlertTriangle className="size-4" />}
        />
        <Stat
          label={tr("Active maintenance")}
          value={tickets.length}
          sub={urgent ? tr("{n} urgent", { n: urgent }) : tr("None urgent")}
          tone={urgent ? "warn" : "default"}
          icon={<Wrench className="size-4" />}
        />
        <Stat
          label={tr("Occupancy")}
          value={`${occupancy}%`}
          sub={tr("{a} of {b} units rented", { a: occupied, b: units.length })}
          icon={<Building2 className="size-4" />}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="lg:col-span-3">
          <h2 className="mb-3 text-lg font-semibold">{tr("Units")}</h2>
          <div className="space-y-3">
            {units.map((u) => {
              const x = leaseByUnit.get(u.id);
              // Worst open status wins: an overdue charge beats this month's "pending".
              const rentRow =
                x?.ledger.rows.find((r) => r.status === "OVERDUE") ??
                x?.ledger.rows.find(
                  (r) => r.type === "RENT" && r.period === nowP,
                );
              const open = x ? cv(x.ledger.balance, x.lease.currency) : 0;
              return (
                <Card key={u.id} className="flex items-center gap-4 p-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-info-soft font-display text-lg font-semibold text-primary">
                    {u.label}
                  </div>
                  <div className="min-w-0 flex-1">
                    {x ? (
                      <>
                        <Link
                          href={`/admin/tenants/${x.lease.tenantId}`}
                          className="font-semibold hover:underline"
                        >
                          {x.lease.tenant.name}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {tr("{amount}/mo · due day {day}", {
                            amount: m(x.lease.monthlyRent, x.lease.currency),
                            day: x.lease.dueDay,
                          })}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="font-semibold">{tr("Vacant")}</div>
                        <Link
                          href="/admin/tenants"
                          className="text-sm text-primary hover:underline"
                        >
                          {tr("Invite a tenant")}
                        </Link>
                      </>
                    )}
                  </div>
                  {x && (
                    <div className="text-right">
                      {rentRow && (
                        <PaymentStatusBadge status={rentRow.status} />
                      )}
                      <div
                        className={`mt-1 text-sm font-semibold ${open > 0 ? "text-destructive" : "text-success"}`}
                      >
                        {open > 0
                          ? tr("{amount} due", { amount: m(open, display) })
                          : open < 0
                            ? tr("{amount} credit", {
                                amount: m(-open, display),
                              })
                            : tr("Settled")}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />{" "}
                {tr("Collected, last 6 months")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="flex h-40 items-end gap-2"
                role="img"
                aria-label={tr("Bar chart of payments collected per month")}
              >
                {series.map((s) => (
                  <div
                    key={s.p}
                    className="flex flex-1 flex-col items-center gap-1"
                  >
                    <div className="text-[10px] font-medium text-muted-foreground">
                      {s.total
                        ? m(s.total, display).replace(/\.\d\d$/, "")
                        : ""}
                    </div>
                    <div
                      className="w-full rounded-t-md bg-primary/80"
                      style={{
                        height: `${Math.max(2, (s.total / max) * 100)}px`,
                      }}
                    />
                    <div className="text-[11px] text-muted-foreground">
                      {fmtPeriod(s.p, locale).slice(0, 3)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {tr("Open maintenance requests")}
          </h2>
          <Link
            href="/admin/maintenance"
            className="text-sm font-medium text-primary hover:underline"
          >
            {tr("View all")}
          </Link>
        </div>
        {tickets.length === 0 ? (
          <EmptyState title={tr("All clear")}>
            {tr("No open requests.")}
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {tickets.slice(0, 6).map((t) => (
              <Link key={t.id} href={`/admin/maintenance/${t.id}`}>
                <Card className="p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold">{t.title}</div>
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {tr("Apt {unit}", { unit: t.unit.label })} ·{" "}
                    {tr(CATEGORY_LABEL[t.category])} ·{" "}
                    {fmtDate(t.createdAt, locale)}
                  </div>
                  <div className="mt-2">
                    <TicketStatusBadge status={t.status} />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
