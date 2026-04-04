'use client'

import { Check, Clock } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import type { FormatConfig, ArtifactType } from '../types'
import { COMMON_SETTINGS, DEFAULT_COMMON_SETTINGS } from '../lib/format-config'

interface FormatSelectorProps {
  formats: FormatConfig[]
  selected: ArtifactType | null
  onChange: (format: ArtifactType) => void
  formatOptions: Record<string, string>
  onOptionChange: (key: string, value: string) => void
  suggestedFormats?: ArtifactType[]
}

export function FormatSelector({
  formats, selected, onChange, formatOptions, onOptionChange, suggestedFormats,
}: FormatSelectorProps) {
  const selectedConfig = formats.find(f => f.id === selected)

  return (
    <div className="space-y-6">
      {/* Format Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {formats.map((fmt) => {
          const isSelected = selected === fmt.id
          const isSuggested = suggestedFormats?.includes(fmt.id)

          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => onChange(fmt.id)}
              className="relative rounded-2xl p-4 text-left transition-all duration-200"
              style={{
                background: 'var(--color-surface)',
                border: `2px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                boxShadow: isSelected
                  ? '0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent), var(--shadow-md)'
                  : 'var(--shadow-sm)',
                transform: isSelected ? 'translateY(-2px)' : 'none',
              }}
            >
              {/* Selected check */}
              {isSelected && (
                <span
                  className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Check className="h-3 w-3 text-white" />
                </span>
              )}

              {/* Suggested badge */}
              {isSuggested && !isSelected && (
                <span
                  className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                  style={{ background: 'var(--color-success)', color: 'white' }}
                >
                  Önerilen
                </span>
              )}

              <span className="text-3xl">{fmt.icon}</span>
              <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                {fmt.label}
              </p>
              <p className="mt-1 line-clamp-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {fmt.description}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}
                >
                  <Clock className="h-3 w-3" />
                  ~{fmt.estimatedMinutes} dk
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                >
                  {fmt.outputExtension}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Format-Specific Options */}
      {selectedConfig && selectedConfig.options.length > 0 && (
        <BlurFade>
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              <span className="text-lg">{selectedConfig.icon}</span>
              Format Ayarları
            </p>
            <div className="space-y-4">
              {selectedConfig.options.map((opt) => (
                <OptionRow
                  key={opt.key}
                  label={opt.label}
                  values={opt.values}
                  selected={formatOptions[opt.key] || opt.default}
                  onChange={(val) => onOptionChange(opt.key, val)}
                />
              ))}
            </div>
          </div>
        </BlurFade>
      )}

      {/* Common Settings */}
      {selected && (
        <BlurFade delay={0.1}>
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <p className="mb-4 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Genel Ayarlar
            </p>
            <div className="space-y-4">
              {COMMON_SETTINGS.map((setting) => (
                <OptionRow
                  key={setting.key}
                  label={`${setting.icon} ${setting.label}`}
                  values={setting.values}
                  selected={formatOptions[setting.key] || DEFAULT_COMMON_SETTINGS[setting.key] || setting.default}
                  onChange={(val) => onOptionChange(setting.key, val)}
                />
              ))}
            </div>
          </div>
        </BlurFade>
      )}
    </div>
  )
}

function OptionRow({
  label, values, selected, onChange,
}: {
  label: string
  values: { value: string; label: string }[]
  selected: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => onChange(v.value)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              background: selected === v.value ? 'var(--color-primary)' : 'var(--color-surface-hover)',
              color: selected === v.value ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
