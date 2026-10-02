import base from "./es";
import admin from "./es-admin";

const es: Record<string, string> = { ...base, ...admin };

export type Locale = "en" | "es";
export const LOCALE_COOKIE = "cdj-lang";

/**
 * English source text is the key. Missing Spanish entries fall back to English,
 * so untranslated strings never break a page. `{name}` placeholders are interpolated.
 */
export function translate(locale: Locale, key: string, vars?: Record<string, string | number>): string {
  let s = locale === "es" ? (es[key] ?? key) : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
  return s;
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Intl locale tag for dates. */
export const intlTag = (l: Locale) => (l === "es" ? "es-DO" : "en-US");
