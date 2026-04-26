'use client'

import { useState } from 'react'
import { Calendar, CheckCircle2, AlertTriangle, Clock, Copy, Eye, Ban, Archive } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/components/shared/toast'
import type { Certificate } from '../_types'
import { daysUntilExpiry, EXPIRING_SOON_DAYS } from '../_hooks/use-cert-filters'

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

  const headerCellStyle: React.CSSProperties = {
    color: K.TEXT_MUTED,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  }

  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr style={{ background: K.BG }}>
          <th className="px-5 py-3 text-left" style={headerCellStyle}>Personel</th>
          {showTrainingColumn && (
            <th className="px-4 py-3 text-left" style={headerCellStyle}>Eğitim</th>
          )}
          <th className="px-4 py-3 text-left" style={headerCellStyle}>Sertifika Kodu</th>
          <th className="px-4 py-3 text-left" style={headerCellStyle}>Puan</th>
          <th className="px-4 py-3 text-left" style={headerCellStyle}>Veriliş Tarihi</th>
          <th className="px-4 py-3 text-left" style={headerCellStyle}>Durum</th>
          <th className="px-4 py-3 text-right" style={headerCellStyle}>İşlem</th>
        </tr>
      </thead>
      <tbody>
        {certificates.map((cert) => {
          const days = daysUntilExpiry(cert.expiresAt)
          const isExpiring = !cert.isRevoked && !cert.isExpired && days !== null && days > 0 && days <= EXPIRING_SOON_DAYS
          const scoreColor = cert.score >= 90 ? K.SUCCESS : cert.score >= 70 ? K.PRIMARY : '#b45309'
          return (
            <tr
              key={cert.id}
              className="group transition-colors duration-150 cursor-pointer"
              style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
              onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
              onMouseLeave={(e) => { e.currentTarget.style.background = '' }}
              onClick={() => onSelect(cert)}
            >
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: K.PRIMARY }}>
                      {cert.user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold" style={{ color: K.TEXT_PRIMARY }}>{cert.user.name}</p>
                    <p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>
                      {cert.user.department}{cert.user.title ? ` · ${cert.user.title}` : ''}
                    </p>
                  </div>
                </div>
              </td>
              {showTrainingColumn && (
                <td className="px-4 py-3.5">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium" style={{ color: K.TEXT_PRIMARY }}>{cert.training.title}</p>
                      {cert.training.isArchived && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                          style={{ background: K.BG, color: K.TEXT_MUTED }}
                          title="Eğitim arşivlenmiş — sertifika geçerliliğini korur"
                        >
                          <Archive className="h-2.5 w-2.5" /> Arşivlenmiş
                        </span>
                      )}
                    </div>
                    {cert.training.category && (
                      <span
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 inline-block"
                        style={{ background: K.BG, color: K.TEXT_MUTED }}
                      >
                        {cert.training.category}
                      </span>
                    )}
                  </div>
                </td>
              )}
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <code
                    className="text-[12px] font-mono font-semibold px-2 py-1 rounded-md"
                    style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}
                  >
                    {cert.certificateCode}
                  </code>
                  <button
                    onClick={(e) => { e.stopPropagation(); copyCode(cert.id, cert.certificateCode) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded"
                    title={copiedId === cert.id ? 'Kopyalandı' : 'Kopyala'}
                    aria-label="Sertifika kodunu kopyala"
                  >
                    <Copy className="h-3 w-3" style={{ color: copiedId === cert.id ? K.SUCCESS : K.TEXT_MUTED }} />
                  </button>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <span className="font-mono font-bold" style={{ color: scoreColor }}>{cert.score}%</span>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" style={{ color: K.TEXT_MUTED }} />
                  <span className="font-mono text-[12px]" style={{ color: K.TEXT_SECONDARY }}>{formatDate(cert.issuedAt)}</span>
                </div>
              </td>
              <td className="px-4 py-3.5">
                {cert.isRevoked ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: K.BG, color: K.TEXT_MUTED }}
                  >
                    <Ban className="h-3 w-3" /> İptal Edilmiş
                  </span>
                ) : cert.isExpired ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: K.ERROR_BG, color: '#b91c1c' }}
                  >
                    <AlertTriangle className="h-3 w-3" /> Süresi Dolmuş
                  </span>
                ) : isExpiring ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: K.WARNING_BG, color: '#b45309' }}
                  >
                    <Clock className="h-3 w-3" /> {days} gün kaldı
                  </span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: K.SUCCESS_BG, color: K.PRIMARY }}
                  >
                    <CheckCircle2 className="h-3 w-3" /> Aktif
                  </span>
                )}
              </td>
              <td className="px-4 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <button
                    onClick={(e) => { e.stopPropagation(); onSelect(cert) }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = K.BG }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    title="Detay"
                    aria-label="Sertifika detayını görüntüle"
                  >
                    <Eye className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />
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
