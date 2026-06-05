"use client";
/* i18n-ready resolver (D7). English is the source; Kinyarwanda overlays it.
   t(key, fallback) = rw[key] (if non-empty) -> en[key] -> fallback.
   rw.json ships empty, so everything falls back to English until M5 content lands. */
import { createContext, useContext, useState, type ReactNode } from "react";
import en from "@data/locales/en.json";
import rw from "@data/locales/rw.json";

export type Locale = "en" | "rw";
const CATALOGS: Record<Locale, Record<string, string>> = {
  en: en as Record<string, string>,
  rw: rw as Record<string, string>,
};

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
}
const LocaleContext = createContext<Ctx>({ locale: "en", setLocale: () => {}, t: (_k, f = "") => f });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");
  const t = (key: string, fallback = "") =>
    (CATALOGS[locale] && CATALOGS[locale][key]) || CATALOGS.en[key] || fallback;
  return <LocaleContext.Provider value={{ locale, setLocale, t }}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
