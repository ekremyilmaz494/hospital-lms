'use client'

import React, { useState, useCallback } from 'react'
import { Sparkles, CheckCircle2, AlertTriangle, Loader2, RefreshCw, KeyRound, Clock } from 'lucide-react'
import { useFetch } from '@/hooks/use-fetch'
import { useToast } from '@/components/shared/toast'
import { K } from '@/components/ai-studio/k-tokens'

interface HealthResponse {
  workerOk: boolean
  connected: boolean
  reason?: string
}

export default function KlinovaAiPage() {
  const { toast: showToast } = useToast()
  const healthQuery = useFetch<HealthResponse>('/api/admin/ai-content-studio/health')

  const [panelOpen, setPanelOpen] = useState(false)
  const [sessionJson, setSessionJson] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = useCallback(async () => {
    if (!sessionJson.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/ai-content-studio/shared-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageStateJson: sessionJson.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        showToast(json.error ?? 'Oturum yüklenemedi', 'error')
        return
      }
      showToast('Oturum başarıyla güncellendi ✓', 'success')
      setSessionJson('')
      setPanelOpen(false)
      healthQuery.refetch()
    } catch {
      showToast('Sunucuya ulaşılamadı', 'error')
    } finally {
      setSaving(false)
    }
  }, [sessionJson, showToast, healthQuery])

  const aiReady = Boolean(healthQuery.data?.workerOk && healthQuery.data?.connected)

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{
          margin: 0, fontSize: 24, fontWeight: 700, color: K.TEXT_PRIMARY,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <Sparkles size={24} color={K.PRIMARY} />
          Klinova AI — Oturum Yönetimi
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: K.TEXT_MUTED }}>
          Paylaşımlı Google/NotebookLM oturumu burada yönetilir. Oturum süresi dolunca yeni storage_state.json yükleyin.
        </p>
      </div>

      {/* Durum kartı */}
      <div style={{
        background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`,
        borderRadius: 16, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: K.TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>
          Oturum Durumu
        </div>

        {healthQuery.isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: K.TEXT_MUTED, fontSize: 14 }}>
            <Loader2 size={16} className="animate-spin" /> Kontrol ediliyor...
          </div>
        )}

        {!healthQuery.isLoading && aiReady && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 10,
            background: K.SUCCESS_BG, border: `1px solid ${K.SUCCESS}`,
          }}>
            <CheckCircle2 size={20} color={K.SUCCESS} />
            <div>
              <div style={{ fontWeight: 600, color: K.TEXT_PRIMARY, fontSize: 14 }}>Oturum aktif</div>
              <div style={{ fontSize: 12, color: K.TEXT_SECONDARY, marginTop: 2 }}>
                NotebookLM bağlantısı çalışıyor. Keepalive her 2 saatte bir çalışır.
              </div>
            </div>
          </div>
        )}

        {!healthQuery.isLoading && !aiReady && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 10,
            background: K.WARNING_BG, border: `1px solid ${K.WARNING}`,
          }}>
            <AlertTriangle size={20} color={K.WARNING} />
            <div>
              <div style={{ fontWeight: 600, color: K.TEXT_PRIMARY, fontSize: 14 }}>Oturum süresi dolmuş</div>
              <div style={{ fontSize: 12, color: K.TEXT_SECONDARY, marginTop: 2 }}>
                {healthQuery.data?.reason ?? 'storage_state.json bulunamadı veya geçersiz.'}
              </div>
            </div>
          </div>
        )}

        {/* Keepalive bilgisi */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8,
          background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`,
          fontSize: 13, color: K.TEXT_SECONDARY,
        }}>
          <Clock size={14} color={K.TEXT_MUTED} />
          Otomatik keepalive: her <strong style={{ color: K.TEXT_PRIMARY }}>2 saatte bir</strong> çalışır — Google oturumunu aktif tutar.
        </div>

        {/* Oturumu yenile butonu */}
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          style={{
            alignSelf: 'flex-start',
            padding: '10px 18px', borderRadius: 10,
            border: `1px solid ${K.PRIMARY}`, background: 'transparent',
            color: K.PRIMARY, cursor: 'pointer',
            fontSize: 14, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}
        >
          <KeyRound size={16} />
          {panelOpen ? 'Paneli Kapat' : 'Oturumu Yenile'}
        </button>

        {panelOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: K.TEXT_SECONDARY }}>
              Terminalden <code style={{ background: K.BORDER_LIGHT, padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>notebooklm login</code> çalıştırın, çıkan <code style={{ background: K.BORDER_LIGHT, padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>storage_state.json</code> içeriğini aşağıya yapıştırın.
            </div>
            <textarea
              value={sessionJson}
              onChange={(e) => setSessionJson(e.target.value)}
              placeholder={'{"cookies":[...],"origins":[...]}'}
              rows={8}
              style={{
                width: '100%', padding: 12, borderRadius: 10,
                border: `1px solid ${K.BORDER}`, background: K.BG,
                fontSize: 12, color: K.TEXT_PRIMARY, resize: 'vertical',
                fontFamily: 'JetBrains Mono, monospace', lineHeight: 1.6,
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setPanelOpen(false); setSessionJson('') }}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: `1px solid ${K.BORDER}`, background: 'transparent',
                  color: K.TEXT_SECONDARY, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!sessionJson.trim() || saving}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: !sessionJson.trim() || saving ? K.BORDER : K.PRIMARY,
                  color: K.SURFACE,
                  cursor: !sessionJson.trim() || saving ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {saving ? 'Yükleniyor...' : 'Oturumu Kaydet'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
