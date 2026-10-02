import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, translate, type Locale, type TFn } from "./index";

/** Cookie wins; otherwise the browser's Accept-Language; otherwise English. */
export const getLocale = cache(async (): Promise<Locale> => {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (c === "es" || c === "en") return c;
  const al = (await headers()).get("accept-language") ?? "";
  return /^\s*es/i.test(al) ? "es" : "en";
});

export async function getI18n(): Promise<{ locale: Locale; t: TFn }> {
  const locale = await getLocale();
  return { locale, t: (key, vars) => translate(locale, key, vars) };
}
