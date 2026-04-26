'use client'

import React, { useCallback, useState } from 'react'
import { Download, Trash2, ChevronLeft, ChevronRight, Loader2, Inbox } from 'lucide-react'
import { K } from './k-tokens'
import { ARTIFACT_ICONS } from './artifact-icons'
import { StatusBadge } from './status-badge'
import { useToast } from '@/components/shared/toast'
import {
  ARTIFACT_TYPE_LABEL_TR,
  type AiArtifactType,
  type AiGenStatus,
} from '@/lib/ai-content-studio/constants'

export interface HistoryItem {
  id: string
  artifactType: AiArtifactType
  status: AiGenStatus
  progress: number
  fileSize: number | null
  createdAt: string
  prompt: string | null
}

interface HistoryTableProps {
  items: HistoryItem[]
  total: number
  page: number
  limit: number
  isLoading: boolean
  onPageChange: (p: number) => void
  onDeleted: () => void
}

export function HistoryTable({
  items, total, page, limit, isLoading, onPageChange, onDeleted,
}: HistoryTableProps) {
  const { toast: showToast } = useToast()
  const [pendingDownload, setPendingDownload] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const handleDownload = useCallback(async (id: string) => {
    setPendingDownload(id)
    try {
      const res = await fetch(`/api/admin/ai-content-studio/${id}/download`)
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error ?? 'İndirme bağlantısı alınamadı', 'error')
        return
      }
      window.open(json.url, '_blank', 'noopener,noreferrer')
    } catch {
      showToast('Sunucuya ulaşılamadı', 'error')
    } finally {
      setPendingDownload(null)
    }
  }, [showToast])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Bu üretimi silmek istediğinizden emin misiniz?')) return
    setPendingDelete(id)
    try {
      const res = await fetch(`/api/admin/ai-content-studio/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        showToast(json.error ?? 'Silme başarısız', 'error')
        return
      }
      showToast('Silindi', 'success')
      onDeleted()
    } catch {
      showToast('Sunucuya ulaşılamadı', 'error')
    } finally {
      setPendingDelete(null)
    }
  }, [showToast, onDeleted])

  if (!isLoading && items.length === 0) {
    return (
      <div style={{
        padding: 36, textAlign: 'center', borderRadius: 12,
        border: `1px dashed ${K.BORDER}`, background: K.BG,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      }}>
        <Inbox size={28} color={K.TEXT_MUTED} />
        <div style={{ fontSize: 14, fontWeight: 600, color: K.TEXT_SECONDARY }}>
          Henüz üretim yok
        </div>
        <div style={{ fontSize: 12, color: K.TEXT_MUTED }}>
          İlk içeriğinizi üretmek için yukarıdaki formu kullanın.
        </div>
      </div>
    )
  }

  return (
    <div style={{
      border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 12,
      background: K.SURFACE, overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: K.BG }}>
            <tr style={{ textAlign: 'left' }}>
              <Th>Tip</Th>
              <Th>Durum</Th>
              <Th>Boyut</Th>
              <Th>Tarih</Th>
              <Th style={{ textAlign: 'right' }}>İşlemler</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const Icon = ARTIFACT_ICONS[it.artifactType]
              return (
                <tr key={it.id} style={{ borderTop: `1px solid ${K.BORDER_LIGHT}` }}>
                  <Td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Icon size={16} color={K.PRIMARY} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600, color: K.TEXT_PRIMARY }}>
                          {ARTIFACT_TYPE_LABEL_TR[it.artifactType]}
                        </span>
                        {it.prompt && (
                          <span style={{
                            fontSize: 12, color: K.TEXT_MUTED, maxWidth: 280,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{it.prompt}</span>
                        )}
                      </div>
                    </div>
                  </Td>
                  <Td><StatusBadge status={it.status} /></Td>
                  <Td>
                    <span style={{ color: K.TEXT_SECONDARY }}>
                      {it.fileSize ? `${(it.fileSize / (1024 * 1024)).toFixed(1)} MB` : '—'}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: K.TEXT_MUTED }}>
                      {new Date(it.createdAt).toLocaleString('tr-TR')}
                    </span>
                  </Td>
                  <Td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        type="button"
                        disabled={it.status !== 'completed' || pendingDownload === it.id}
                        onClick={() => handleDownload(it.id)}
                        style={{
                          padding: '6px 10px', borderRadius: 8,
                          border: `1px solid ${K.BORDER_LIGHT}`,
                          background: it.status === 'completed' ? K.SURFACE : K.BG,
                          color: it.status === 'completed' ? K.PRIMARY : K.TEXT_MUTED,
                          cursor: it.status === 'completed' ? 'pointer' : 'not-allowed',
                          fontSize: 12, fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {pendingDownload === it.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Download size={12} />}
                        İndir
                      </button>
                      <button
                        type="button"
                        disabled={pendingDelete === it.id}
                        onClick={() => handleDelete(it.id)}
                        style={{
                          padding: '6px 10px', borderRadius: 8,
                          border: `1px solid ${K.BORDER_LIGHT}`,
                          background: K.SURFACE, color: K.ERROR,
                          cursor: 'pointer', fontSize: 12, fontWeight: 600,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {pendingDelete === it.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <Trash2 size={12} />}
                        Sil
                      </button>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG,
      }}>
        <span style={{ fontSize: 12, color: K.TEXT_MUTED }}>
          Toplam {total.toLocaleString('tr-TR')} kayıt · Sayfa {page} / {totalPages}
        </span>
        <div style={{ display: 'inline-flex', gap: 6 }}>
          <PagerBtn disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={14} />
            Önceki
          </PagerBtn>
          <PagerBtn disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
            Sonraki
            <ChevronRight size={14} />
          </PagerBtn>
        </div>
      </div>
    </div>
  )
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{
      padding: '10px 14px', fontSize: 12, fontWeight: 600,
      color: K.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.4,
      ...style,
    }}>{children}</th>
  )
}

function Td({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: '12px 14px', verticalAlign: 'middle', ...style }}>{children}</td>
}

function PagerBtn({
  children, disabled, onClick,
}: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: '6px 10px', borderRadius: 8,
        border: `1px solid ${K.BORDER_LIGHT}`,
        background: K.SURFACE,
        color: disabled ? K.TEXT_MUTED : K.TEXT_PRIMARY,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12, fontWeight: 600,
        display: 'inline-flex', alignItems: 'center', gap: 4,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  )
}
