// ─── Google Bağlantı Kesme Onay Modalı ───
// "Google bağlantısını kaldırmak istediğinize emin misiniz?"

'use client'

import { AlertTriangle, X, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  loading: boolean
}

export function GoogleDisconnectModal({ open, onClose, onConfirm, loading }: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && !loading && onClose()}
    >
      <div
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-xl)' }}
      >
        {/* İkon + başlık */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-error-bg)' }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
            </div>
            <div>
              <h3 className="text-[15px] font-bold">Bağlantıyı Kaldır</h3>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Bu işlem geri alınamaz</p>
            </div>
          </div>
          <button onClick={onClose} disabled={loading} className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Uyarı */}
        <div
          className="rounded-xl p-4 mb-5 text-[13px] leading-relaxed"
          style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
        >
          Google bağlantısını kaldırmak istediğinize emin misiniz? Bu işlem sonucunda:
          <ul className="mt-2 space-y-1 text-[12px]">
            <li>• AI içerik üretimi devre dışı kalacak</li>
            <li>• Saklanan cookie verileri silinecek</li>
            <li>• Tekrar bağlanmak için yeni cookie girmeniz gerekecek</li>
          </ul>
        </div>

        {/* Butonlar */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border py-2.5 text-[13px] font-semibold transition-all"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            Vazgeç
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-bold text-white transition-all disabled:opacity-50"
            style={{ background: 'var(--color-error)' }}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Kaldırılıyor...' : 'Evet, Kaldır'}
          </button>
        </div>
      </div>
    </div>
  )
}
