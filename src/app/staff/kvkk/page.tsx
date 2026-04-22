'use client'

/**
 * KVKK Hak Talepleri — "Clinical Editorial" redesign.
 * 6698 sayılı Kanun kapsamındaki staff hak talepleri. Functionality korundu,
 * görsel tabaka editorial dile taşındı (cream + ink + gold + serif display).
 */

import { useState } from 'react'
import { Shield, Send, Clock, CheckCircle, AlertCircle, FileText, ChevronDown } from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import {
  INK, INK_SOFT, CREAM, GOLD, RULE, OLIVE, CARD_BG,
  FONT_DISPLAY, FONT_BODY, FONT_MONO, TONE_TOKENS,
} from '@/lib/editorial-palette'

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

const STATUS_CONFIG: Record<string, { label: string; tone: typeof TONE_TOKENS[keyof typeof TONE_TOKENS]; icon: typeof Clock }> = {
  pending: { label: 'Beklemede', tone: TONE_TOKENS.warning, icon: Clock },
  in_progress: { label: 'Isleniyor', tone: TONE_TOKENS.info, icon: AlertCircle },
  completed: { label: 'Tamamlandi', tone: TONE_TOKENS.success, icon: CheckCircle },
  rejected: { label: 'Reddedildi', tone: TONE_TOKENS.danger, icon: AlertCircle },
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
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{ backgroundColor: CREAM, color: INK, fontFamily: FONT_BODY }}
    >
      <div className="relative px-4 sm:px-10 lg:px-16 pt-5 pb-16">
        {/* ───── Masthead ───── */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b pb-5"
          style={{ borderColor: INK }}
        >
          <div className="flex items-end gap-4">
            <h1
              className="text-[36px] sm:text-[44px] leading-[0.95] font-semibold tracking-[-0.025em]"
              style={{ fontFamily: FONT_DISPLAY }}
            >
              Kisisel <span style={{ fontStyle: 'italic', color: OLIVE }}>verilerim</span>
              <span style={{ color: GOLD }}>.</span>
            </h1>
          </div>
        </header>
        <p
          className="mt-3 text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
        >
          6698 sayili Kanun kapsamindaki haklariniz ve talepleriniz
        </p>

        {/* ───── Bilgilendirme ───── */}
        <section
          className="mt-8 p-5 sm:p-6"
          style={{
            backgroundColor: TONE_TOKENS.info.bg,
            border: `1px solid ${TONE_TOKENS.info.border}`,
          }}
        >
          <div className="flex gap-4">
            <Shield
              className="h-5 w-5 shrink-0 mt-0.5"
              style={{ color: TONE_TOKENS.info.ink }}
            />
            <div>
              <h3
                className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: TONE_TOKENS.info.ink, fontFamily: FONT_MONO }}
              >
                KVKK Haklariniz
              </h3>
              <p
                className="text-[13px] leading-relaxed"
                style={{ color: INK }}
              >
                6698 sayili Kanun&apos;un 11. maddesi uyarinca; kisisel verilerinizin islenip islenmedigini ogrenme,
                islenmisse bilgi talep etme, isleme amacini ogrenme, ucuncu kisilere aktarilip aktarilmadigini ogrenme,
                eksik/yanlis islenmisse duzeltilmesini isteme, silinmesini/yok edilmesini isteme,
                otomatik sistemlerle aleyhine sonuc cikarilmasina itiraz etme ve kanuna aykiri isleme nedeniyle
                zararin giderilmesini talep etme haklariniz bulunmaktadir.
              </p>
              <p
                className="text-[11px] mt-3 font-semibold uppercase tracking-[0.16em]"
                style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
              >
                Talepler 30 gun icinde degerlendirilir
              </p>
            </div>
          </div>
        </section>

        {/* ───── Yeni Talep ───── */}
        <section
          className="mt-6"
          style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}` }}
        >
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="flex items-center justify-between w-full min-h-[44px] px-5 py-4"
          >
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4" style={{ color: GOLD }} />
              <h3
                className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: INK, fontFamily: FONT_MONO }}
              >
                Yeni Hak Talebi Olustur
              </h3>
            </div>
            <ChevronDown
              className="h-4 w-4"
              style={{
                color: INK_SOFT,
                transform: showForm ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 200ms',
              }}
            />
          </button>

          {showForm && (
            <form
              onSubmit={handleSubmit}
              className="px-5 pb-5 space-y-4 border-t pt-4"
              style={{ borderColor: RULE }}
            >
              {/* Talep Tipi */}
              <div>
                <label
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2 block"
                  style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                >
                  Talep Tipi
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-3 py-3 text-[13px] min-h-[44px] outline-none"
                  style={{
                    backgroundColor: CREAM,
                    border: `1px solid ${RULE}`,
                    color: INK,
                    fontFamily: FONT_BODY,
                  }}
                  required
                >
                  <option value="">Talep tipini secin...</option>
                  {Object.entries(REQUEST_TYPE_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>{val.label}</option>
                  ))}
                </select>
                {selectedType && (
                  <p className="text-[11px] mt-2" style={{ color: INK_SOFT }}>
                    {REQUEST_TYPE_LABELS[selectedType]?.desc}
                  </p>
                )}
              </div>

              {/* Aciklama */}
              <div>
                <label
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-2 block"
                  style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                >
                  Aciklama
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Talebinizi detayli olarak aciklayiniz..."
                  rows={4}
                  className="w-full px-3 py-3 text-[13px] resize-none outline-none"
                  style={{
                    backgroundColor: CREAM,
                    border: `1px solid ${RULE}`,
                    color: INK,
                    fontFamily: FONT_BODY,
                  }}
                  required
                  minLength={10}
                  maxLength={2000}
                />
                <p
                  className="text-[10px] mt-1 text-right tabular-nums"
                  style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                >
                  {description.length}/2000
                </p>
              </div>

              {message && (
                <div
                  className="px-4 py-3 text-[12px] font-medium"
                  style={{
                    backgroundColor: message.type === 'success' ? TONE_TOKENS.success.bg : TONE_TOKENS.danger.bg,
                    color: message.type === 'success' ? TONE_TOKENS.success.ink : TONE_TOKENS.danger.ink,
                    border: `1px solid ${message.type === 'success' ? TONE_TOKENS.success.border : TONE_TOKENS.danger.border}`,
                  }}
                >
                  {message.text}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !selectedType || description.length < 10}
                className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] px-5 py-2.5 w-full sm:w-auto min-h-[44px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: OLIVE,
                  color: CREAM,
                  fontFamily: FONT_MONO,
                }}
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Gonderiliyor...' : 'Talebi Gonder'}
              </button>
            </form>
          )}
        </section>

        {/* ───── Mevcut Talepler ───── */}
        <section
          className="mt-6"
          style={{ backgroundColor: CARD_BG, border: `1px solid ${RULE}` }}
        >
          <div
            className="flex items-center gap-2 px-5 py-4 border-b"
            style={{ borderColor: RULE }}
          >
            <FileText className="h-4 w-4" style={{ color: INK_SOFT }} />
            <h3
              className="text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: INK, fontFamily: FONT_MONO }}
            >
              Taleplerim
            </h3>
            <span
              className="text-[10px] font-semibold tabular-nums px-2 py-0.5 ml-auto"
              style={{
                backgroundColor: CREAM,
                color: INK_SOFT,
                border: `1px solid ${RULE}`,
                fontFamily: FONT_MONO,
              }}
            >
              {String(requests.length).padStart(2, '0')}
            </span>
          </div>

          {requests.length === 0 ? (
            <p
              className="text-[12px] text-center py-10 uppercase tracking-[0.16em]"
              style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
            >
              Henuz bir KVKK hak talebi olusturmadiniz.
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: RULE }}>
              {requests.map((req, i) => {
                const status = STATUS_CONFIG[req.status] ?? STATUS_CONFIG.pending
                const StatusIcon = status.icon
                return (
                  <div
                    key={req.id}
                    className="px-5 py-4"
                    style={{ borderColor: RULE }}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <span
                          className="text-[11px] font-semibold mt-0.5 tabular-nums"
                          style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p
                              className="text-[14px] font-semibold"
                              style={{ color: INK, fontFamily: FONT_DISPLAY }}
                            >
                              {REQUEST_TYPE_LABELS[req.requestType]?.label ?? req.requestType}
                            </p>
                            <span
                              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] px-2 py-0.5"
                              style={{
                                backgroundColor: status.tone.bg,
                                color: status.tone.ink,
                                border: `1px solid ${status.tone.border}`,
                                fontFamily: FONT_MONO,
                              }}
                            >
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </span>
                          </div>
                          <p
                            className="text-[12px] leading-relaxed line-clamp-2"
                            style={{ color: INK_SOFT }}
                          >
                            {req.description}
                          </p>
                          {req.responseNote && (
                            <div
                              className="mt-3 p-3"
                              style={{
                                backgroundColor: TONE_TOKENS.info.bg,
                                border: `1px solid ${TONE_TOKENS.info.border}`,
                              }}
                            >
                              <p
                                className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1"
                                style={{ color: TONE_TOKENS.info.ink, fontFamily: FONT_MONO }}
                              >
                                Yanit
                              </p>
                              <p className="text-[12px]" style={{ color: INK }}>
                                {req.responseNote}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <p
                        className="text-[10px] shrink-0 font-semibold uppercase tracking-[0.16em] tabular-nums"
                        style={{ color: INK_SOFT, fontFamily: FONT_MONO }}
                      >
                        {new Date(req.createdAt).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
