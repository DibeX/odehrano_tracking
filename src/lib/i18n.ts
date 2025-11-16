import { i18n } from "@lingui/core";
import { en, cs } from "make-plural/plurals";

export const locales = {
  en: "English",
  cs: "Čeština",
};

export const defaultLocale = "en";

const pluralData: Record<string, (n: number | string, ord?: boolean) => string> = {
  en,
  cs,
};

/**
 * Load messages for given locale and activate it.
 * This function isn't part of the LinguiJS library because there are
 * many ways how to load messages — from REST API, from file, from cache, etc.
 */
export async function loadCatalog(locale: string) {
  const catalogs: Record<string, () => Promise<{ messages: any }>> = {
    en: () => import("../locales/en.po"),
    cs: () => import("../locales/cs.po"),
  };

  const catalog = catalogs[locale];
  if (!catalog) {
    console.warn(`Catalog for locale "${locale}" not found`);
    return;
  }

  const { messages } = await catalog();
  i18n.load(locale, { ...messages, plurals: pluralData[locale] });
  i18n.activate(locale);
}

// Load the default locale
loadCatalog(defaultLocale);
