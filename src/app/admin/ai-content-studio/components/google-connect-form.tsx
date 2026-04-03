// ─── Google Hesap Bağlama Formu ───
// Tek butonla tarayıcı açılır, Google ile giriş yapılır, cookie otomatik kaydedilir.

'use client'

import { useState } from 'react'
import { Loader2, Mail, ArrowRight, Monitor, Shield } from 'lucide-react'

interface Props {
  onConnect: (email: string, method: string, cookieData?: string) => Promise<void>
  loading: boolean
}

export function GoogleConnectForm({ onConnect, loading }: Props) {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  const validateEmail = (v: string) => {
    if (!v) return 'E-posta zorunludur.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Geçerli bir e-posta girin.'
    return ''
  }

  const handleSubmit = async () => {
    const err = validateEmail(email)
    if (err) { setEmailError(err); return }
    setEmailError('')
    await onConnect(email, 'browser')
  }

  const isValid = email && !validateEmail(email)

  return (
    <div className="space-y-5">
      {/* E-posta */}
      <div className="space-y-1.5">
        <label className="flex items-center gap-1.5 text-[12px] font-semibold">
          <Mail className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
          Google E-posta <span style={{ color: 'var(--color-error)' }}>*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setEmailError('') }}
          placeholder="ornek@gmail.com"
          className="w-full rounded-xl border px-4 py-2.5 text-[13px] outline-none transition-all"
          style={{
            borderColor: emailError ? 'var(--color-error)' : 'var(--color-border)',
            background: 'var(--color-bg)',
          }}
          onFocus={(e) => { if (!emailError) e.target.style.borderColor = 'var(--color-primary)' }}
          onBlur={(e) => { if (!emailError) e.target.style.borderColor = 'var(--color-border)' }}
        />
        {emailError && (
          <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>{emailError}</p>
        )}
      </div>

      {/* Nasıl çalışır */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: 'var(--color-info-bg)' }}
      >
        <p className="text-[12px] font-semibold" style={{ color: 'var(--color-info)' }}>
          Nasıl çalışır?
        </p>
        <div className="space-y-1.5">
          <Step num={1} text="Butona tıklayın — tarayıcı penceresi açılacak" />
          <Step num={2} text="Google hesabınızla NotebookLM'e giriş yapın" />
          <Step num={3} text="Giriş tamamlanınca bağlantı otomatik kaydedilir" />
        </div>
      </div>

      {/* Güvenlik notu */}
      <div className="flex items-start gap-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
        <Shield className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p>Giriş bilgileriniz AES-256 ile şifrelenerek saklanır. Düz metin olarak hiçbir yerde tutulmaz.</p>
      </div>

      {/* Bağla butonu */}
      <button
        onClick={handleSubmit}
        disabled={!isValid || loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-white transition-all disabled:opacity-40"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
          boxShadow: isValid && !loading ? 'var(--shadow-md)' : undefined,
        }}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Tarayıcı açılıyor... Giriş yapın
          </>
        ) : (
          <>
            <Monitor className="h-5 w-5" />
            Google ile Giriş Yap
          </>
        )}
      </button>

      {loading && (
        <div
          className="rounded-xl p-3 text-center text-[12px]"
          style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
        >
          Açılan tarayıcı penceresinde Google hesabınızla giriş yapın.
          Giriş tamamlanınca bu sayfa otomatik güncellenecek.
        </div>
      )}
    </div>
  )
}

function Step({ num, text }: { num: number; text: string }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: 'var(--color-info)' }}
      >
        {num}
      </span>
      <p className="text-[11px]" style={{ color: 'var(--color-info)' }}>{text}</p>
    </div>
  )
}
