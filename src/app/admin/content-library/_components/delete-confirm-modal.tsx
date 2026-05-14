'use client'

import { AlertCircle, Trash2, GraduationCap } from 'lucide-react'
import { K, type ContentLibraryItem } from './shared'

export interface DependentTraining {
  id: string
  title: string
  publishStatus?: string
}

interface DeleteConfirmModalProps {
  item: ContentLibraryItem
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
  /** Sunucudan 409 ile dönen bağımlı eğitim listesi (ApiError.details.dependentTrainings) */
  dependentTrainings?: DependentTraining[]
  /** Bu içeriğin install edildiği toplam organizasyon sayısı (platform içerikleri için super-admin akışında kullanılır) */
  installCount?: number
}

export default function DeleteConfirmModal({
  item,
  loading,
  onCancel,
  onConfirm,
  dependentTrainings,
  installCount,
}: DeleteConfirmModalProps) {
  const hasBlocker = (dependentTrainings && dependentTrainings.length > 0) || (typeof installCount === 'number' && installCount > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(28, 25, 23, 0.45)' }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 16,
          boxShadow: K.SHADOW_HOVER,
          animation: 'modalIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '24px 24px 16px' }} className="flex items-start gap-4">
          <div
            className="flex shrink-0 items-center justify-center"
            style={{ width: 44, height: 44, background: K.ERROR_BG, borderRadius: 12, color: K.ERROR }}
          >
            <AlertCircle size={22} strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY, lineHeight: 1.3 }}>
              {hasBlocker ? 'Bu içerik silinemez' : 'İçeriği silmek istediğinize emin misiniz?'}
            </h3>
            <p style={{ marginTop: 6, fontSize: 13, color: K.TEXT_SECONDARY, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: K.TEXT_PRIMARY }}>&ldquo;{item.title}&rdquo;</span>{' '}
              {hasBlocker
                ? 'aşağıdaki yerlerde aktif olarak kullanılıyor. Önce ilgili eğitimleri silin veya arşivleyin.'
                : 'kalıcı olarak silinecek. Depolamadaki dosyalar da kaldırılacak.'}
            </p>
            {!hasBlocker && (
              <p style={{ marginTop: 8, fontSize: 12, color: K.TEXT_MUTED, lineHeight: 1.5 }}>
                Eğer bu içerik bir eğitimde kullanılıyorsa silme reddedilecek — önce ilgili eğitimi silmelisiniz.
              </p>
            )}
            {dependentTrainings && dependentTrainings.length > 0 && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  background: K.ERROR_BG,
                  border: `1px solid ${K.ERROR}33`,
                  borderRadius: 10,
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 700, color: K.ERROR, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Bağlı eğitimler ({dependentTrainings.length})
                </p>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dependentTrainings.map(t => (
                    <li
                      key={t.id}
                      className="flex items-center gap-2"
                      style={{ fontSize: 12, color: K.TEXT_PRIMARY }}
                    >
                      <GraduationCap size={13} style={{ color: K.ERROR, flexShrink: 0 }} />
                      <span className="truncate">{t.title}</span>
                      {t.publishStatus && (
                        <span style={{ fontSize: 10, color: K.TEXT_MUTED, marginLeft: 'auto', flexShrink: 0 }}>
                          {t.publishStatus}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {typeof installCount === 'number' && installCount > 0 && !dependentTrainings?.length && (
              <p style={{ marginTop: 12, fontSize: 12, color: K.TEXT_SECONDARY }}>
                <strong>{installCount}</strong> kurumun kütüphanesinde kurulu durumda.
              </p>
            )}
          </div>
        </div>

        <div
          className="flex items-center justify-end gap-2"
          style={{ padding: '16px 24px', borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: K.TEXT_SECONDARY,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = K.SURFACE }}
          >
            {hasBlocker ? 'Kapat' : 'Vazgeç'}
          </button>
          {!hasBlocker && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="flex items-center gap-2"
              style={{
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                background: K.ERROR,
                border: 'none',
                borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              <Trash2 size={14} />
              {loading ? 'Siliniyor...' : 'Evet, sil'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
