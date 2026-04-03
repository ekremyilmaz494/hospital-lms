'use client'

import { useState } from 'react'
import type { PromptTemplate } from '../types'

interface Props {
  templates: PromptTemplate[]
  value: string
  onChange: (text: string) => void
  onTemplateSelect: (t: PromptTemplate) => void
}

const MAX_CHARS = 1000

export function PromptComposer({ templates, value, onChange, onTemplateSelect }: Props) {
  return (
    <div className="space-y-5">
      {/* Özel talimat alanı */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-semibold">
            Üretim Talimatı
          </label>
          <span
            className="text-[11px]"
            style={{ color: value.length > MAX_CHARS * 0.9 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}
          >
            {value.length} / {MAX_CHARS}
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          rows={6}
          placeholder="İçeriğin nasıl üretilmesini istediğinizi yazın... Örneğin: 'Bu belgeyi yeni başlayan hemşireler için anlaşılır bir özete dönüştür, teknik terimleri açıkla.'"
          className="w-full resize-none rounded-xl border px-4 py-3 text-[13px] leading-relaxed outline-none transition-all duration-200 placeholder:text-[var(--color-text-muted)]"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--color-border)')}
        />
        <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
          İpucu: Hedef kitleyi, istenen uzunluğu ve özellikle vurgulanmasını istediğiniz konuları belirtin.
        </p>
      </div>
    </div>
  )
}
