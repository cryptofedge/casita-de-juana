import { z } from "zod";
import { fail, type ActionResult } from "./validators";

/** Validates FormData against a zod schema; returns data or a ready-to-return failure. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  fd: FormData,
  opts: { booleans?: string[] } = {},
): { ok: true; data: z.infer<S> } | { ok: false; result: ActionResult } {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string") obj[k] = opts.booleans?.includes(k) ? v === "true" : v;
  }
  const parsed = schema.safeParse(obj);
  if (parsed.success) return { ok: true, data: parsed.data };
  const flat = z.flattenError(parsed.error as z.ZodError<Record<string, unknown>>);
  return {
    ok: false,
    result: fail("Please fix the highlighted fields.", flat.fieldErrors as Record<string, string[]>),
  };
}

export function getFiles(fd: FormData, name: string): File[] {
  return fd.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);
}

export function getFile(fd: FormData, name: string): File | null {
  return getFiles(fd, name)[0] ?? null;
}
