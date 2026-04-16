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
  Sparkles,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BlurFade } from '@/components/ui/blur-fade'

/* ── Zod-free client-side validation (mirrors selfRegisterSchema) ── */

interface FormData {
  hospitalName: string
  hospitalCode: string
  address: string
  phone: string
  firstName: string
  lastName: string
  email: string
  password: string
  passwordConfirm: string
}

interface FieldErrors {
  [key: string]: string | undefined
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/
const HOSPITAL_CODE_REGEX = /^[a-z0-9-]+$/

function validateStep1(data: FormData): FieldErrors {
  const errors: FieldErrors = {}
  if (!data.hospitalName || data.hospitalName.length < 2) {
    errors.hospitalName = 'Hastane adi en az 2 karakter olmalidir'
  }
  if (!data.hospitalCode || data.hospitalCode.length < 3) {
    errors.hospitalCode = 'Hastane kodu en az 3 karakter olmalidir'
  } else if (data.hospitalCode.length > 20) {
    errors.hospitalCode = 'Hastane kodu en fazla 20 karakter olabilir'
  } else if (!HOSPITAL_CODE_REGEX.test(data.hospitalCode)) {
    errors.hospitalCode = 'Sadece kucuk harf, rakam ve tire kullanin'
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
    errors.firstName = 'Ad en az 2 karakter olmalidir'
  }
  if (!data.lastName || data.lastName.length < 2) {
    errors.lastName = 'Soyad en az 2 karakter olmalidir'
  }
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Gecerli bir e-posta adresi girin'
  }
  if (!data.password || data.password.length < 8) {
    errors.password = 'Sifre en az 8 karakter olmalidir' // secret-scanner-disable-line
  } else if (!PASSWORD_REGEX.test(data.password)) {
    errors.password = 'Buyuk harf, kucuk harf, rakam ve ozel karakter gerekli' // secret-scanner-disable-line
  }
  if (data.password !== data.passwordConfirm) {
    errors.passwordConfirm = 'Sifreler uyusmuyor'
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

  if (score <= 2) return { score, label: 'Zayif', color: '#dc2626' }
  if (score <= 3) return { score, label: 'Orta', color: '#f59e0b' }
  if (score <= 4) return { score, label: 'Iyi', color: 'var(--brand-600)' }
  return { score, label: 'Guclu', color: 'var(--brand-600)' }
}

/* ── Password requirement checks ── */
function PasswordRequirements({ password }: { password: string }) {
  const checks = [
    { label: 'En az 8 karakter', met: password.length >= 8 },
    { label: 'Kucuk harf (a-z)', met: /[a-z]/.test(password) },
    { label: 'Buyuk harf (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Rakam (0-9)', met: /\d/.test(password) },
    { label: 'Ozel karakter (!@#$...)', met: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) },
  ]
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
      {checks.map(({ label, met }) => (
        <div key={label} className="flex items-center gap-1.5 text-xs" style={{ color: met ? 'var(--brand-600)' : '#94a3b8' }}>
          <div
            className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
            style={{ backgroundColor: met ? 'var(--brand-600)' : '#e2e8f0' }}
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
    hospitalName: '',
    hospitalCode: '',
    address: '',
    phone: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    passwordConfirm: '',
  })

  function update(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
    setApiError('')
  }

  /** Auto-generate hospital code from name */
  function handleHospitalNameChange(value: string) {
    update('hospitalName', value)
    if (!form.hospitalCode || form.hospitalCode === slugify(form.hospitalName)) {
      const code = slugify(value)
      setForm((prev) => ({ ...prev, hospitalCode: code }))
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
          hospitalName: form.hospitalName,
          hospitalCode: form.hospitalCode,
          address: form.address || undefined,
          phone: form.phone || undefined,
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setApiError(data.error || 'Bir hata olustu. Lutfen tekrar deneyin.')
        return
      }

      setSuccess(true)
    } catch {
      setApiError('Baglanti hatasi. Lutfen internet baglantinizi kontrol edin.')
    } finally {
      setLoading(false)
    }
  }

  // ── Success state ──
  if (success) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
        <BlurFade delay={0.1}>
          <div
            className="w-full max-w-lg rounded-2xl p-8 text-center"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)',
            }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ backgroundColor: '#dcfce7' }}
            >
              <CheckCircle2 className="w-8 h-8" style={{ color: '#16a34a' }} />
            </div>
            <h1 className="text-2xl font-bold mb-3" style={{ color: 'var(--color-text-primary)' }}>
              Kaydınız Basarıyla Tamamlandı!
            </h1>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              <strong>{form.email}</strong> adresine bir dogrulama e-postasi gonderildi.
              Lutfen gelen kutunuzu kontrol ederek hesabinizi dogrulayin.
            </p>
            <div
              className="rounded-xl p-4 mb-6 text-left text-sm"
              style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a' }}
            >
              <p className="font-semibold mb-1" style={{ color: '#92400e' }}>
                Onemli Bilgiler:
              </p>
              <ul className="space-y-1" style={{ color: '#a16207' }}>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  30 gunluk ucretsiz deneme sureniz basladi
                </li>
                <li className="flex items-start gap-2">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  E-posta dogrulaması yapilmadan giris yapilamaz
                </li>
              </ul>
            </div>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105"
              style={{ backgroundColor: 'var(--brand-600)' }}
            >
              Giris Sayfasina Git
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </BlurFade>
      </div>
    )
  }

  const strength = getPasswordStrength(form.password)

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
      <BlurFade delay={0.1}>
        <div className="w-full max-w-2xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Hastanenizi Kaydedin
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              30 gun ucretsiz deneyin — kredi karti gerekmez
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-3 mb-8 max-w-md mx-auto">
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ backgroundColor: 'var(--brand-600)' }}
              >
                {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
              </div>
              <span className="text-sm font-medium" style={{ color: step >= 1 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                Hastane Bilgileri
              </span>
            </div>
            <div
              className="flex-1 h-0.5 rounded"
              style={{ backgroundColor: step >= 2 ? 'var(--brand-600)' : '#e2e8f0' }}
            />
            <div className="flex items-center gap-2 flex-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                style={{
                  backgroundColor: step >= 2 ? 'var(--brand-600)' : '#e2e8f0',
                  color: step >= 2 ? 'white' : '#94a3b8',
                }}
              >
                2
              </div>
              <span className="text-sm font-medium" style={{ color: step >= 2 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}>
                Yonetici Hesabi
              </span>
            </div>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)',
            }}
          >
            {apiError && (
              <div
                className="rounded-xl px-4 py-3 mb-6 text-sm font-medium"
                style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
              >
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* ── Step 1: Hospital Info ── */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#f0fdf4' }}
                    >
                      <Building2 className="w-5 h-5" style={{ color: 'var(--brand-600)' }} />
                    </div>
                    <div>
                      <h2 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        Hastane Bilgileri
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        Hastanenizin temel bilgilerini girin
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="hospitalName" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Hastane Adi *
                    </Label>
                    <Input
                      id="hospitalName"
                      placeholder="ornek: Ankara Sehir Hastanesi"
                      value={form.hospitalName}
                      onChange={(e) => handleHospitalNameChange(e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.hospitalName && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.hospitalName}</p>}
                  </div>

                  <div>
                    <Label htmlFor="hospitalCode" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Hastane Kodu *
                    </Label>
                    <Input
                      id="hospitalCode"
                      placeholder="ornek: ankara-sehir"
                      value={form.hospitalCode}
                      onChange={(e) => update('hospitalCode', e.target.value.toLowerCase())}
                      className="mt-1.5 font-mono"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      Kucuk harf, rakam ve tire (-) kullanilabilir. 3-20 karakter.
                    </p>
                    {errors.hospitalCode && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.hospitalCode}</p>}
                  </div>

                  <div>
                    <Label htmlFor="address" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Adres
                    </Label>
                    <Input
                      id="address"
                      placeholder="Hastane adresi (istege bagli)"
                      value={form.address}
                      onChange={(e) => update('address', e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.address && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.address}</p>}
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Telefon
                    </Label>
                    <Input
                      id="phone"
                      placeholder="ornek: 0312 000 00 00"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.phone && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.phone}</p>}
                  </div>

                  <button
                    type="button"
                    onClick={goToStep2}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-transform hover:scale-[1.02]"
                    style={{ backgroundColor: 'var(--brand-600)' }}
                  >
                    Devam Et
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* ── Step 2: Admin Info ── */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: '#eff6ff' }}
                    >
                      <User className="w-5 h-5" style={{ color: '#2563eb' }} />
                    </div>
                    <div>
                      <h2 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                        Yonetici Hesabi
                      </h2>
                      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        Hastane yoneticisi olarak giris yapacak hesabi olusturun
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Ad *
                      </Label>
                      <Input
                        id="firstName"
                        placeholder="Adiniz"
                        value={form.firstName}
                        onChange={(e) => update('firstName', e.target.value)}
                        className="mt-1.5"
                      />
                      {errors.firstName && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.firstName}</p>}
                    </div>
                    <div>
                      <Label htmlFor="lastName" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        Soyad *
                      </Label>
                      <Input
                        id="lastName"
                        placeholder="Soyadiniz"
                        value={form.lastName}
                        onChange={(e) => update('lastName', e.target.value)}
                        className="mt-1.5"
                      />
                      {errors.lastName && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.lastName}</p>}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      E-posta *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="ornek@hastane.gov.tr"
                      value={form.email}
                      onChange={(e) => update('email', e.target.value)}
                      className="mt-1.5"
                    />
                    {errors.email && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Sifre *
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="password"
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
                        style={{ color: '#94a3b8' }}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {form.password && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e2e8f0' }}>
                            <div
                              className="h-full rounded-full transition-all duration-300"
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
                    {errors.password && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.password}</p>}
                  </div>

                  <div>
                    <Label htmlFor="passwordConfirm" className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Sifre Tekrar *
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="passwordConfirm"
                        type={showPasswordConfirm ? 'text' : 'password'}
                        placeholder="Sifrenizi tekrar girin"
                        value={form.passwordConfirm}
                        onChange={(e) => update('passwordConfirm', e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: '#94a3b8' }}
                        tabIndex={-1}
                      >
                        {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.passwordConfirm && <p className="text-xs mt-1" style={{ color: '#dc2626' }}>{errors.passwordConfirm}</p>}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition-colors"
                      style={{
                        color: 'var(--color-text-secondary)',
                        border: '1px solid var(--color-border)',
                        backgroundColor: 'transparent',
                      }}
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Geri
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--brand-600)' }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Kaydediliyor...
                        </>
                      ) : (
                        <>
                          Hesap Olustur
                          <Sparkles className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>

            {/* Footer links */}
            <div className="mt-6 pt-6 text-center text-sm" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p style={{ color: 'var(--color-text-secondary)' }}>
                Zaten hesabiniz var mi?{' '}
                <Link href="/auth/login" className="font-semibold" style={{ color: 'var(--brand-600)' }}>
                  Giris Yapin
                </Link>
              </p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            {[
              { icon: Shield, label: '256-bit SSL Sifreleme' },
              { icon: Clock, label: '30 Gun Ucretsiz Deneme' },
              { icon: Sparkles, label: 'Kurulum Sihirbazi' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-medium"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border)' }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand-600)' }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </BlurFade>
    </div>
  )
}
