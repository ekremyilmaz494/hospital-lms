'use client'

import { Check, Clock, MessageSquare, Users, Globe } from 'lucide-react'
import type { OutputFormat } from '../types'
import type { FormatConfig } from '../lib/format-config'
import {
  DURATION_OPTIONS,
  TONE_OPTIONS,
  AUDIENCE_OPTIONS,
  LANGUAGE_OPTIONS,
} from '../lib/format-config'

interface Props {
  formats: FormatConfig[]
  selected: OutputFormat | null
  onChange: (format: OutputFormat) => void
  formatOptions: Record<string, string>
  onOptionChange: (key: string, value: string) => void
}

/* ─── Ortak ayar satırı ─── */
function SettingRow({
  icon: Icon,
  label,
  options,
  value,
  onChange,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ background: 'var(--color-bg)' }}
      >
        <Icon className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <div className="flex-1 space-y-1.5">
        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {options.map((opt) => {
            const isActive = value === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => onChange(opt.value)}
                className="rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-all duration-150"
                style={{
                  borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                  background: isActive ? 'var(--color-primary)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function FormatSelector({ formats, selected, onChange, formatOptions, onOptionChange }: Props) {
  const selectedConfig = formats.find((f) => f.id === selected) ?? null

  return (
    <div className="space-y-5">
      {/* ── Format kartları ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {formats.map((fmt) => {
          const isSelected = selected === fmt.id
          return (
            <button
              key={fmt.id}
              onClick={() => onChange(fmt.id)}
              className="relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200"
              style={{
                borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                boxShadow: isSelected ? '0 0 0 2px var(--color-primary)' : 'var(--shadow-sm)',
              }}
            >
              {isSelected && (
                <span
                  className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                >
                  <Check className="h-3 w-3 text-white" strokeWidth={3} />
                </span>
              )}

              <span className="text-3xl leading-none">{fmt.icon}</span>

              <div className="flex-1">
                <p className="text-[13px] font-bold leading-tight">{fmt.label}</p>
                <p className="mt-0.5 text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
                  {fmt.description}
                </p>
              </div>

              {/* Çıktı + süre badge */}
              <div className="flex items-center gap-1.5">
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                  style={{
                    background: isSelected ? 'rgba(13,150,104,0.15)' : 'var(--color-bg)',
                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  }}
                >
                  ⏱ {fmt.estimatedMinutes}
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                  style={{
                    background: 'var(--color-bg)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {fmt.outputFileType}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Formata özel ayarlar ── */}
      {selectedConfig?.options && selectedConfig.options.length > 0 && (
        <div
          className="rounded-2xl border p-4 space-y-4"
          style={{ borderColor: 'var(--color-primary)', background: 'var(--color-primary-light)' }}
        >
          <p className="text-[12px] font-bold" style={{ color: 'var(--color-primary)' }}>
            {selectedConfig.icon} {selectedConfig.label} Ayarları
          </p>
          {selectedConfig.options.map((opt) => {
            const currentVal = formatOptions[opt.key] ?? opt.default
            return (
              <div key={opt.key} className="space-y-2">
                <p className="text-[12px] font-semibold">{opt.label}</p>
                <div className="flex flex-wrap gap-2">
                  {opt.values.map((v) => {
                    const isActive = currentVal === v.value
                    return (
                      <button
                        key={v.value}
                        onClick={() => onOptionChange(opt.key, v.value)}
                        className="rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all duration-150"
                        style={{
                          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                          background: isActive ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: isActive ? '#fff' : 'var(--color-text-secondary)',
                          boxShadow: isActive ? 'var(--shadow-sm)' : undefined,
                        }}
                      >
                        {v.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Ek Ayarlar (tüm formatlar için ortak) ── */}
      {selected && (
        <div
          className="rounded-2xl border p-5 space-y-4"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <p className="text-[13px] font-bold">Ek Ayarlar</p>

          <SettingRow
            icon={Clock}
            label="Süre"
            options={DURATION_OPTIONS}
            value={formatOptions['duration'] ?? '10'}
            onChange={(v) => onOptionChange('duration', v)}
          />

          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

          <SettingRow
            icon={MessageSquare}
            label="Ton"
            options={TONE_OPTIONS}
            value={formatOptions['tone'] ?? 'formal'}
            onChange={(v) => onOptionChange('tone', v)}
          />

          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

          <SettingRow
            icon={Users}
            label="Hedef Kitle"
            options={AUDIENCE_OPTIONS}
            value={formatOptions['audience'] ?? 'all_staff'}
            onChange={(v) => onOptionChange('audience', v)}
          />

          <div className="border-t" style={{ borderColor: 'var(--color-border)' }} />

          <SettingRow
            icon={Globe}
            label="Dil"
            options={LANGUAGE_OPTIONS}
            value={formatOptions['language'] ?? 'tr'}
            onChange={(v) => onOptionChange('language', v)}
          />
        </div>
      )}

      {!selected && (
        <p className="text-center text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
          Üretilecek içerik türünü seçin
        </p>
      )}
    </div>
  )
}
