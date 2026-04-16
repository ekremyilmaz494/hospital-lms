'use client'

import { AlertTriangle, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { BlurFade } from '@/components/ui/blur-fade'

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
        className="flex items-start gap-3 rounded-xl border px-4 py-3 mb-6"
        style={{
          background: 'var(--color-warning-bg)',
          borderColor: 'color-mix(in srgb, var(--color-warning) 30%, transparent)',
        }}
      >
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg mt-0.5"
          style={{ background: 'color-mix(in srgb, var(--color-warning) 20%, transparent)' }}
        >
          <AlertTriangle className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--color-warning)' }}>
            {trainings.length} eğitimde yenileme süresi tanımlı değil
          </p>
          <p className="text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            Bu eğitimlerin sertifikaları süresiz geçerli. Denetim gerekliliklerine göre (İSG, KVKK) yenileme
            süresi tanımlanması önerilir.
            <span className="text-[11px] ml-1" style={{ color: 'var(--color-text-muted)' }}>
              ({preview}{remainder > 0 ? ` ve ${remainder} diğer` : ''})
            </span>
          </p>
        </div>
        <Link
          href="/admin/trainings"
          className="flex items-center gap-1 text-[12px] font-semibold whitespace-nowrap rounded-lg px-3 py-1.5 transition-colors duration-150"
          style={{
            background: 'var(--color-warning)',
            color: 'white',
          }}
        >
          Eğitimleri düzenle
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </BlurFade>
  )
}
