"use client";

import * as React from "react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { PAYMENT_STATUS_LABEL, PRIORITY_LABEL, STATUS_LABEL } from "@/lib/labels";

const tones = {
  green: "bg-success-soft text-success",
  amber: "bg-warning-soft text-[#8a5a00]",
  red: "bg-destructive-soft text-destructive",
  teal: "bg-info-soft text-primary",
  gray: "bg-muted text-muted-foreground",
  clay: "bg-[#f7e1d8] text-accent",
} as const;

export type Tone = keyof typeof tones;

export function Badge({
  tone = "gray",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}
      {...props}
    />
  );
}

const PAY_TONE: Record<string, Tone> = { PAID: "green", PENDING: "amber", PARTIAL: "teal", OVERDUE: "red" };
export function PaymentStatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useT();
  return <Badge tone={PAY_TONE[status] ?? "gray"}>{label ?? t(PAYMENT_STATUS_LABEL[status] ?? status)}</Badge>;
}

const TICKET_TONE: Record<string, Tone> = { OPEN: "amber", IN_PROGRESS: "teal", RESOLVED: "green", CLOSED: "gray" };
export function TicketStatusBadge({ status, label }: { status: string; label?: string }) {
  const { t } = useT();
  return <Badge tone={TICKET_TONE[status] ?? "gray"}>{label ?? t(STATUS_LABEL[status] ?? status)}</Badge>;
}

const PRIO_TONE: Record<string, Tone> = { LOW: "gray", MEDIUM: "amber", URGENT: "red" };
export function PriorityBadge({ priority, label }: { priority: string; label?: string }) {
  const { t } = useT();
  return <Badge tone={PRIO_TONE[priority] ?? "gray"}>{label ?? t(PRIORITY_LABEL[priority] ?? priority)}</Badge>;
}
