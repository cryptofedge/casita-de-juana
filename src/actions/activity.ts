"use server";

import { revalidatePath } from "next/cache";
import { markActivitySeen } from "@/lib/activity";
import { assertOwner } from "@/lib/session";
import type { ActionResult } from "@/lib/validators";

/** Owner: clear the "What's new" list on the dashboard. */
export async function markActivitySeenAction(): Promise<ActionResult> {
  await assertOwner();
  await markActivitySeen();
  revalidatePath("/admin", "layout");
  return { ok: true };
}
