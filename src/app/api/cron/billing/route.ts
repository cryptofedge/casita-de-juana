import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runBilling } from "@/lib/billing";
import { refreshRateIfAuto } from "@/lib/rate";

export const dynamic = "force-dynamic";

/**
 * Daily job: generates monthly rent, applies late fees, and refreshes the USD/DOP rate (unless the owner turned that off).
 * Call with:  Authorization: Bearer $CRON_SECRET   (e.g. Vercel Cron, GitHub Actions, crontab + curl)
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok =
    !!secret &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return new NextResponse("Unauthorized", { status: 401 });
  const billing = await runBilling();
  const rate = await refreshRateIfAuto();
  return NextResponse.json({ billing, rate });
}
