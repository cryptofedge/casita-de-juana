import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runBilling } from "@/lib/billing";

export const dynamic = "force-dynamic";

/**
 * Daily job: generates monthly rent and applies late fees.
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
  return NextResponse.json(await runBilling());
}
