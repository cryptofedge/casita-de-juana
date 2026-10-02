"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { translate, type Locale, type TFn } from "./index";

interface Ctx {
  locale: Locale;
  t: TFn;
}
const I18nCtx = createContext<Ctx>({ locale: "en", t: (k, v) => translate("en", k, v) });

/** Wrap tenant-facing areas. Outside a provider, everything renders in English. */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: (k, v) => translate(locale, k, v) }), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.lang = "en";
    };
  }, [locale]);
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export const useT = () => useContext(I18nCtx);
