"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_STORAGE_KEY,
  messages,
  type Locale,
  type Messages,
} from "./messages";

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  t: Messages;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function readStoredLocale(): Locale {
  if (typeof window === "undefined") return "fa";
  const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return raw === "en" || raw === "fa" ? raw : "fa";
}

function applyDocumentLocale(locale: Locale) {
  const html = document.documentElement;
  html.setAttribute("lang", locale);
  html.setAttribute("dir", locale === "fa" ? "rtl" : "ltr");
  html.classList.toggle("locale-fa", locale === "fa");
  html.classList.toggle("locale-en", locale === "en");
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fa");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readStoredLocale();
    setLocaleState(initial);
    applyDocumentLocale(initial);
    setReady(true);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    applyDocumentLocale(next);
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      dir: locale === "fa" ? "rtl" : "ltr",
      t: messages[locale],
      setLocale,
    }),
    [locale, setLocale],
  );

  // Avoid flashing wrong direction before localStorage is read.
  if (!ready) {
    return <div className="locale-boot" aria-hidden="true" />;
  }

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
