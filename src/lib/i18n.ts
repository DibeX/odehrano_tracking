import { i18n } from '@lingui/core';
import { en, cs } from 'make-plural/plurals';

export const locales = {
  en: 'English',
  cs: 'Čeština',
};

export const defaultLocale = 'en';

i18n.loadLocaleData({
  en: { plurals: en },
  cs: { plurals: cs },
});

/**
 * Load messages for given locale and activate it.
 * This function isn't part of the LinguiJS library because there are
 * many ways how to load messages — from REST API, from file, from cache, etc.
 */
export async function loadCatalog(locale: string) {
  const { messages } = await import(`@/locales/${locale}/messages`);
  i18n.load(locale, messages);
  i18n.activate(locale);
}

// Load the default locale
loadCatalog(defaultLocale);
