"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { translate, type DictKey, type Locale } from "./dict";

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: DictKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const COOKIE = "loamia.locale";

function readCookie(): Locale | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  const v = m[1];
  return v === "zh" || v === "en" ? v : null;
}

function writeCookie(locale: Locale) {
  document.cookie = `${COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    const c = readCookie();
    if (c && c !== locale) setLocaleState(c);
  }, [locale]);

  const setLocale = useCallback(
    (l: Locale) => {
      writeCookie(l);
      setLocaleState(l);
      document.documentElement.lang = l === "zh" ? "zh-TW" : "en";
      // Force server components (legal pages, etc.) to re-render with new cookie
      router.refresh();
    },
    [router]
  );

  const t = useCallback((key: DictKey) => translate(key, locale), [locale]);

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export type { Locale };
