'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { K } from './k-tokens'
import {
  ARTIFACT_OPTIONS_DEFAULTS,
  type AiArtifactType,
} from '@/lib/ai-content-studio/constants'

interface OptionField {
  key: string
  label: string
  values: { value: string; label: string }[]
}

const FIELDS_BY_TYPE: Record<AiArtifactType, OptionField[]> = {
  audio: [
    {
      key: 'format', label: 'Format',
      values: [
        { value: 'deep-dive', label: 'Derinlemesine' },
        { value: 'brief', label: 'Kısa özet' },
        { value: 'critique', label: 'Eleştiri' },
        { value: 'debate', label: 'Tartışma' },
      ],
    },
    {
      key: 'length', label: 'Uzunluk',
      values: [
        { value: 'short', label: 'Kısa' },
        { value: 'default', label: 'Standart' },
        { value: 'long', label: 'Uzun' },
      ],
    },
  ],
  video: [
    {
      key: 'format', label: 'Format',
      values: [
        { value: 'explainer', label: 'Anlatım' },
        { value: 'brief', label: 'Kısa özet' },
      ],
    },
    {
      key: 'style', label: 'Stil',
      values: [
        { value: 'auto', label: 'Otomatik' },
        { value: 'classic', label: 'Klasik' },
        { value: 'whiteboard', label: 'Beyaz tahta' },
        { value: 'kawaii', label: 'Kawaii' },
        { value: 'anime', label: 'Anime' },
        { value: 'watercolor', label: 'Suluboya' },
        { value: 'papercraft', label: 'Kağıt sanatı' },
      ],
    },
  ],
  slide_deck: [
    {
      key: 'format', label: 'Format',
      values: [
        { value: 'detailed', label: 'Detaylı' },
        { value: 'presenter', label: 'Sunucu modu' },
      ],
    },
    {
      key: 'length', label: 'Uzunluk',
      values: [
        { value: 'short', label: 'Kısa' },
        { value: 'default', label: 'Standart' },
      ],
    },
  ],
  infographic: [
    {
      key: 'orientation', label: 'Yönlendirme',
      values: [
        { value: 'landscape', label: 'Yatay' },
        { value: 'portrait', label: 'Dikey' },
        { value: 'square', label: 'Kare' },
      ],
    },
    {
      key: 'detail', label: 'Detay',
      values: [
        { value: 'concise', label: 'Özlü' },
        { value: 'standard', label: 'Standart' },
        { value: 'detailed', label: 'Detaylı' },
      ],
    },
    {
      key: 'style', label: 'Stil',
      values: [
        { value: 'professional', label: 'Profesyonel' },
        { value: 'sketch-note', label: 'Çizim notu' },
        { value: 'bento-grid', label: 'Bento grid' },
        { value: 'editorial', label: 'Editöryal' },
        { value: 'instructional', label: 'Eğitici' },
      ],
    },
  ],
  report: [
    {
      key: 'format', label: 'Format',
      values: [
        { value: 'briefing-doc', label: 'Brifing dokümanı' },
        { value: 'study-guide', label: 'Çalışma rehberi' },
        { value: 'blog-post', label: 'Blog yazısı' },
      ],
    },
  ],
  mind_map: [],
  data_table: [],
  quiz: [
    {
      key: 'difficulty', label: 'Zorluk',
      values: [
        { value: 'easy', label: 'Kolay' },
        { value: 'medium', label: 'Orta' },
        { value: 'hard', label: 'Zor' },
      ],
    },
    {
      key: 'quantity', label: 'Soru sayısı',
      values: [
        { value: 'fewer', label: 'Az' },
        { value: 'standard', label: 'Standart' },
        { value: 'more', label: 'Çok' },
      ],
    },
  ],
  flashcards: [
    {
      key: 'difficulty', label: 'Zorluk',
      values: [
        { value: 'easy', label: 'Kolay' },
        { value: 'medium', label: 'Orta' },
        { value: 'hard', label: 'Zor' },
      ],
    },
    {
      key: 'quantity', label: 'Kart sayısı',
      values: [
        { value: 'fewer', label: 'Az' },
        { value: 'standard', label: 'Standart' },
        { value: 'more', label: 'Çok' },
      ],
    },
  ],
}

interface OptionsPanelProps {
  type: AiArtifactType
  value: Record<string, string>
  onChange: (next: Record<string, string>) => void
  disabled?: boolean
}

export function OptionsPanel({ type, value, onChange, disabled }: OptionsPanelProps) {
  const [open, setOpen] = useState(false)
  const fields = FIELDS_BY_TYPE[type]

  if (fields.length === 0) {
    return (
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          border: `1px dashed ${K.BORDER_LIGHT}`,
          background: K.BG,
          fontSize: 13,
          color: K.TEXT_MUTED,
        }}
      >
        Bu içerik tipi için ek seçenek bulunmuyor.
      </div>
    )
  }

  const merged = { ...ARTIFACT_OPTIONS_DEFAULTS[type], ...value }

  return (
    <div
      style={{
        border: `1px solid ${K.BORDER_LIGHT}`,
        borderRadius: 12,
        background: K.SURFACE,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: K.TEXT_PRIMARY,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Settings2 size={16} color={K.TEXT_MUTED} />
          Gelişmiş seçenekler
        </span>
        {open ? <ChevronUp size={16} color={K.TEXT_MUTED} /> : <ChevronDown size={16} color={K.TEXT_MUTED} />}
      </button>
      {open && (
        <div
          style={{
            padding: 14,
            borderTop: `1px solid ${K.BORDER_LIGHT}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {fields.map((f) => (
            <label
              key={f.key}
              style={{
                flex: '1 1 200px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 13,
                color: K.TEXT_SECONDARY,
                fontWeight: 500,
              }}
            >
              {f.label}
              <select
                value={merged[f.key] ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ ...merged, [f.key]: e.target.value })}
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: `1px solid ${K.BORDER}`,
                  background: K.SURFACE,
                  color: K.TEXT_PRIMARY,
                  fontSize: 13,
                }}
              >
                {f.values.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
