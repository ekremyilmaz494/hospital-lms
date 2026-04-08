'use client'

import { useState } from 'react'
import { Library, X } from 'lucide-react'
import { useToast } from '@/components/shared/toast'
import {
  CONTENT_LIBRARY_CATEGORIES,
  CONTENT_LIBRARY_DIFFICULTY,
  CONTENT_LIBRARY_TARGET_ROLES,
} from '@/lib/content-library-categories'

const DIFFICULTY_CONFIG = CONTENT_LIBRARY_DIFFICULTY
const CATEGORY_CONFIG = CONTENT_LIBRARY_CATEGORIES

interface ContentLibraryItem {
  id: string
  title: string
  description: string | null
  category: string
  thumbnailUrl: string | null
  duration: number
  smgPoints: number
  difficulty: string
  targetRoles: string[]
  isActive: boolean
  createdAt: string
  installCount: number
}

interface AddModalProps {
  onClose: () => void
  onSuccess: () => void
  editing?: ContentLibraryItem | null
}

export default function ContentModal({ onClose, onSuccess, editing }: AddModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    title:        editing?.title ?? '',
    description:  editing?.description ?? '',
    category:     editing?.category ?? 'INFECTION_CONTROL',
    thumbnailUrl: editing?.thumbnailUrl ?? '',
    duration:     editing?.duration ?? 30,
    smgPoints:    editing?.smgPoints ?? 5,
    difficulty:   editing?.difficulty ?? 'BASIC',
    targetRoles:  editing?.targetRoles ?? ['all'],
    isActive:     editing?.isActive ?? true,
  })

  const toggleRole = (role: string) => {
    setForm(prev => ({
      ...prev,
      targetRoles: prev.targetRoles.includes(role)
        ? prev.targetRoles.filter(r => r !== role)
        : [...prev.targetRoles, role],
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast('Başlık zorunludur', 'error'); return }
    if (form.targetRoles.length === 0) { toast('En az bir hedef rol seçilmeli', 'error'); return }

    setLoading(true)
    try {
      const url = editing
        ? `/api/super-admin/content-library/${editing.id}`
        : '/api/super-admin/content-library'
      const method = editing ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          thumbnailUrl: form.thumbnailUrl || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız')
      toast(editing ? 'İçerik güncellendi' : 'İçerik eklendi', 'success')
      onSuccess()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full rounded-lg border px-3 py-2 text-sm outline-none transition-colors focus:border-[var(--color-primary)]'
  const inputStyle = { background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-2xl" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
              <Library className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-lg font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
              {editing ? 'İçeriği Düzenle' : 'Yeni İçerik Ekle'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--color-surface-hover)]">
            <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Başlık *</label>
            <input className={inputCls} style={inputStyle} placeholder="İçerik başlığı..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} maxLength={500} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kategori *</label>
              <select className={inputCls} style={inputStyle} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (<option key={key} value={key}>{cfg.label}</option>))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Zorluk Seviyesi *</label>
              <select className={inputCls} style={inputStyle} value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))}>
                {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => (<option key={key} value={key}>{cfg.label}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Açıklama</label>
            <textarea className={inputCls} style={{ ...inputStyle, resize: 'none' }} rows={3} placeholder="Kısa açıklama..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Thumbnail URL</label>
            <input className={inputCls} style={inputStyle} placeholder="https://..." value={form.thumbnailUrl} onChange={e => setForm(p => ({ ...p, thumbnailUrl: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Süre (dakika) *</label>
              <input type="number" min={1} max={480} className={inputCls} style={inputStyle} value={form.duration} onChange={e => setForm(p => ({ ...p, duration: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>SMG Puanı</label>
              <input type="number" min={0} max={100} className={inputCls} style={inputStyle} value={form.smgPoints} onChange={e => setForm(p => ({ ...p, smgPoints: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Hedef Roller *</label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_LIBRARY_TARGET_ROLES.map(role => {
                const selected = form.targetRoles.includes(role.value)
                return (
                  <button key={role.value} type="button" onClick={() => toggleRole(role.value)}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition-colors"
                    style={{ background: selected ? 'var(--color-primary-light)' : 'var(--color-surface-hover)', color: selected ? 'var(--color-primary)' : 'var(--color-text-secondary)', border: `1.5px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                    {role.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors"
              style={{ background: form.isActive ? 'var(--color-primary)' : 'var(--color-border)' }}>
              <span className="pointer-events-none inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow ring-0 transition-transform"
                style={{ transform: form.isActive ? 'translateX(20px)' : 'translateX(0)' }} />
            </button>
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{form.isActive ? 'Aktif — hastaneler görebilir' : 'Pasif — gizli'}</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)]" style={{ color: 'var(--color-text-secondary)' }}>İptal</button>
            <button type="submit" disabled={loading} className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60" style={{ background: 'var(--color-primary)' }}>
              {loading ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
