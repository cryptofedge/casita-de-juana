import { db } from "./db";
import { setSetting } from "./settings";

const SOURCE = "https://open.er-api.com/v6/latest/USD"; // free, no key

/** Today's market rate: DOP per 1 USD. Throws if the service cannot be reached or answers oddly. */
export async function fetchUsdDopRate(): Promise<number> {
  const res = await fetch(SOURCE, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`rate service answered ${res.status}`);
  const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
  const rate = json.rates?.DOP;
  if (json.result !== "success" || typeof rate !== "number" || !(rate > 10 && rate < 500)) throw new Error("rate service returned an unexpected value");
  return Math.round(rate * 100) / 100;
}

/** Saves today's rate and when it was fetched. */
export async function refreshUsdDopRate(): Promise<number> {
  const rate = await fetchUsdDopRate();
  await setSetting("usdDopRate", String(rate));
  await setSetting("rateUpdatedAt", new Date().toISOString());
  return rate;
}

/** Daily job step: only runs when the owner left "update automatically" on (the default). */
export async function refreshRateIfAuto(): Promise<{ updated: boolean; rate?: number; error?: string }> {
  const row = await db.setting.findUnique({ where: { key: "rateAuto" } });
  if (row?.value === "off") return { updated: false };
  try {
    return { updated: true, rate: await refreshUsdDopRate() };
  } catch (e) {
    return { updated: false, error: e instanceof Error ? e.message : "failed" };
  }
}
