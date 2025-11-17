import { i18n } from "@lingui/core";
import { messages as enMessages } from "../locales/en.po";

export const locales = {
  en: "English",
  cs: "Čeština",
};

export const defaultLocale = "en";

// Load default locale synchronously to avoid hydration mismatch
i18n.load("en", enMessages);
i18n.activate("en");

/**
 * Load messages for given locale and activate it.
 * This function isn't part of the LinguiJS library because there are
 * many ways how to load messages — from REST API, from file, from cache, etc.
 */
export async function loadCatalog(locale: string) {
  if (locale === "en") {
    // Already loaded synchronously
    i18n.activate("en");
    return;
  }

  const catalogs: Record<string, () => Promise<{ messages: any }>> = {
    cs: () => import("../locales/cs.po"),
  };

  const catalog = catalogs[locale];
  if (!catalog) {
    console.warn(`Catalog for locale "${locale}" not found`);
    return;
  }

  const { messages } = await catalog();
  i18n.load(locale, messages);
  i18n.activate(locale);
}
