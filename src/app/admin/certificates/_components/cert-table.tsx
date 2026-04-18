'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, AlertTriangle, Clock, Copy, Eye, Ban, Archive } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/components/shared/toast'
import type { Certificate } from '../_types'
import { daysUntilExpiry, EXPIRING_SOON_DAYS } from '../_hooks/use-cert-filters'

interface Props {
  certificates: Certificate[]
  onSelect: (cert: Certificate) => void
  showTrainingColumn?: boolean
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CertTable({ certificates, onSelect, showTrainingColumn = true }: Props) {
  const { toast } = useToast()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast('Sertifika kodu kopyalandı', 'success')
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => prev === id ? null : prev), 1500)
    })
  }

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={{ background: 'var(--color-bg)' }}>
          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th>
          {showTrainingColumn && (
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
          )}
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sertifika Kodu</th>
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Puan</th>
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Veriliş Tarihi</th>
          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {certificates.map((cert) => {
          const days = daysUntilExpiry(cert.expiresAt)
          const isExpiring = !cert.isRevoked && !cert.isExpired && days !== null && days > 0 && days <= EXPIRING_SOON_DAYS
          const scoreColor = cert.score >= 90 ? 'var(--color-success)' : cert.score >= 70 ? 'var(--color-primary)' : 'var(--color-warning)'
          return (
            <tr
              key={cert.id}
              className="group transition-colors duration-150 hover:bg-(--color-surface-hover) cursor-pointer"
              style={{ borderBottom: '1px solid var(--color-border)' }}
              onClick={() => onSelect(cert)}
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                      {cert.user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{cert.user.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                      {cert.user.department}{cert.user.title ? ` · ${cert.user.title}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              {showTrainingColumn && (
                <td className="px-4 py-3.5">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium">{cert.training.title}</p>
                      {cert.training.isArchived && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
                          title="Eğitim arşivlenmiş — sertifika geçerliliğini korur"
                        >
                          <Archive className="h-2.5 w-2.5" /> Arşivlenmiş
                        </span>
                      )}
                    </div>
                    {cert.training.category && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 inline-block" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                        {cert.training.category}
                      </span>
                    )}
                  </div>
                </td>
              )}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <code className="text-[12px] font-mono font-semibold px-2 py-1 rounded-md" style={{ background: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                    {cert.certificateCode}
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(cert.id, cert.certificateCode) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded"
                    title={copiedId === cert.id ? 'Kopyalandı' : 'Kopyala'}
                    aria-label="Sertifika kodunu kopyala"
                  >
                    <Copy className="h-3 w-3" style={{ color: copiedId === cert.id ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                  </button>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <span className="font-mono font-bold" style={{ color: scoreColor }}>{cert.score}%</span>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                  <span className="font-mono text-[12px]">{formatDate(cert.issuedAt)}</span>
                </div>
              </td>
              <td className="px-4 py-3.5">
                {cert.isRevoked ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                    <Ban className="h-3 w-3" /> İptal Edilmiş
                  </span>
                ) : cert.isExpired ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                    <AlertTriangle className="h-3 w-3" /> Süresi Dolmuş
                  </span>
                ) : isExpiring ? (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                    <Clock className="h-3 w-3" /> {days} gün kaldı
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                    <CheckCircle2 className="h-3 w-3" /> Aktif
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(cert) }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-(--color-bg)"
                    title="Detay"
                    aria-label="Sertifika detayını görüntüle"
                  >
                    <Eye className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
