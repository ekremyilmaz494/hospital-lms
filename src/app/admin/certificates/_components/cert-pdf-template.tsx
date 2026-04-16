'use client'

import { forwardRef } from 'react'
import type { Certificate } from '../_types'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  cert: Certificate | null
}

export const CertPdfTemplate = forwardRef<HTMLDivElement, Props>(function CertPdfTemplate({ cert }, ref) {
  if (!cert) return null

  const statusText = cert.isRevoked ? 'İptal Edilmiş' : cert.isExpired ? 'Süresi Dolmuş' : 'Aktif'

  return (
    <div
      ref={ref}
      style={{
        display: 'none',
        width: '1122px',
        height: '793px',
        position: 'fixed',
        left: '-9999px',
        top: 0,
        background: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', inset: '20px', border: '3px solid var(--brand-600)', borderRadius: '4px' }}>
        <div style={{ position: 'absolute', inset: '6px', border: '1px solid color-mix(in srgb, var(--brand-600) 25%, transparent)' }} />
      </div>

      {[[24, 24], [1122 - 24 - 40, 24], [24, 793 - 24 - 40], [1122 - 24 - 40, 793 - 24 - 40]].map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute', left: `${x}px`, top: `${y}px`, width: '40px', height: '40px', border: '1.5px solid var(--brand-600)', borderRadius: '2px' }} />
      ))}

      <div style={{ position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '6px', background: 'linear-gradient(90deg, var(--brand-600), var(--brand-800))', borderRadius: '3px' }} />

      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 80px' }}>

        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 20px color-mix(in srgb, var(--brand-600) calc(0.3 * 100%), transparent)' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--brand-600), var(--brand-800))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: 'bold' }}>✓</div>
          </div>
        </div>

        <h1 style={{ fontSize: '38px', fontWeight: 800, color: '#0f172a', letterSpacing: '2px', margin: '16px 0 4px', textAlign: 'center' }}>TAMAMLAMA SERTİFİKASI</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, letterSpacing: '1px' }}>Devakent Hastanesi Eğitim Programı</p>

        <div style={{ width: '300px', height: '1px', background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)', margin: '20px 0' }} />

        <p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 8px' }}>Bu Sertifika</p>

        <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', textAlign: 'center' }}>{cert.user.name}</h2>
        <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
          {cert.user.department}{cert.user.title ? ` · ${cert.user.title}` : ''}
        </p>

        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '12px 0 0', textAlign: 'center' }}>
          adlı personele, aşağıdaki eğitimi başarıyla tamamladığı için verilmiştir.
        </p>

        <div style={{ width: '300px', height: '1px', background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)', margin: '20px 0' }} />

        <h3 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--brand-600)', margin: '0 0 6px', textAlign: 'center' }}>{cert.training.title}</h3>
        {cert.training.category && (
          <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '3px 12px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {cert.training.category}
          </span>
        )}

        <div style={{ display: 'flex', gap: '16px', margin: '24px 0' }}>
          {[
            { label: 'PUAN', value: `${cert.score}%` },
            { label: 'DENEME', value: `${cert.attemptNumber}.` },
            { label: 'DURUM', value: statusText },
          ].map((b) => (
            <div key={b.label} style={{ width: '140px', background: '#f1f5f9', borderRadius: '10px', padding: '12px 0', textAlign: 'center' }}>
              <p style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '2px', margin: '0 0 4px', textTransform: 'uppercase' }}>{b.label}</p>
              <p style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{b.value}</p>
            </div>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: '700px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
          <div>
            <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Sertifika Kodu</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-600)', margin: 0, fontFamily: 'monospace' }}>{cert.certificateCode}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Veriliş Tarihi</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{formatDate(cert.issuedAt)}</p>
          </div>
          {cert.expiresAt && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Geçerlilik Tarihi</p>
              <p style={{ fontSize: '13px', fontWeight: 700, color: cert.isExpired ? '#dc2626' : '#0f172a', margin: 0 }}>{formatDate(cert.expiresAt)}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '5px', background: 'linear-gradient(90deg, var(--brand-600), var(--brand-800))', borderRadius: '3px' }} />
    </div>
  )
})
