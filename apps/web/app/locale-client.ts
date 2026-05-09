"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@capris/shared";

const LOCALE_STORAGE_KEY = "capris_locale";
const LOCALE_CHANGED_EVENT = "capris-locale-changed";

export function loadStoredLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "es" ? "es" : "en";
}

export function persistPreferredLocale(locale: Locale) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  window.dispatchEvent(new Event(LOCALE_CHANGED_EVENT));
}

export function useAppLocale() {
  const [locale, setLocale] = useState<Locale>(loadStoredLocale());

  useEffect(() => {
    const updateLocale = () => setLocale(loadStoredLocale());
    window.addEventListener(LOCALE_CHANGED_EVENT, updateLocale);
    window.addEventListener("storage", updateLocale);

    return () => {
      window.removeEventListener(LOCALE_CHANGED_EVENT, updateLocale);
      window.removeEventListener("storage", updateLocale);
    };
  }, []);

  return locale;
}

export function textByLocale(locale: Locale, english: string, spanish: string) {
  return locale === "es" ? spanish : english;
}
