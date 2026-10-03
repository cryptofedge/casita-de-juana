import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { readFileAsset } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Authenticated file access. Owners can open anything; a tenant can only open
 * files attached to their own lease/unit/tickets or documents shared with them.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const file = await db.fileAsset.findUnique({ where: { id } });
  if (!file) return new NextResponse("Not found", { status: 404 });

  if (user.role === "TENANT") {
    const lease = await db.lease.findFirst({
      where: { tenantId: user.id, active: true },
      select: { id: true, unitId: true },
    });
    const allowed = await db.fileAsset.count({
      where: {
        id,
        OR: [
          ...(lease
            ? [
                { payments: { some: { leaseId: lease.id } } },
                { readings: { some: { unitId: lease.unitId } } },
                { submissions: { some: { leaseId: lease.id } } },
              ]
            : []),
          { attachments: { some: { ticket: { createdById: user.id } } } },
          {
            documents: {
              some: { OR: [{ tenantId: user.id }, { tenantId: null, type: { not: "ID" } }] },
            },
          },
        ],
      },
    });
    if (!allowed) return new NextResponse("Not found", { status: 404 });
  }

  const full = await readFileAsset(id);
  if (!full?.data) return new NextResponse("File missing", { status: 404 });
  const data = full.data;

  const download = new URL(req.url).searchParams.get("download") === "1";
  const safeName = encodeURIComponent(file.filename);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": file.mime,
      "Content-Length": String(data.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${safeName}`,
      "X-Content-Type-Options": "nosniff",
      // Never cache: IDs/receipts must not be re-openable from a shared device after sign-out.
      "Cache-Control": "private, no-store",
    },
  });
}
