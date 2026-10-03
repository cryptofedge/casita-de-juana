import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { CURRENCY_COOKIE, type CurrencyCode } from "./money";

export interface AppSettings {
  /** DOP per 1 USD */
  usdDopRate: number;
  propertyName: string;
  propertyAddress: string;
  ownerPhone: string;
  edenorteNic: string;
}

const DEFAULTS: AppSettings = {
  usdDopRate: 60,
  propertyName: "Casita de Juana",
  propertyAddress: "Ortega, Dominican Republic",
  ownerPhone: "",
  edenorteNic: "",
};

export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const rate = parseFloat(map.usdDopRate ?? "");
  return {
    usdDopRate: Number.isFinite(rate) && rate > 0 ? rate : DEFAULTS.usdDopRate,
    propertyName: map.propertyName || DEFAULTS.propertyName,
    propertyAddress: map.propertyAddress || DEFAULTS.propertyAddress,
    ownerPhone: map.ownerPhone ?? DEFAULTS.ownerPhone,
    edenorteNic: map.edenorteNic ?? DEFAULTS.edenorteNic,
  };
});

export async function setSetting(key: keyof AppSettings, value: string) {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** The toggle cookie wins; otherwise `fallback` (tenants default to their lease currency). */
export async function getDisplayCurrency(fallback: CurrencyCode = "USD"): Promise<CurrencyCode> {
  const jar = await cookies();
  const v = jar.get(CURRENCY_COOKIE)?.value;
  return v === "DOP" || v === "USD" ? v : fallback;
}

/** Everything a page needs to render money consistently. */
export async function getMoneyContext(fallback: CurrencyCode = "USD") {
  const [settings, display] = await Promise.all([getSettings(), getDisplayCurrency(fallback)]);
  return { display, rate: settings.usdDopRate, settings };
}
