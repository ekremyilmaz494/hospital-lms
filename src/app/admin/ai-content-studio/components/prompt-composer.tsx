'use client'

import { useMemo } from 'react'
import { Check } from 'lucide-react'
import type { PromptTemplate } from '../types'
import { MAX_INSTRUCTIONS_LENGTH } from '../constants'

interface PromptComposerProps {
  templates: PromptTemplate[]
  value: string
  onChange: (value: string) => void
  onTemplateSelect: (template: PromptTemplate | null) => void
  selectedTemplate: PromptTemplate | null
  suggestedTopics?: string[]
}

const CATEGORY_COLORS: Record<string, string> = {
  'Eğitim': 'var(--color-primary)',
  'Klinik': '#8b5cf6',
  'Değerlendirme': 'var(--color-warning)',
  'Güvenlik': 'var(--color-error)',
  'Uyum': '#06b6d4',
}

export function PromptComposer({
  templates, value, onChange, onTemplateSelect, selectedTemplate, suggestedTopics,
}: PromptComposerProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, PromptTemplate[]>()
    for (const t of templates) {
      const list = map.get(t.category) || []
      list.push(t)
      map.set(t.category, list)
    }
    return map
  }, [templates])

  const charPercent = value.length / MAX_INSTRUCTIONS_LENGTH
  const counterColor = charPercent >= 1 ? 'var(--color-error)' : charPercent >= 0.9 ? 'var(--color-warning)' : 'var(--color-text-muted)'

  const handleTemplateClick = (template: PromptTemplate) => {
    if (selectedTemplate?.id === template.id) {
      onTemplateSelect(null)
    } else {
      onTemplateSelect(template)
      onChange(template.template)
    }
  }

  return (
    <div className="space-y-5">
      {/* Templates */}
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          Hazır Şablon Seç
        </p>
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <span
                className="mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: `color-mix(in srgb, ${CATEGORY_COLORS[category] || 'var(--color-primary)'} 15%, transparent)`, color: CATEGORY_COLORS[category] || 'var(--color-primary)' }}
              >
                {category}
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((t) => {
                  const isSelected = selectedTemplate?.id === t.id
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleTemplateClick(t)}
                      className="relative shrink-0 rounded-xl p-3 text-left transition-all"
                      style={{
                        width: 200,
                        background: 'var(--color-surface)',
                        border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        boxShadow: isSelected ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'none',
                      }}
                    >
                      {isSelected && (
                        <span
                          className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                          style={{ background: 'var(--color-primary)' }}
                        >
                          <Check className="h-3 w-3 text-white" />
                        </span>
                      )}
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                        {t.label}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {t.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={MAX_INSTRUCTIONS_LENGTH}
          placeholder={`İçerik için özel talimatlarınızı yazın...\n\nÖrnek: 'Hemşireler için enfeksiyon kontrol kurallarını özetleyen, kolay anlaşılır bir podcast oluştur.'`}
          className="w-full resize-y rounded-xl p-4 text-sm leading-relaxed outline-none transition-colors"
          style={{
            minHeight: 180,
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
        />
        <span className="absolute bottom-3 right-3 text-xs font-medium" style={{ color: counterColor }}>
          {value.length}/{MAX_INSTRUCTIONS_LENGTH}
        </span>
      </div>

      {/* Suggested Topics */}
      {suggestedTopics && suggestedTopics.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
            Belgeden tespit edilen konular:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedTopics.map((topic, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onChange(value ? `${value}, ${topic}` : topic)}
                className="rounded-full px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
              >
                {topic}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tip */}
      <div
        className="rounded-xl p-3 text-xs"
        style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}
      >
        💡 İpucu: Hedef kitleyi, vurgulanması gereken noktaları ve istediğiniz uzunluğu belirtin.
      </div>
    </div>
  )
}
