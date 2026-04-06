/** Supported locales for the application */
export const SUPPORTED_LOCALES = ['tr', 'en'] as const

export type Locale = (typeof SUPPORTED_LOCALES)[number]

/** Default locale — Turkish */
export const DEFAULT_LOCALE: Locale = 'tr'

/** Locale display names */
export const LOCALE_NAMES: Record<Locale, string> = {
  tr: 'Turkce',
  en: 'English',
}
