'use client'

import { useState } from 'react'
import { X, BookOpen, Loader2 } from 'lucide-react'
import type { OutputFormat } from '../types'

interface SaveParams {
  title: string
  description?: string
  category: string
  difficulty: string
  targetRoles: string[]
  duration?: number
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (params: SaveParams) => void
  saving: boolean
  format: OutputFormat
  defaultTitle?: string
}

const CATEGORIES = [
  { value: 'CLINICAL', label: 'Klinik' },
  { value: 'ADMINISTRATIVE', label: 'İdari' },
  { value: 'COMPLIANCE', label: 'Uyumluluk' },
  { value: 'TECHNICAL', label: 'Teknik' },
  { value: 'SOFT_SKILLS', label: 'Soft Skills' },
  { value: 'ORIENTATION', label: 'Oryantasyon' },
]

const DIFFICULTIES = [
  { value: 'BEGINNER', label: 'Başlangıç', color: 'var(--color-success)' },
  { value: 'INTERMEDIATE', label: 'Orta', color: 'var(--color-warning)' },
  { value: 'ADVANCED', label: 'İleri', color: 'var(--color-error)' },
]

const ROLES = [
  { value: 'DOCTOR', label: 'Doktor' },
  { value: 'NURSE', label: 'Hemşire' },
  { value: 'TECHNICIAN', label: 'Teknisyen' },
  { value: 'ADMIN', label: 'Yönetici' },
  { value: 'MANAGER', label: 'Müdür' },
  { value: 'PHARMACIST', label: 'Eczacı' },
  { value: 'OTHER', label: 'Diğer' },
]

export function SaveToLibraryModal({ open, onClose, onSave, saving, format, defaultTitle = '' }: Props) {
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('CLINICAL')
  const [difficulty, setDifficulty] = useState('BEGINNER')
  const [targetRoles, setTargetRoles] = useState<string[]>(['NURSE'])
  const [duration, setDuration] = useState<string>('')

  if (!open) return null

  const toggleRole = (role: string) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  const handleSubmit = () => {
    if (!title.trim() || targetRoles.length === 0) return
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      difficulty,
      targetRoles,
      duration: duration ? parseInt(duration) : undefined,
    })
  }

  const isValid = title.trim().length > 0 && targetRoles.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-primary-light)' }}
            >
              <BookOpen className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">Kütüphaneye Ekle</h2>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                İçerik bilgilerini doldurun
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5" style={{ color: 'var(--color-text-muted)' }}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-5">
          {/* Başlık */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold">
              Başlık <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="İçerik başlığını girin"
              maxLength={200}
              className="w-full rounded-xl border px-4 py-2.5 text-[13px] outline-none transition-all"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>

          {/* Açıklama */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold">Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kısa açıklama (opsiyonel)"
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-xl border px-4 py-2.5 text-[13px] outline-none transition-all"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>

          {/* Kategori */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border px-4 py-2.5 text-[13px] outline-none transition-all"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-primary)',
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Zorluk */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold">Zorluk Seviyesi</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  className="flex-1 rounded-xl border py-2 text-[12px] font-semibold transition-all duration-150"
                  style={{
                    borderColor: difficulty === d.value ? d.color : 'var(--color-border)',
                    background: difficulty === d.value ? `${d.color}18` : 'var(--color-bg)',
                    color: difficulty === d.value ? d.color : 'var(--color-text-secondary)',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hedef Roller */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold">
              Hedef Roller <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r) => {
                const isActive = targetRoles.includes(r.value)
                return (
                  <button
                    key={r.value}
                    onClick={() => toggleRole(r.value)}
                    className="rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all duration-150"
                    style={{
                      borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                      background: isActive ? 'var(--color-primary-light)' : 'var(--color-bg)',
                      color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
            {targetRoles.length === 0 && (
              <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>
                En az bir rol seçin
              </p>
            )}
          </div>

          {/* Süre */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold">Tahmini Süre (dakika)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Örn: 10"
              min={1}
              max={300}
              className="w-full rounded-xl border px-4 py-2.5 text-[13px] outline-none transition-all"
              style={{
                borderColor: 'var(--color-border)',
                background: 'var(--color-bg)',
                color: 'var(--color-text-primary)',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between gap-3 p-5 border-t"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border px-5 py-2.5 text-[13px] font-semibold transition-all"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || saving}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-[13px] font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Kaydediliyor...' : 'Kütüphaneye Ekle'}
          </button>
        </div>
      </div>
    </div>
  )
}
