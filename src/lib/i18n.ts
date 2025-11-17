import { i18n } from "@lingui/core";
import { messages as csMessages } from "../locales/cs.po";

export const locales = {
  en: "English",
  cs: "Čeština",
};

export const defaultLocale = "cs";

// Load default locale synchronously to avoid hydration mismatch
i18n.load("cs", csMessages);
i18n.activate("cs");

/**
 * Load messages for given locale and activate it.
 * This function isn't part of the LinguiJS library because there are
 * many ways how to load messages — from REST API, from file, from cache, etc.
 */
export async function loadCatalog(locale: string) {
  if (locale === "cs") {
    // Already loaded synchronously
    i18n.activate("cs");
    return;
  }

  const catalogs: Record<string, () => Promise<{ messages: any }>> = {
    en: () => import("../locales/en.po"),
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
