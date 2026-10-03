import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Megaphone, Phone, Pin, PlusCircle, Zap } from "lucide-react";
import { db } from "@/lib/db";
import { getLeaseLedger, runBillingThrottled } from "@/lib/billing";
import { fmtDate, todayLocal } from "@/lib/dates";
import { getI18n } from "@/lib/i18n/server";
import { chargeLabel } from "@/lib/i18n/charge-label";
import { PAYMENT_STATUS_LABEL } from "@/lib/labels";
import { moneyFormatter } from "@/lib/money";
import { getMoneyContext } from "@/lib/settings";
import { requireTenant } from "@/lib/session";
import { PaymentStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/page";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("Home") };
}
export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const { user, lease } = await requireTenant();
  const { t, locale } = await getI18n();
  if (!lease) {
    return <EmptyState title={t("No active lease")}>{t("Your account is not linked to a unit right now. Please contact the owner.")}</EmptyState>;
  }
  await runBillingThrottled();
  const { display, rate } = await getMoneyContext(lease.currency);
  const m = moneyFormatter(display, rate);
  const { ledger } = await getLeaseLedger(lease.id);

  const now = new Date();
  const [notices, openTickets] = await Promise.all([
    db.announcement.findMany({
      where: { OR: [{ expiresAt: null }, { expiresAt: { gte: todayLocal(now) } }] },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 4,
    }),
    db.ticket.count({ where: { createdById: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
  ]);

  const unpaid = ledger.rows.filter((r) => r.remaining > 0);
  const next = unpaid[0];
  const owes = ledger.balance > 0;
  const hasOverdue = ledger.overdue > 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t("Hola, {name} 👋", { name: user.name.split(" ")[0] })}</h1>
        <p className="text-sm text-muted-foreground">{t("Welcome to your home at Casita de Juana.")}</p>
      </div>

      {notices.filter((n) => n.pinned).map((n) => (
        <Link key={n.id} href="/portal/notices" className="block rounded-xl border border-gold/50 bg-warning-soft p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#8a5a00]"><Pin className="size-4" /> {t("Pinned notice")}</div>
          <div className="mt-1 font-display text-lg font-semibold">{n.title}</div>
          <p className="line-clamp-2 text-sm">{n.body}</p>
        </Link>
      ))}

      <Card className={`p-5 ${hasOverdue ? "border-destructive/40" : ""}`}>
        <div className="text-sm text-muted-foreground">{owes ? t("Balance due") : ledger.balance < 0 ? t("Credit on your account") : t("Your balance")}</div>
        <div className={`font-display text-4xl font-semibold ${hasOverdue ? "text-destructive" : owes ? "text-foreground" : "text-success"}`}>
          {m(Math.abs(ledger.balance), lease.currency)}
        </div>
        {!owes && ledger.balance === 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-sm font-medium text-success"><CheckCircle2 className="size-4" /> {t("You're all paid up")}</div>
        )}
        {hasOverdue && <div className="mt-1 text-sm font-medium text-destructive">{t("{amount} is overdue", { amount: m(ledger.overdue, lease.currency) })}</div>}
        {next && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{chargeLabel(next, t, locale)}</div>
              <div className="text-xs text-muted-foreground">{t("Due {date} · {amount} left", { date: fmtDate(next.dueDate, locale), amount: m(next.remaining, lease.currency) })}</div>
            </div>
            <PaymentStatusBadge status={next.status} label={t(PAYMENT_STATUS_LABEL[next.status])} />
          </div>
        )}
        <Link href="/portal/payments" className="mt-3 inline-block text-sm font-semibold text-primary">{t("View rent & payment history →")}</Link>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/portal/requests/new" className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm font-semibold shadow-sm active:bg-secondary">
          <PlusCircle className="size-7 text-accent" /> {t("Report a problem")}
          {openTickets > 0 && <span className="text-xs font-normal text-muted-foreground">{t("{n} open", { n: openTickets })}</span>}
        </Link>
        <Link href="/portal/electricity" className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm font-semibold shadow-sm active:bg-secondary">
          <Zap className="size-7 text-gold" /> {t("Electricity bill")}
        </Link>
        <Link href="/portal/contacts" className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm font-semibold shadow-sm active:bg-secondary">
          <Phone className="size-7 text-destructive" /> {t("Emergency numbers")}
        </Link>
        <Link href="/portal/notices" className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm font-semibold shadow-sm active:bg-secondary">
          <Megaphone className="size-7 text-primary" /> {t("Notice board")}
        </Link>
      </div>

      {notices.filter((n) => !n.pinned).length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{t("Latest news")}</h2>
          <div className="space-y-2">
            {notices.filter((n) => !n.pinned).slice(0, 2).map((n) => (
              <Card key={n.id} className="p-4">
                <div className="font-semibold">{n.title}</div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                <div className="mt-1 text-xs text-muted-foreground">{fmtDate(n.createdAt, locale)}</div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
