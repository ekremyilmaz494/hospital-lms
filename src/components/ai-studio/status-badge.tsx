'use client'

import React from 'react'
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react'
import { K } from './k-tokens'
import type { AiGenStatus } from '@/lib/ai-content-studio/constants'

const LABEL_TR: Record<AiGenStatus, string> = {
  pending: 'Sırada',
  processing: 'Üretiliyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
}

interface StatusBadgeProps {
  status: AiGenStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  let bg: string = K.BORDER_LIGHT
  let fg: string = K.TEXT_MUTED
  let border: string = K.BORDER
  let icon: React.ReactNode = <Clock size={12} />

  if (status === 'pending') {
    bg = K.BORDER_LIGHT; fg = K.TEXT_SECONDARY; border = K.BORDER
    icon = <span style={{
      width: 8, height: 8, borderRadius: 4, background: K.TEXT_MUTED, display: 'inline-block',
    }} />
  } else if (status === 'processing') {
    bg = K.INFO_BG; fg = K.INFO; border = K.INFO
    icon = <Loader2 size={12} className="animate-spin" />
  } else if (status === 'completed') {
    bg = K.SUCCESS_BG; fg = K.SUCCESS; border = K.SUCCESS
    icon = <CheckCircle2 size={12} />
  } else if (status === 'failed') {
    bg = K.ERROR_BG; fg = K.ERROR; border = K.ERROR
    icon = <XCircle size={12} />
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: bg,
        color: fg,
        border: `1px solid ${border}`,
        fontSize: 12,
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {icon}
      {LABEL_TR[status]}
    </span>
  )
}
