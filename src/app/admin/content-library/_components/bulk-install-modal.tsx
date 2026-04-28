'use client'

import { useState } from 'react'
import { Layers, X, Plus, Sparkles } from 'lucide-react'
import { useToast } from '@/components/shared/toast'
import { CONTENT_LIBRARY_CATEGORIES } from '@/lib/content-library-categories'
import { K, type ContentLibraryItem } from './shared'

interface BulkInstallModalProps {
  items: ContentLibraryItem[]
  onClose: () => void
  onSuccess: () => void
}

export default function BulkInstallModal({ items, onClose, onSuccess }: BulkInstallModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const uninstalledInCategory = items.filter(
    i => i.category === selectedCategory && !i.isInstalled
  )

  const handleInstall = async () => {
    if (!selectedCategory) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/content-library/bulk-install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız')
      toast(
        data.installed > 0
          ? `${data.installed} içerik kurumunuza eklendi${data.skipped > 0 ? `, ${data.skipped} zaten mevcuttu` : ''}`
          : 'Bu kategorideki tüm içerikler zaten eklenmiş',
        'success'
      )
      onSuccess()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(28, 25, 23, 0.45)' }}
      onClick={onClose}
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
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center"
                style={{ background: K.PRIMARY_LIGHT, borderRadius: 10, color: K.PRIMARY }}
              >
                <Layers size={18} strokeWidth={1.75} />
              </div>
              <div>
                <h2 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY, lineHeight: 1.2 }}>
                  Toplu İçerik Ekle
                </h2>
                <p style={{ fontSize: 12, color: K.TEXT_MUTED, marginTop: 2 }}>Kategori bazlı hızlı kurulum</p>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ padding: 8, borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', color: K.TEXT_MUTED }}
              onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div style={{ padding: '20px 24px' }} className="space-y-4">
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.TEXT_MUTED }}>
              Kategori Seç
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              style={{
                width: '100%',
                background: K.SURFACE,
                border: `1.5px solid ${K.BORDER}`,
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 14,
                fontWeight: 500,
                color: K.TEXT_PRIMARY,
                outline: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            >
              <option value="">Kategori seçin...</option>
              {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => {
                const total = items.filter(i => i.category === key).length
                const uninstalled = items.filter(i => i.category === key && !i.isInstalled).length
                return (
                  <option key={key} value={key}>
                    {cfg.label} — {total} içerik ({uninstalled} eklenecek)
                  </option>
                )
              })}
            </select>
          </div>

          {selectedCategory && (
            <div
              className="flex items-center gap-3"
              style={{
                background: uninstalledInCategory.length > 0 ? K.PRIMARY_LIGHT : K.SURFACE_HOVER,
                border: `1px solid ${uninstalledInCategory.length > 0 ? K.PRIMARY : K.BORDER_LIGHT}`,
                borderRadius: 12,
                padding: 14,
              }}
            >
              {uninstalledInCategory.length > 0 ? (
                <>
                  <Sparkles size={16} style={{ color: K.PRIMARY, flexShrink: 0 }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: K.PRIMARY }}>
                    {uninstalledInCategory.length} içerik kurumunuza eklenecek
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 13, color: K.TEXT_MUTED }}>
                  Bu kategorideki tüm içerikler zaten eklenmiş.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '16px 24px', borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: K.TEXT_SECONDARY,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE }}
          >
            İptal
          </button>
          <button
            onClick={handleInstall}
            disabled={!selectedCategory || loading || uninstalledInCategory.length === 0}
            className="flex items-center gap-2"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: !selectedCategory || loading || uninstalledInCategory.length === 0 ? K.TEXT_MUTED : K.PRIMARY,
              border: 'none',
              borderRadius: 10,
              cursor: !selectedCategory || loading || uninstalledInCategory.length === 0 ? 'not-allowed' : 'pointer',
              opacity: !selectedCategory || loading || uninstalledInCategory.length === 0 ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY_HOVER }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY }}
          >
            <Plus size={14} />
            {loading ? 'Ekleniyor...' : `${uninstalledInCategory.length} İçerik Ekle`}
          </button>
        </div>
      </div>
    </div>
  )
}
