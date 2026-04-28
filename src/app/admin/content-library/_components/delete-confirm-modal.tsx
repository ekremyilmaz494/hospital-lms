'use client'

import { AlertCircle, Trash2 } from 'lucide-react'
import { K, type ContentLibraryItem } from './shared'

interface DeleteConfirmModalProps {
  item: ContentLibraryItem
  loading: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function DeleteConfirmModal({ item, loading, onCancel, onConfirm }: DeleteConfirmModalProps) {
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
              İçeriği silmek istediğinize emin misiniz?
            </h3>
            <p style={{ marginTop: 6, fontSize: 13, color: K.TEXT_SECONDARY, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: K.TEXT_PRIMARY }}>&ldquo;{item.title}&rdquo;</span>{' '}
              kalıcı olarak silinecek. Depolamadaki dosyalar da kaldırılacak.
            </p>
            <p style={{ marginTop: 8, fontSize: 12, color: K.TEXT_MUTED, lineHeight: 1.5 }}>
              Eğer bu içerik bir eğitimde kullanılıyorsa silme reddedilecek — önce ilgili eğitimi silmelisiniz.
            </p>
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
            Vazgeç
          </button>
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
        </div>
      </div>
    </div>
  )
}
