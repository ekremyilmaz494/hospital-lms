'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config'
import type { Locale } from './config'

type Messages = Record<string, Record<string, string>>

const messageCache = new Map<Locale, Messages>()

/** Load messages JSON for a given locale */
async function loadMessages(locale: Locale): Promise<Messages> {
  const cached = messageCache.get(locale)
  if (cached) return cached

  try {
    const messages = (await import(`../../messages/${locale}.json`)).default as Messages
    messageCache.set(locale, messages)
    return messages
  } catch {
    // Fallback to default locale
    if (locale !== DEFAULT_LOCALE) {
      return loadMessages(DEFAULT_LOCALE)
    }
    return {}
  }
}

/**
 * Simple i18n hook — reads translations from JSON files.
 *
 * Usage:
 * ```tsx
 * const { t } = useTranslations('tr')
 * t('common.save') // "Kaydet"
 * t('auth.login')  // "Giris Yap"
 * ```
 */
export function useTranslations(locale?: Locale) {
  const resolvedLocale = locale && SUPPORTED_LOCALES.includes(locale) ? locale : DEFAULT_LOCALE
  const [messages, setMessages] = useState<Messages>(() => messageCache.get(resolvedLocale) ?? {})

  useEffect(() => {
    let cancelled = false
    loadMessages(resolvedLocale).then((m) => {
      if (!cancelled) setMessages(m)
    })
    return () => { cancelled = true }
  }, [resolvedLocale])

  /** Translate a dotted key path like "common.save" */
  const t = useCallback(
    (key: string, fallback?: string): string => {
      const [namespace, ...rest] = key.split('.')
      const messageKey = rest.join('.')
      if (!namespace || !messageKey) return fallback ?? key
      return messages[namespace]?.[messageKey] ?? fallback ?? key
    },
    [messages],
  )

  return useMemo(() => ({ t, locale: resolvedLocale }), [t, resolvedLocale])
}
