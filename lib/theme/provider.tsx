"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const COOKIE = "loamia.theme";

function readCookie(): Theme | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`${COOKIE}=([^;]+)`));
  if (!m) return null;
  const v = m[1];
  return v === "dark" || v === "light" ? v : null;
}

function writeCookie(theme: Theme) {
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}

function applyToDom(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("light", theme === "light");
}

export function ThemeProvider({ initialTheme, children }: { initialTheme: Theme; children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    const c = readCookie();
    if (c && c !== theme) {
      setThemeState(c);
      applyToDom(c);
    } else {
      applyToDom(theme);
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    writeCookie(t);
    applyToDom(t);
    setThemeState(t);
  }, []);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
