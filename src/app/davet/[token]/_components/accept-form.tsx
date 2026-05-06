'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'

interface Props {
  token: string
  email: string
  organizationName: string
}

export function AcceptInvitationForm({ token, email, organizationName }: Props) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [kvkkAccepted, setKvkkAccepted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Şifre en az 8 karakter olmalıdır')
      return
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      setError('Şifre en az bir büyük harf, bir küçük harf ve bir rakam içermelidir')
      return
    }
    if (password !== confirmPassword) {
      setError('Şifreler eşleşmiyor')
      return
    }
    if (!kvkkAccepted) {
      setError('KVKK aydınlatma metnini onaylamanız gereklidir')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/auth/invitations/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, kvkkAccepted: true }),
      })

      const body = await res.json().catch(() => ({})) as {
        error?: string
        redirectTo?: string
      }

      if (!res.ok) {
        throw new Error(body.error || `Hata (HTTP ${res.status})`)
      }

      setSuccess(true)
      // Login ekranına git, başarılı kabul sonrası kullanıcı şifresiyle giriş yapsın.
      // (Davet akışında auth session otomatik kurulmadığı için login zorunlu adım.)
      const next = body.redirectTo ? `&next=${encodeURIComponent(body.redirectTo)}` : ''
      setTimeout(() => {
        router.replace(`/auth/login?email=${encodeURIComponent(email)}${next}`)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center py-6 space-y-3">
        <div className="w-14 h-14 rounded-full bg-emerald-100 mx-auto flex items-center justify-center text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Hesabınız Oluşturuldu!</h3>
        <p className="text-sm text-slate-600">
          {organizationName} sistemine yönlendiriliyorsunuz...
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Yeni Şifre <span className="text-rose-600">*</span>
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full h-11 px-3 pr-10 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="En az 8 karakter, büyük/küçük harf, rakam"
            autoComplete="new-password"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700">
          Şifre Tekrarı <span className="text-rose-600">*</span>
        </label>
        <input
          id="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          placeholder="Şifreyi tekrar yazın"
          autoComplete="new-password"
        />
      </div>

      <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
        <input
          type="checkbox"
          checked={kvkkAccepted}
          onChange={(e) => setKvkkAccepted(e.target.checked)}
          disabled={loading}
          className="mt-0.5 h-4 w-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
        />
        <span className="text-xs text-slate-700 leading-relaxed">
          <a
            href="/kvkk"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline hover:text-emerald-800"
          >
            KVKK Aydınlatma Metni
          </a>
          {' '}ve{' '}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-emerald-700 underline hover:text-emerald-800"
          >
            Kullanım Koşulları
          </a>
          'nı okudum, kabul ediyorum. Kişisel verilerimin bu sistemde işlenmesine açık rıza veriyorum.
        </span>
      </label>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 text-sm text-rose-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !kvkkAccepted}
        className="w-full h-11 rounded-lg bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Hesabınız Oluşturuluyor...
          </>
        ) : (
          'Hesabımı Oluştur ve Giriş Yap'
        )}
      </button>

      <p className="text-xs text-center text-slate-500">
        Hesabınız oluşturulduktan sonra giriş ekranına yönlendirileceksiniz.
      </p>
    </form>
  )
}
