'use client'

import { useState } from 'react'
import { CreditCard, X } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/components/shared/toast'

export interface PlanFormValue {
  id?: string
  name: string
  slug: string
  description?: string | null
  maxStaff?: number | null
  maxTrainings?: number | null
  maxStorageGb: number
  priceMonthly?: number
  priceAnnual?: number
  features: string[]
  hasStaffIntegration: boolean
}

interface PlanModalProps {
  initial?: PlanFormValue | null
  onClose: () => void
  onSaved: () => void
}

export default function PlanModal({ initial, onClose, onSaved }: PlanModalProps) {
  const { toast } = useToast()
  const isEdit = Boolean(initial?.id)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<PlanFormValue>({
    id: initial?.id,
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    description: initial?.description ?? '',
    maxStaff: initial?.maxStaff ?? null,
    maxTrainings: initial?.maxTrainings ?? null,
    maxStorageGb: initial?.maxStorageGb ?? 10,
    priceMonthly: initial?.priceMonthly ?? 0,
    priceAnnual: initial?.priceAnnual ?? 0,
    features: initial?.features ?? [],
    hasStaffIntegration: initial?.hasStaffIntegration ?? false,
  })
  const [featureInput, setFeatureInput] = useState('')

  const addFeature = () => {
    const trimmed = featureInput.trim()
    if (!trimmed) return
    setForm(p => ({ ...p, features: [...p.features, trimmed] }))
    setFeatureInput('')
  }

  const removeFeature = (idx: number) => {
    setForm(p => ({ ...p, features: p.features.filter((_, i) => i !== idx) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast('Plan adı zorunludur', 'error'); return }
    if (!form.slug.trim()) { toast('Plan slug zorunludur', 'error'); return }

    setLoading(true)
    try {
      const payload = {
        ...(isEdit ? { id: form.id } : {}),
        name: form.name.trim(),
        slug: form.slug.trim().toLowerCase(),
        description: form.description?.trim() || undefined,
        maxStaff: form.maxStaff ?? undefined,
        maxTrainings: form.maxTrainings ?? undefined,
        maxStorageGb: form.maxStorageGb,
        priceMonthly: form.priceMonthly && form.priceMonthly > 0 ? form.priceMonthly : undefined,
        priceAnnual: form.priceAnnual && form.priceAnnual > 0 ? form.priceAnnual : undefined,
        features: form.features,
        hasStaffIntegration: form.hasStaffIntegration,
      }

      const res = await fetch('/api/super-admin/subscriptions', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'İşlem başarısız')
      toast(isEdit ? 'Plan güncellendi' : 'Plan eklendi', 'success')
      onSaved()
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
              <CreditCard className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h2 className="text-lg font-bold font-heading" style={{ color: 'var(--color-text-primary)' }}>
              {isEdit ? 'Planı Düzenle' : 'Yeni Plan Ekle'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-[var(--color-surface-hover)]">
            <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Plan Adı *</label>
              <input className={inputCls} style={inputStyle} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} maxLength={100} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Slug *</label>
              <input className={inputCls} style={inputStyle} value={form.slug} onChange={e => setForm(p => ({ ...p, slug: e.target.value }))} placeholder="starter, pro, enterprise..." disabled={isEdit} maxLength={50} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Açıklama</label>
            <textarea className={inputCls} style={{ ...inputStyle, resize: 'none' }} rows={2} value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Aylık Fiyat (₺)</label>
              <input type="number" min={0} className={inputCls} style={inputStyle} value={form.priceMonthly ?? 0} onChange={e => setForm(p => ({ ...p, priceMonthly: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Yıllık Fiyat (₺)</label>
              <input type="number" min={0} className={inputCls} style={inputStyle} value={form.priceAnnual ?? 0} onChange={e => setForm(p => ({ ...p, priceAnnual: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel Limiti</label>
              <input type="number" min={1} placeholder="Sınırsız" className={inputCls} style={inputStyle} value={form.maxStaff ?? ''} onChange={e => setForm(p => ({ ...p, maxStaff: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim Limiti</label>
              <input type="number" min={1} placeholder="Sınırsız" className={inputCls} style={inputStyle} value={form.maxTrainings ?? ''} onChange={e => setForm(p => ({ ...p, maxTrainings: e.target.value ? Number(e.target.value) : null }))} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Depolama (GB)</label>
              <input type="number" min={1} className={inputCls} style={inputStyle} value={form.maxStorageGb} onChange={e => setForm(p => ({ ...p, maxStorageGb: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Modül Erişimi</label>
            <label
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5"
              style={{
                borderColor: form.hasStaffIntegration ? 'var(--color-primary)' : 'var(--color-border)',
                background: form.hasStaffIntegration ? 'var(--color-primary-light)' : 'var(--color-surface-hover)',
              }}
            >
              <Checkbox
                checked={form.hasStaffIntegration}
                onCheckedChange={checked => setForm(p => ({ ...p, hasStaffIntegration: !!checked }))}
                className="mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Personel Entegrasyonu (İK/HBYS)
                </span>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  İK/HBYS sistemleriyle personel senkronizasyonunu bu planda etkinleştirir.
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Özellikler</label>
            <div className="flex gap-2 mb-2">
              <input
                className={inputCls}
                style={inputStyle}
                value={featureInput}
                onChange={e => setFeatureInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFeature() } }}
                placeholder="Yeni özellik..."
              />
              <button type="button" onClick={addFeature} className="rounded-lg px-4 text-sm font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
                Ekle
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.features.map((f, idx) => (
                <span key={idx} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                  {f}
                  <button type="button" onClick={() => removeFeature(idx)} className="opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {form.features.length === 0 && (
                <span className="text-xs italic" style={{ color: 'var(--color-text-muted)' }}>Henüz özellik eklenmedi</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--color-surface-hover)]" style={{ color: 'var(--color-text-secondary)' }}>İptal</button>
            <button type="submit" disabled={loading} className="rounded-xl px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-60" style={{ background: 'var(--color-primary)' }}>
              {loading ? 'Kaydediliyor...' : isEdit ? 'Güncelle' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
