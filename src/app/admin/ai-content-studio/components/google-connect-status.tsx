// ─── Google Bağlantı Durumu Kartı ───
// Bağlı hesap bilgileri + durum badge (aktif/hata/süresi dolmuş)

'use client'

import { CheckCircle2, XCircle, Clock, Mail, Shield, Calendar } from 'lucide-react'

interface ConnectionInfo {
  connected: boolean
  email: string | null
  status: string
  method?: string
  lastVerifiedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  errorMessage?: string | null
}

interface Props {
  connection: ConnectionInfo
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'connected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
        <CheckCircle2 className="h-3.5 w-3.5" /> Aktif
      </span>
    )
  }
  if (status === 'expired') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
        <Clock className="h-3.5 w-3.5" /> Süresi Dolmuş
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
      <XCircle className="h-3.5 w-3.5" /> Hata
    </span>
  )
}

export function GoogleConnectStatus({ connection }: Props) {
  return (
    <div
      className="rounded-2xl border p-5 space-y-4"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Başlık + badge */}
      <div className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold">Google Hesap Bağlantısı</h3>
        <StatusBadge status={connection.status} />
      </div>

      {/* Detaylar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoRow icon={Mail} label="E-posta" value={connection.email ?? '—'} />
        <InfoRow icon={Shield} label="Yöntem" value={connection.method === 'browser' ? 'Browser Login' : 'Manuel Cookie'} />
        <InfoRow icon={Calendar} label="Son Doğrulama" value={formatDate(connection.lastVerifiedAt)} />
        <InfoRow icon={Clock} label="Son Kullanım" value={formatDate(connection.lastUsedAt)} />
      </div>

      {/* Hata mesajı */}
      {connection.errorMessage && (
        <div
          className="flex items-start gap-2 rounded-xl p-3 text-[12px]"
          style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
        >
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{connection.errorMessage}</p>
        </div>
      )}

      {/* Süre bilgisi */}
      {connection.expiresAt && (
        <div
          className="flex items-center gap-2 rounded-xl p-3 text-[12px]"
          style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
        >
          <Clock className="h-4 w-4 shrink-0" />
          <p>Cookie süresi: {formatDate(connection.expiresAt)}</p>
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--color-bg)' }}>
        <Icon className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
      </div>
      <div>
        <p className="text-[10px] font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
        <p className="text-[13px] font-semibold">{value}</p>
      </div>
    </div>
  )
}
