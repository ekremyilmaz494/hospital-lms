'use client'

import { useEffect, useState } from 'react'
import { X, AlertCircle, FileText, Music, Film } from 'lucide-react'
import { K, type ContentLibraryItem } from './shared'

interface PreviewModalProps {
  item: ContentLibraryItem & { contentType?: string | null; s3Key?: string | null }
  onClose: () => void
}

type PreviewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; url: string; contentType: string }

/**
 * İçerik kütüphanesi öğesi için tam ekran önizleme modal'ı.
 *
 * Akış:
 *  1) Mount'ta `/api/admin/content-library/[id]/preview-url` ile signed URL al.
 *  2) Content-type'a göre <video controls> / <iframe> (PDF) / <audio> render et.
 *
 * Modal kapanınca state temizlenir; signed URL referansı çöp toplayıcıya bırakılır.
 * Video element'in src'i de bu sayede DOM'dan kaldırılır (network/bellek tutmaz).
 */
export default function PreviewModal({ item, onClose }: PreviewModalProps) {
  const [state, setState] = useState<PreviewState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/admin/content-library/${item.id}/preview-url`)
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          if (!cancelled) setState({ status: 'error', message: body.error || 'Önizleme alınamadı' })
          return
        }
        const body = await res.json() as { url: string; contentType: string }
        if (!cancelled) setState({ status: 'ready', url: body.url, contentType: body.contentType })
      } catch {
        if (!cancelled) setState({ status: 'error', message: 'Önizleme yüklenirken hata oluştu' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [item.id])

  // ESC ile kapatma — modal'da ortak UX
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const TypeIcon = item.contentType === 'video' ? Film : item.contentType === 'audio' ? Music : FileText

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(28, 25, 23, 0.55)' }}
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-4xl flex-col overflow-hidden"
        style={{
          maxHeight: '90vh',
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 16,
          boxShadow: K.SHADOW_HOVER,
          animation: 'modalIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: '16px 20px', borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: 36, height: 36, background: K.PRIMARY_LIGHT, borderRadius: 10, color: K.PRIMARY }}
            >
              <TypeIcon size={16} strokeWidth={1.75} />
            </div>
            <div className="min-w-0">
              <h3
                className="truncate"
                style={{ fontFamily: K.FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: K.TEXT_PRIMARY }}
              >
                {item.title}
              </h3>
              <p style={{ fontSize: 11, color: K.TEXT_MUTED, marginTop: 1 }}>
                Önizleme — {item.duration} dakika
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            style={{ padding: 8, borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: K.TEXT_MUTED }}
            onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          className="flex flex-1 items-center justify-center overflow-hidden"
          style={{ background: '#000', minHeight: 360 }}
        >
          {state.status === 'loading' && (
            <div className="flex flex-col items-center gap-2" style={{ color: '#fff' }}>
              <span
                aria-hidden
                style={{
                  width: 28,
                  height: 28,
                  border: `3px solid rgba(255,255,255,0.2)`,
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              <span style={{ fontSize: 12, opacity: 0.7 }}>Önizleme hazırlanıyor...</span>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex flex-col items-center gap-2 px-6 text-center" style={{ color: '#fff' }}>
              <AlertCircle size={28} style={{ color: K.ERROR }} />
              <p style={{ fontSize: 13, fontWeight: 600 }}>{state.message}</p>
            </div>
          )}

          {state.status === 'ready' && state.contentType === 'video' && (
            <video
              src={state.url}
              controls
              autoPlay
              style={{ width: '100%', height: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#000' }}
            />
          )}

          {state.status === 'ready' && state.contentType === 'audio' && (
            <div className="flex w-full items-center justify-center p-6">
              <audio src={state.url} controls autoPlay style={{ width: '100%', maxWidth: 480 }} />
            </div>
          )}

          {state.status === 'ready' && state.contentType === 'pdf' && (
            <iframe
              src={state.url}
              title={item.title}
              style={{ width: '100%', height: '70vh', border: 'none', background: '#fff' }}
            />
          )}

          {state.status === 'ready' && state.contentType !== 'video' && state.contentType !== 'audio' && state.contentType !== 'pdf' && (
            <div className="flex flex-col items-center gap-3 px-6 text-center" style={{ color: '#fff' }}>
              <FileText size={32} style={{ opacity: 0.6 }} />
              <p style={{ fontSize: 13 }}>Bu içerik türü tarayıcıda önizlenemiyor.</p>
              <a
                href={state.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 16px',
                  background: K.PRIMARY,
                  color: '#fff',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Yeni sekmede aç
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
