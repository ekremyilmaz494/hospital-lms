'use client'

import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
}

interface Props {
  trainings: { id: string; title: string }[]
}

export function CertRenewalBanner({ trainings }: Props) {
  if (trainings.length === 0) return null

  const preview = trainings.slice(0, 3).map(t => t.title).join(', ')
  const remainder = trainings.length - 3

  return (
    <BlurFade delay={0.04}>
      <div
        className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6"
        style={{
          background: K.WARNING_BG,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 14,
          boxShadow: K.SHADOW_CARD,
        }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5"
          style={{ background: '#fde68a' }}
        >
          <AlertTriangle className="h-4 w-4" style={{ color: '#b45309' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold mb-0.5" style={{ color: '#b45309', fontFamily: K.FONT_DISPLAY }}>
            {trainings.length} eğitimde yenileme süresi tanımlı değil
          </p>
          <p className="text-[12px]" style={{ color: K.TEXT_SECONDARY }}>
            Bu eğitimlerin sertifikaları süresiz geçerli. Denetim gerekliliklerine göre (İSG, KVKK) yenileme
            süresi tanımlanması önerilir.
            <span className="text-[11px] ml-1" style={{ color: K.TEXT_MUTED }}>
              ({preview}{remainder > 0 ? ` ve ${remainder} diğer` : ''})
            </span>
          </p>
        </div>
        <Link
          href="/admin/trainings"
          className="flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors duration-150"
          style={{
            background: K.PRIMARY,
            color: '#ffffff',
          }}
        >
          Eğitimleri düzenle
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </BlurFade>
  )
}
