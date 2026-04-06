'use client'

import { useState } from 'react'
import { Shield, Send, Clock, CheckCircle, AlertCircle, FileText, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFetch } from '@/hooks/use-fetch'
import { PageHeader } from '@/components/shared/page-header'

const REQUEST_TYPE_LABELS: Record<string, { label: string; desc: string }> = {
  access: { label: 'Veri Isleme Sorgusu', desc: 'Kisisel verilerimin islenip islenmedigini ogrenmek istiyorum' },
  detail: { label: 'Veri Detay Talebi', desc: 'Islenen kisisel verilerim hakkinda bilgi talep ediyorum' },
  purpose: { label: 'Isleme Amaci Sorgusu', desc: 'Verilerimin isleme amacini ve amacina uygun kullanilip kullanilmadigini ogrenmek istiyorum' },
  third_party: { label: 'Ucuncu Kisi Aktarim Sorgusu', desc: 'Verilerimin ucuncu kisilere aktarilip aktarilmadigini ogrenmek istiyorum' },
  correction: { label: 'Duzeltme Talebi', desc: 'Eksik veya yanlis islenen kisisel verilerimin duzeltilmesini istiyorum' },
  deletion: { label: 'Silme / Yok Etme Talebi', desc: 'Kisisel verilerimin silinmesini veya yok edilmesini talep ediyorum' },
  notification: { label: 'Ucuncu Kisi Bildirim Talebi', desc: 'Duzeltme/silme islemlerinin verilerimin aktarildigi ucuncu kisilere bildirilmesini istiyorum' },
  objection: { label: 'Otomatik Karar Itiraz', desc: 'Otomatik sistemler vasitasiyla aleyhime bir sonuc cikarilmasina itiraz ediyorum' },
  damage: { label: 'Zarar Giderim Talebi', desc: 'Kanuna aykiri isleme nedeniyle ugradim zararin giderilmesini talep ediyorum' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: 'Beklemede', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: Clock },
  in_progress: { label: 'Isleniyor', color: 'var(--color-info)', bg: 'color-mix(in srgb, var(--color-info) 12%, transparent)', icon: AlertCircle },
  completed: { label: 'Tamamlandi', color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle },
  rejected: { label: 'Reddedildi', color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: AlertCircle },
}

interface KvkkRequest {
  id: string
  requestType: string
  status: string
  description: string
  responseNote: string | null
  createdAt: string
  completedAt: string | null
}

export default function StaffKvkkPage() {
  const { data, refetch } = useFetch<{ requests: KvkkRequest[] }>('/api/staff/kvkk-requests')
  const [selectedType, setSelectedType] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showForm, setShowForm] = useState(false)

  const requests = data?.requests ?? []

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedType || description.length < 10) return

    setSubmitting(true)
    setMessage(null)

    try {
      const res = await fetch('/api/staff/kvkk-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: selectedType, description }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Bir hata olustu' })
      } else {
        setMessage({ type: 'success', text: data.message })
        setSelectedType('')
        setDescription('')
        setShowForm(false)
        refetch()
      }
    } catch {
      setMessage({ type: 'error', text: 'Baglanti hatasi. Lutfen tekrar deneyin.' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kisisel Verilerim (KVKK)"
        subtitle="6698 sayili Kisisel Verilerin Korunmasi Kanunu kapsamindaki haklariniz"
      />

      {/* Bilgilendirme */}
      <div
        className="rounded-2xl p-5"
        style={{ background: 'color-mix(in srgb, var(--color-primary) 6%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary) 15%, transparent)' }}
      >
        <div className="flex gap-3">
          <Shield className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--color-primary)' }} />
          <div>
            <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-primary)' }}>KVKK Haklariniz</h3>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              6698 sayili Kanun&apos;un 11. maddesi uyarinca; kisisel verilerinizin islenip islenmedigini ogrenme,
              islenmisse bilgi talep etme, isleme amacini ogrenme, ucuncu kisilere aktarilip aktarilmadigini ogrenme,
              eksik/yanlis islenmisse duzeltilmesini isteme, silinmesini/yok edilmesini isteme,
              otomatik sistemlerle aleyhine sonuc cikarilmasina itiraz etme ve kanuna aykiri isleme nedeniyle
              zararin giderilmesini talep etme haklariniz bulunmaktadir.
            </p>
            <p className="text-xs mt-2 font-medium" style={{ color: 'var(--color-text-muted)' }}>
              Talepleriniz yasal sure olan 30 gun icinde degerlendirilir.
            </p>
          </div>
        </div>
      </div>

      {/* Yeni Talep */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            <h3 className="text-sm font-bold">Yeni Hak Talebi Olustur</h3>
          </div>
          <ChevronDown
            className="h-4 w-4 transition-transform"
            style={{ color: 'var(--color-text-muted)', transform: showForm ? 'rotate(180deg)' : 'rotate(0)' }}
          />
        </button>

        {showForm && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Talep Tipi */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                Talep Tipi
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                required
              >
                <option value="">Talep tipini secin...</option>
                {Object.entries(REQUEST_TYPE_LABELS).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              {selectedType && (
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
                  {REQUEST_TYPE_LABELS[selectedType]?.desc}
                </p>
              )}
            </div>

            {/* Aciklama */}
            <div>
              <label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                Aciklama
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Talebinizi detayli olarak aciklayiniz..."
                rows={4}
                className="w-full rounded-xl px-4 py-3 text-sm resize-none"
                style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                required
                minLength={10}
                maxLength={2000}
              />
              <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--color-text-muted)' }}>
                {description.length}/2000
              </p>
            </div>

            {message && (
              <div
                className="rounded-xl px-4 py-3 text-xs font-medium"
                style={{
                  background: message.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                  color: message.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
                }}
              >
                {message.text}
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !selectedType || description.length < 10}
              className="gap-2 text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Gonderiliyor...' : 'Talebi Gonder'}
            </Button>
          </form>
        )}
      </div>

      {/* Mevcut Talepler */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          <h3 className="text-sm font-bold">Taleplerim</h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
            {requests.length}
          </span>
        </div>

        {requests.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
            Henuz bir KVKK hak talebi olusturmadiniz.
          </p>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const status = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending
              const StatusIcon = status.icon
              return (
                <div
                  key={req.id}
                  className="rounded-xl p-4"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-bold" style={{ color: 'var(--color-text-primary)' }}>
                          {REQUEST_TYPE_LABELS[req.requestType]?.label ?? req.requestType}
                        </p>
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: status.bg, color: status.color }}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[11px] line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                        {req.description}
                      </p>
                      {req.responseNote && (
                        <div className="mt-2 rounded-lg p-2.5" style={{ background: 'color-mix(in srgb, var(--color-info) 8%, transparent)' }}>
                          <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--color-info)' }}>Yanit:</p>
                          <p className="text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>{req.responseNote}</p>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] shrink-0" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(req.createdAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
