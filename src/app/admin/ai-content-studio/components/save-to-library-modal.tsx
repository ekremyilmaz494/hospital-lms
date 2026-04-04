'use client'

import { useState } from 'react'
import { Loader2, BookOpen, X } from 'lucide-react'
import {
  CONTENT_LIBRARY_CATEGORIES,
  CONTENT_LIBRARY_DIFFICULTY,
  CONTENT_LIBRARY_TARGET_ROLES,
  type ContentLibraryCategoryKey,
  type ContentLibraryDifficulty,
} from '@/lib/content-library-categories'
import { getFormatConfig } from '../lib/format-config'

interface LibrarySaveData {
  title: string
  description?: string
  category: string
  difficulty: string
  targetRoles: string[]
  duration: number
  smgPoints: number
}

interface SaveToLibraryModalProps {
  open: boolean
  onClose: () => void
  onSave: (data: LibrarySaveData) => Promise<void>
  saving: boolean
  defaultTitle: string
  artifactType: string
}

export function SaveToLibraryModal({
  open, onClose, onSave, saving, defaultTitle, artifactType,
}: SaveToLibraryModalProps) {
  const config = getFormatConfig(artifactType)
  const [title, setTitle] = useState(defaultTitle)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<ContentLibraryCategoryKey>('INFECTION_CONTROL')
  const [difficulty, setDifficulty] = useState<ContentLibraryDifficulty>('BASIC')
  const [targetRoles, setTargetRoles] = useState<string[]>(['all'])
  const [duration, setDuration] = useState(config.estimatedMinutes)
  const [smgPoints, setSmgPoints] = useState(0)

  if (!open) return null

  const isValid = title.trim().length > 0 && targetRoles.length > 0

  const handleSubmit = () => {
    if (!isValid) return
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      difficulty,
      targetRoles,
      duration,
      smgPoints,
    })
  }

  const toggleRole = (role: string) => {
    setTargetRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0, 0, 0, 0.5)' }}
        onClick={saving ? undefined : onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6"
        style={{ background: 'var(--color-surface)', boxShadow: '0 25px 50px rgba(0,0,0,0.15)' }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="absolute right-4 top-4 rounded-lg p-1 transition-colors disabled:opacity-50"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Kapat"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
          <h2 className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            Kütüphaneye Ekle
          </h2>
        </div>

        <div className="mt-5 space-y-4">
          {/* Title */}
          <Field label="Başlık *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </Field>

          {/* Description */}
          <Field label="Açıklama">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </Field>

          {/* Category */}
          <Field label="Kategori *">
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(CONTENT_LIBRARY_CATEGORIES) as [ContentLibraryCategoryKey, { label: string; color: string }][]).map(
                ([key, { label, color }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCategory(key)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                    style={{
                      background: category === key ? `color-mix(in srgb, ${color} 20%, var(--color-surface))` : 'var(--color-surface-hover)',
                      color: category === key ? color : 'var(--color-text-secondary)',
                      border: `1px solid ${category === key ? color : 'var(--color-border)'}`,
                    }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                    {label}
                  </button>
                ),
              )}
            </div>
          </Field>

          {/* Difficulty */}
          <Field label="Zorluk *">
            <div className="flex gap-2">
              {(Object.entries(CONTENT_LIBRARY_DIFFICULTY) as [ContentLibraryDifficulty, { label: string; color: string }][]).map(
                ([key, { label, color }]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setDifficulty(key)}
                    className="flex-1 rounded-xl py-2 text-sm font-medium transition-colors"
                    style={{
                      background: difficulty === key ? color : 'var(--color-surface-hover)',
                      color: difficulty === key ? 'white' : 'var(--color-text-secondary)',
                      border: `1px solid ${difficulty === key ? color : 'var(--color-border)'}`,
                    }}
                  >
                    {label}
                  </button>
                ),
              )}
            </div>
          </Field>

          {/* Target Roles */}
          <Field label="Hedef Roller *">
            <div className="flex flex-wrap gap-2">
              {CONTENT_LIBRARY_TARGET_ROLES.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    background: targetRoles.includes(value) ? 'var(--color-primary-light)' : 'var(--color-surface-hover)',
                    color: targetRoles.includes(value) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    border: `1px solid ${targetRoles.includes(value) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={targetRoles.includes(value)}
                    onChange={() => toggleRole(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
            {targetRoles.length === 0 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--color-error)' }}>En az bir rol seçin</p>
            )}
          </Field>

          {/* Duration + SMG Points */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Süre (dk) *">
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(Math.max(1, Math.min(480, Number(e.target.value) || 1)))}
                min={1}
                max={480}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </Field>
            <Field label="SMG Puanı">
              <input
                type="number"
                value={smgPoints}
                onChange={(e) => setSmgPoints(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                min={0}
                max={100}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            </Field>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !isValid}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: 'white' }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              'Kaydet'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </label>
      {children}
    </div>
  )
}
