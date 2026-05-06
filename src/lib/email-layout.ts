/**
 * Email layout DRY helpers — header/body/CTA/alert blokları için ortak kompozisyon.
 *
 * Kullanım: template fonksiyonu yerel content HTML'i üretir, `emailLayout({ ... })`
 * sarar. Header'da `theme: 'tenant'` seçilirse `org.brandColor` gradient'ine bağlanır;
 * platform-owned bildirimlerde sabit tema (success/error/warning).
 *
 * Outlook gradient render'ı zayıf → header div'inde `bgcolor` fallback attribute
 * üretilir; gradient destekleyen client'larda inline-style devreye girer.
 */

import { BRAND } from '@/lib/brand'

export type EmailTheme = 'success' | 'error' | 'warning' | 'tenant'

export interface EmailLayoutOrg {
  /** Organizasyon adı — header'da gösterilir. Tenant adı yoksa BRAND.fullName fallback. */
  name?: string | null
  /** Tenant gradient için brand renk (#RRGGBB). Yoksa default tema kullanılır. */
  brandColor?: string | null
}

export interface EmailLayoutOptions {
  /** Tenant kontekstindeki email'lerde org bilgisi. Platform email'lerinde null/undefined. */
  org?: EmailLayoutOrg | null
  /** İç gövde HTML — `<h2>`, `<p>`, `cta(...)`, `alertBox(...)` gibi parçalar. */
  content: string
  /** Renk teması — varsayılan `'success'` (yeşil). Tenant için `'tenant'` ver. */
  theme?: EmailTheme
  /** Header'ın altındaki ince satır (örn. "Eğitim Bildirimi", "Sınav Sonucu"). */
  headerSubtitle?: string
  /** Footer'da kurum adının yazıldığı koyu şerit. Default true. */
  showRibbon?: boolean
}

const PLATFORM_GRADIENTS = {
  success: { from: '#0d9668', to: '#0f4a35' },
  error: { from: '#dc2626', to: '#7f1d1d' },
  warning: { from: '#f59e0b', to: '#92400e' },
} as const

/** WCAG AA için #000 ya da #fff seçer — relative luminance > 0.5 → koyu metin. */
export function getReadableTextColor(hex: string): '#000000' | '#ffffff' {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return '#ffffff'
  const r = parseInt(clean.slice(0, 2), 16) / 255
  const g = parseInt(clean.slice(2, 4), 16) / 255
  const b = parseInt(clean.slice(4, 6), 16) / 255
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

/** RGB shift ile renk koyulaştır — gradient'in ikinci durağı için. amount: 0-100. */
export function darkenColor(hex: string, amount = 25): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const factor = 1 - amount / 100
  const r = Math.round(parseInt(clean.slice(0, 2), 16) * factor)
  const g = Math.round(parseInt(clean.slice(2, 4), 16) * factor)
  const b = Math.round(parseInt(clean.slice(4, 6), 16) * factor)
  const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function resolveGradient(theme: EmailTheme, org?: EmailLayoutOrg | null) {
  if (theme === 'tenant' && org?.brandColor) {
    return { from: org.brandColor, to: darkenColor(org.brandColor, 25) }
  }
  return PLATFORM_GRADIENTS[theme === 'tenant' ? 'success' : theme]
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Ana email layout — header + body + opsiyonel ribbon footer. */
export function emailLayout({
  org,
  content,
  theme = 'success',
  headerSubtitle,
  showRibbon = true,
}: EmailLayoutOptions): string {
  const gradient = resolveGradient(theme, org)
  const headerText = getReadableTextColor(gradient.from)
  const orgName = org?.name ?? BRAND.fullName
  const subtitleHtml = headerSubtitle
    ? `<p style="color: ${headerText === '#ffffff' ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.65)'}; margin: 8px 0 0; font-size: 14px;">${escape(headerSubtitle)}</p>`
    : ''

  const ribbonHtml = showRibbon
    ? `
      <div bgcolor="#0f172a" style="background: #0f172a; padding: 14px 32px; border-radius: 0 0 16px 16px; text-align: center;">
        <p style="margin: 0; color: rgba(255,255,255,0.55); font-size: 11px; letter-spacing: 0.04em;">${escape(orgName)} · ${escape(BRAND.shortDesc)}</p>
      </div>`
    : ''

  return `
    <div style="font-family: 'DM Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 24px 16px;">
      <div bgcolor="${gradient.from}" style="background: ${gradient.from}; background: linear-gradient(135deg, ${gradient.from}, ${gradient.to}); padding: 32px; border-radius: 16px 16px 0 0;">
        <h1 style="color: ${headerText}; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">${escape(orgName)}</h1>
        ${subtitleHtml}
      </div>
      <div style="background: white; padding: 32px; border: 1px solid #e2e8f0; border-top: none; ${showRibbon ? '' : 'border-radius: 0 0 16px 16px;'}">
        ${content}
      </div>
      ${ribbonHtml}
    </div>
  `
}

/** Call-to-action button — her email'de tipik 1-2 kez kullanılır. */
export function cta(url: string, label: string, color = '#0d9668'): string {
  return `<a href="${escape(url)}" style="display: inline-block; background: ${color}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px;">${escape(label)}</a>`
}

/** Uyarı kutusu — sol kenar renkli border + soft bg. */
export function alertBox(text: string, level: 'error' | 'warning' | 'info' = 'info'): string {
  const palette = {
    error: { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' },
    warning: { bg: '#fffbeb', border: '#f59e0b', text: '#92400e' },
    info: { bg: '#eff6ff', border: '#2563eb', text: '#1d4ed8' },
  }[level]
  return `<div style="background: ${palette.bg}; border-left: 4px solid ${palette.border}; padding: 12px 16px; margin: 16px 0; border-radius: 0 8px 8px 0;"><p style="margin: 0; color: ${palette.text}; font-size: 14px; line-height: 1.5;">${escape(text)}</p></div>`
}

/** Bilgi kartı — başlık + body, özet bilgileri vurgular. */
export function infoCard({ title, body }: { title: string; body: string }): string {
  return `<div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e2e8f0;"><p style="margin: 0 0 4px; color: #1e293b; font-weight: 600; font-size: 14px;">${escape(title)}</p><p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5;">${escape(body)}</p></div>`
}
