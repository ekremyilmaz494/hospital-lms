'use client'

/**
 * Klinova AI shared session — bilgilendirme sayfası.
 *
 * Müşteri (admin) kendisi NotebookLM hesabı bağlamaz; Klinova ortak hesabı
 * kullanılır. Bu sayfa eski bağlama akışından kalan link'lerle gelenleri
 * studio'ya yönlendirir + nasıl çalıştığını açıklar.
 */
import React from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles, Info } from 'lucide-react'

const K = {
  PRIMARY: '#0d9668',
  PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff',
  BG: '#fafaf9',
  BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  INFO: '#3b82f6',
  INFO_BG: '#dbeafe',
} as const

export default function ConnectInfoPage() {
  return (
    <div style={{ background: K.BG, minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link
          href="/admin/ai-content-studio"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, color: K.TEXT_MUTED,
            textDecoration: 'none', fontSize: 14, marginBottom: 16,
          }}
        >
          <ArrowLeft size={16} />
          AI İçerik Stüdyosu'na dön
        </Link>

        <h1 style={{
          fontSize: 28, fontWeight: 700, color: K.TEXT_PRIMARY, margin: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Sparkles size={28} color={K.PRIMARY} />
          Klinova AI Hakkında
        </h1>

        <div style={{
          background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`,
          borderRadius: 16, padding: 24, marginTop: 24,
        }}>
          <p style={{ fontSize: 15, color: K.TEXT_SECONDARY, lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: K.TEXT_PRIMARY }}>Hesap bağlama gerekmiyor.</strong>{' '}
            Klinova LMS, hastaneniz adına ortak bir Google/NotebookLM altyapısı kullanır.
            Bu sayede AI İçerik Stüdyosu'na girer girmez kaynaklarınızı yükleyip içerik
            üretmeye başlayabilirsiniz — ek kurulum yok.
          </p>
        </div>

        <div style={{
          background: K.INFO_BG, border: `1px solid ${K.INFO}`,
          borderRadius: 12, padding: 16, marginTop: 16,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <Info size={20} color={K.INFO} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: K.TEXT_SECONDARY, lineHeight: 1.6 }}>
            <strong style={{ color: K.TEXT_PRIMARY }}>Veri gizliliği:</strong> Yüklediğiniz
            kaynaklar yalnızca sizin hastanenizin AI üretimleri için kullanılır. Üretilen
            tüm içerikler hastane bazında ayrılır — başka hastaneler erişemez.
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <Link
            href="/admin/ai-content-studio"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 10,
              background: K.PRIMARY, color: K.SURFACE, fontWeight: 600,
              textDecoration: 'none', fontSize: 15,
            }}
          >
            <Sparkles size={16} />
            AI İçerik Stüdyosu'na git
          </Link>
        </div>
      </div>
    </div>
  )
}
