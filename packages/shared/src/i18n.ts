import { en } from "./locales/en";
import { es } from "./locales/es";
import type { Locale } from "./domain";

export const translations = {
  en,
  es
} as const;

export type TranslationKey = keyof typeof en;

export function t(locale: Locale, key: TranslationKey): string {
  return translations[locale][key] ?? translations.en[key] ?? key;
}

