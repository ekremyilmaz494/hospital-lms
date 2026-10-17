'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Building2,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  Clock,
  CreditCard,
  ListChecks,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/* ── Zod-free client-side validation (mirrors selfRegisterSchema) ── */

interface FormData {
  organizationName: string
  organizationCode: string
  sector: string
  address: string
  phone: string
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirm: string
  kvkkAccepted: boolean
}

// Faz 3: Sektör seçenekleri — register form için Türkçe label'larla.
// Backend Sector enum'ı ile birebir aynı value'lar (healthcare/manufacturing/...).
const SECTOR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'healthcare', label: 'Sağlık (Hastane, Klinik)' },
  { value: 'manufacturing', label: 'Üretim (Fabrika, Sanayi)' },
  { value: 'education', label: 'Eğitim (Okul, Kurs)' },
  { value: 'retail', label: 'Perakende (Mağaza, Zincir)' },
  { value: 'other', label: 'Diğer / Genel' },
]

interface FieldErrors {
  [key: string]: string | undefined
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/
const ORGANIZATION_CODE_REGEX = /^[a-z0-9-]+$/

function validateStep1(data: FormData): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.organizationName || data.organizationName.length < 2) {
    errors.organizationName = 'Organizasyon adı en az 2 karakter olmalıdır'
  }
  if (!data.organizationCode || data.organizationCode.length < 3) {
    errors.organizationCode = 'Organizasyon kodu en az 3 karakter olmalıdır'
  } else if (data.organizationCode.length > 20) {
    errors.organizationCode = 'Organizasyon kodu en fazla 20 karakter olabilir'
  } else if (!ORGANIZATION_CODE_REGEX.test(data.organizationCode)) {
    errors.organizationCode = 'Yalnızca küçük harf, rakam ve tire kullanın'
  }
  if (!data.sector || !SECTOR_OPTIONS.some((o) => o.value === data.sector)) {
    errors.sector = 'Sektör seçimi zorunludur'
  }
  if (data.address && data.address.length > 500) {
    errors.address = 'Adres en fazla 500 karakter olabilir'
  }
  if (data.phone && data.phone.length > 20) {
    errors.phone = 'Telefon en fazla 20 karakter olabilir'
  }
  return errors
}

function validateStep2(data: FormData): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.firstName || data.firstName.length < 2) {
    errors.firstName = 'Ad en az 2 karakter olmalıdır'
  }
  if (!data.lastName || data.lastName.length < 2) {
    errors.lastName = 'Soyad en az 2 karakter olmalıdır'
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Geçerli bir e-posta adresi girin'
  }
  if (!data.password || data.password.length < 8) {
    errors.password = 'Şifre en az 8 karakter olmalıdır' // secret-scanner-disable-line
  } else if (!PASSWORD_REGEX.test(data.password)) {
    errors.password = 'Büyük harf, küçük harf, rakam ve özel karakter gerekli' // secret-scanner-disable-line
  }
  if (data.password !== data.passwordConfirm) {
    errors.passwordConfirm = 'Şifreler uyuşmuyor'
  }
  if (!data.kvkkAccepted) {
    errors.kvkkAccepted = 'KVKK aydınlatma metnini onaylamanız gerekir'
  }
  return errors
}

/* ── Password strength indicator ── */
function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw)) score++
  if (/[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) score++

  if (score <= 2) return { score, label: 'Zayıf', color: 'var(--site-danger)' }
  if (score <= 3) return { score, label: 'Orta', color: 'var(--site-attn-ink)' }
  if (score <= 4) return { score, label: 'İyi', color: 'var(--site-brand)' }
  return { score, label: 'Güçlü', color: 'var(--site-brand-ink)' }
}

/* ── Password requirement checks ── */
function PasswordRequirements({ password }: { password: string }) {
  const checks = [
    { label: 'En az 8 karakter', met: password.length >= 8 },
    { label: 'Küçük harf (a-z)', met: /[a-z]/.test(password) },
    { label: 'Büyük harf (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Rakam (0-9)', met: /\d/.test(password) },
    { label: 'Özel karakter (!@#$...)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
      {checks.map(({ label, met }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: met ? 'var(--site-brand-ink)' : 'var(--site-ink-muted)' }}>
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{ backgroundColor: met ? 'var(--site-brand)' : 'var(--site-rule-strong)', color: 'var(--site-surface)' }}
            aria-hidden="true"
          >
            {met ? '\u2713' : ''}
          </div>
          {label}
        </div>
      ))}
    </div>
  )
}

/* ── Main component ── */
export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState('')
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})

  const [form, setForm] = useState<FormData>({
    organizationName: '',
    organizationCode: '',
    sector: '',
    address: '',
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    passwordConfirm: '',
    kvkkAccepted: false,
  })

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setApiError('')
  }

  function setKvkkAccepted(value: boolean) {
    setForm((prev) => ({ ...prev, kvkkAccepted: value }))
    setErrors((prev) => ({ ...prev, kvkkAccepted: undefined }))
    setApiError('')
  }

  /** Auto-generate organization code from name */
  function handleOrganizationNameChange(value: string) {
    update('organizationName', value)
    if (!form.organizationCode || form.organizationCode === slugify(form.organizationName)) {
      const code = slugify(value)
      setForm((prev) => ({ ...prev, organizationCode: code }))
    }
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ı/g, 'i')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 20)
  }

  function goToStep2() {
    const step1Errors = validateStep1(form)
    setErrors(step1Errors)
    if (Object.keys(step1Errors).length === 0) {
      setStep(2)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const step2Errors = validateStep2(form)
    setErrors(step2Errors)
    if (Object.keys(step2Errors).length > 0) return

    setLoading(true)
    setApiError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: form.organizationName,
          organizationCode: form.organizationCode,
          sector: form.sector,
          address: form.address || undefined,
          phone: form.phone || undefined,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          kvkkAccepted: form.kvkkAccepted,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error || 'Bir hata oluştu. Lütfen tekrar deneyin.')
        return
      }

      setSuccess(true)
    } catch {
      setApiError('Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  // ── Success state ──
  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
        <div
            className="w-full max-w-lg rounded-2xl p-8 text-center"
            style={{
              backgroundColor: 'var(--site-surface)',
              border: '1px solid var(--site-rule-strong)',
              boxShadow: 'var(--site-shadow-lift)',
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: 'var(--site-brand-tint)' }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: 'var(--site-brand-ink)' }} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--site-ink)' }}>
              Kaydınız tamamlandı
            </h1>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--site-ink-soft)' }}>
              <strong>{form.email}</strong> adresine bir e-posta gönderildi.
              Gelen kutunuzu kontrol ederek hesabınızı doğrulayın.
            </p>
            <div
              className="rounded-xl p-4 mb-6 text-left text-sm"
              style={{ backgroundColor: 'var(--site-surface-sunken)', border: '1px solid var(--site-rule-strong)' }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--site-ink)' }}>
                Önemli bilgiler
              </p>
              <ul className="space-y-1" style={{ color: 'var(--site-ink-soft)' }}>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  30 günlük ücretsiz deneme süreniz başladı.
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                  E-posta adresinizi doğrulamadan giriş yapamazsınız.
                </li>
              </ul>
            </div>
            <Link
              prefetch={false} href="/auth/login"
              className="s-btn s-btn-primary"
            >
              Giriş sayfasına git
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </div>
      </div>
    )
  }

  const strength = getPasswordStrength(form.password)

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--site-ink)' }}>
              Organizasyonunuzu Kaydedin
            </h1>
            <p className="text-sm" style={{ color: 'var(--site-ink-soft)' }}>
              30 gün ücretsiz deneyin, kredi kartı gerekmez.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8 max-w-md mx-auto">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{ backgroundColor: 'var(--site-brand-ink)', color: 'var(--site-surface)' }}
              >
                {step > 1 ? <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> : '1'}
              </div>
              <span className="hidden text-sm font-medium sm:inline" style={{ color: step >= 1 ? 'var(--site-ink)' : 'var(--site-ink-soft)' }}>
                Organizasyon Bilgileri
              </span>
            </div>
            <div
              className="flex-1 h-0.5 rounded"
              style={{ backgroundColor: step >= 2 ? 'var(--site-brand-ink)' : 'var(--site-rule-strong)' }}
            />
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: step >= 2 ? 'var(--site-brand-ink)' : 'var(--site-rule-strong)',
                  color: step >= 2 ? 'var(--site-surface)' : 'var(--site-ink-soft)',
                }}
              >
                2
              </div>
              <span className="hidden text-sm font-medium sm:inline" style={{ color: step >= 2 ? 'var(--site-ink)' : 'var(--site-ink-soft)' }}>
                Yönetici Hesabı
              </span>
            </div>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--site-surface)',
              border: '1px solid var(--site-rule-strong)',
              boxShadow: 'var(--site-shadow-lift)',
            }}
          >
            {apiError && (
              <div role="alert" className="s-form-alert s-form-alert-error mb-6">
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* ── Step 1: Organization Info ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'var(--site-brand-tint)' }}
                    >
                      <Building2 className="w-5 h-5" style={{ color: 'var(--site-brand-ink)' }} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-bold" style={{ color: 'var(--site-ink)' }}>
                        Organizasyon Bilgileri
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--site-ink-soft)' }}>
                        Organizasyonunuzun temel bilgilerini girin
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="organizationName" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      Organizasyon Adı *
                    </Label>
                    <Input
                      id="organizationName"
                      aria-invalid={errors.organizationName ? true : undefined}
                      aria-describedby={errors.organizationName ? 'organizationName-hata' : undefined}
                      placeholder="örnek: Merkez Hastanesi"
                      value={form.organizationName}
                      onChange={(e) => handleOrganizationNameChange(e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.organizationName && <p id="organizationName-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.organizationName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="organizationCode" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      Organizasyon Kodu *
                    </Label>
                    <Input
                      id="organizationCode"
                      aria-invalid={errors.organizationCode ? true : undefined}
                      aria-describedby={errors.organizationCode ? 'organizationCode-hata' : undefined}
                      placeholder="örnek: merkez-hastanesi"
                      value={form.organizationCode}
                      onChange={(e) => update('organizationCode', e.target.value.toLowerCase())}
                      className="mt-1.5 font-mono"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--site-ink-soft)' }}>
                      Küçük harf, rakam ve tire (-) kullanılabilir. 3-20 karakter.
                    </p>
                    {errors.organizationCode && <p id="organizationCode-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.organizationCode}</p>}
                  </div>

                  <div>
                    <Label htmlFor="sector" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      Sektör *
                    </Label>
                    <select
                      id="sector"
                      aria-invalid={errors.sector ? true : undefined}
                      aria-describedby={errors.sector ? 'sector-hata' : undefined}
                      value={form.sector}
                      onChange={(e) => update('sector', e.target.value)}
                      className="mt-1.5 w-full rounded-md border bg-transparent px-3 py-2 text-base focus:outline-none sm:text-sm"
                      style={{
                        borderColor: errors.sector ? 'var(--site-danger)' : 'var(--site-rule-strong)',
                        color: 'var(--site-ink)',
                      }}
                    >
                      <option value="" disabled>
                        Bir sektör seçin…
                      </option>
                      {SECTOR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs mt-1" style={{ color: 'var(--site-ink-soft)' }}>
                      Sektör seçimi platform içindeki menüleri ve özellikleri belirler.
                    </p>
                    {errors.sector && <p id="sector-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.sector}</p>}
                  </div>

                  <div>
                    <Label htmlFor="address" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      Adres
                    </Label>
                    <Input
                      id="address"
                      aria-invalid={errors.address ? true : undefined}
                      aria-describedby={errors.address ? 'address-hata' : undefined}
                      placeholder="Organizasyon adresi (isteğe bağlı)"
                      value={form.address}
                      onChange={(e) => update('address', e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.address && <p id="address-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.address}</p>}
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      Telefon
                    </Label>
                    <Input
                      id="phone"
                      aria-invalid={errors.phone ? true : undefined}
                      aria-describedby={errors.phone ? 'phone-hata' : undefined}
                      placeholder="örnek: 0312 000 00 00"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.phone && <p id="phone-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.phone}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={goToStep2}
                    className="s-btn s-btn-primary w-full"
                  >
                    Devam Et
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* ── Step 2: Admin Info ── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: 'var(--site-brand-tint)' }}
                    >
                      <User className="w-5 h-5" style={{ color: 'var(--site-brand-ink)' }} aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="font-bold" style={{ color: 'var(--site-ink)' }}>
                        Yönetici Hesabı
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--site-ink-soft)' }}>
                        Organizasyon yöneticisi olarak giriş yapacak hesabı oluşturun
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                        Ad *
                      </Label>
                      <Input
                        id="firstName"
                        aria-invalid={errors.firstName ? true : undefined}
                        aria-describedby={errors.firstName ? 'firstName-hata' : undefined}
                        placeholder="Adınız"
                        value={form.firstName}
                        onChange={(e) => update('firstName', e.target.value)}
                        className="mt-1.5"
                      />
                      {errors.firstName && <p id="firstName-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.firstName}</p>}
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                        Soyad *
                      </Label>
                      <Input
                        id="lastName"
                        aria-invalid={errors.lastName ? true : undefined}
                        aria-describedby={errors.lastName ? 'lastName-hata' : undefined}
                        placeholder="Soyadınız"
                        value={form.lastName}
                        onChange={(e) => update('lastName', e.target.value)}
                        className="mt-1.5"
                      />
                      {errors.lastName && <p id="lastName-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      E-posta *
                    </Label>
                    <Input
                      id="email"
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? 'email-hata' : undefined}
                      type="email"
                      placeholder="ornek@kurum.gov.tr"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.email && <p id="email-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      Şifre *
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="password"
                        aria-invalid={errors.password ? true : undefined}
                        aria-describedby={errors.password ? 'password-hata' : undefined}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="En az 8 karakter"
                        value={form.password}
                        onChange={(e) => update('password', e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--site-ink-muted)' }}
                        tabIndex={-1}
                        aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                      </button>
                    </div>
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--site-rule-strong)' }}>
                            <div
                              className="h-full rounded-full transition-[width] duration-300"
                              style={{
                                width: `${(strength.score / 5) * 100}%`,
                                backgroundColor: strength.color,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium" style={{ color: strength.color }}>
                            {strength.label}
                          </span>
                        </div>
                        <PasswordRequirements password={form.password} />
                      </div>
                    )}
                    {errors.password && <p id="password-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.password}</p>}
                  </div>

                  <div>
                    <Label htmlFor="passwordConfirm" className="text-sm font-medium" style={{ color: 'var(--site-ink)' }}>
                      Şifre Tekrar *
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="passwordConfirm"
                        aria-invalid={errors.passwordConfirm ? true : undefined}
                        aria-describedby={errors.passwordConfirm ? 'passwordConfirm-hata' : undefined}
                        type={showPasswordConfirm ? 'text' : 'password'}
                        placeholder="Şifrenizi tekrar girin"
                        value={form.passwordConfirm}
                        onChange={(e) => update('passwordConfirm', e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--site-ink-muted)' }}
                        tabIndex={-1}
                        aria-label={showPasswordConfirm ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      >
                        {showPasswordConfirm ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                      </button>
                    </div>
                    {errors.passwordConfirm && <p id="passwordConfirm-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.passwordConfirm}</p>}
                  </div>

                  {/* KVKK açık rıza — kayıt (veri toplama) anında zorunlu onay */}
                  <div>
                    <label className="flex items-start gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        aria-required="true"
                        aria-invalid={errors.kvkkAccepted ? true : undefined}
                        aria-describedby={errors.kvkkAccepted ? 'kvkkAccepted-hata' : undefined}
                        checked={form.kvkkAccepted}
                        onChange={(e) => setKvkkAccepted(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0"
                        style={{ accentColor: 'var(--site-brand-ink)' }}
                      />
                      <span className="text-xs" style={{ color: 'var(--site-ink-soft)' }}>
                        <a href="/kvkk" target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: 'var(--site-brand-ink)' }}>KVKK Aydınlatma Metni</a>
                        {' '}ve{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold underline" style={{ color: 'var(--site-brand-ink)' }}>Kullanım Koşulları</a>
                        &apos;nı okudum, kabul ediyorum. Kişisel verilerimin bu sistemde işlenmesine açık rıza veriyorum.
                      </span>
                    </label>
                    {errors.kvkkAccepted && <p id="kvkkAccepted-hata" className="text-xs mt-1" style={{ color: 'var(--site-danger)' }}>{errors.kvkkAccepted}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
                      style={{
                        color: 'var(--site-ink-soft)',
                        border: '1px solid var(--site-rule-strong)',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                      Geri
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="s-btn s-btn-primary flex-1"
                      aria-busy={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" />
                          Kaydediliyor
                        </>
                      ) : (
                        <>
                          Hesap Oluştur
                          <ArrowRight className="w-4 h-4" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Footer links */}
            <div className="mt-6 pt-6 text-center text-sm" style={{ borderTop: '1px solid var(--site-rule-strong)' }}>
              <p style={{ color: 'var(--site-ink-soft)' }}>
                Zaten hesabınız var mı?{' '}
                <Link prefetch={false} href="/auth/login" className="font-semibold" style={{ color: 'var(--site-brand-ink)' }}>
                  Giriş Yapın
                </Link>
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {[
              { icon: Clock, label: '30 gün ücretsiz deneme' },
              { icon: CreditCard, label: 'Kredi kartı gerekmez' },
              { icon: ListChecks, label: 'İki adımda kayıt' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium"
                style={{ backgroundColor: 'var(--site-surface)', color: 'var(--site-ink-soft)', border: '1px solid var(--site-rule-strong)' }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--site-brand-ink)' }} aria-hidden="true" />
                {label}
              </div>
            ))}
          </div>
        </div>
    </div>
  )
}
