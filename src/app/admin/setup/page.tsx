'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Building2, LayoutGrid, GraduationCap, Rocket, Check, Loader2 } from 'lucide-react'

const SUGGESTED_DEPARTMENTS = [
  'Dahiliye',
  'Cerrahi',
  'Acil Servis',
  'Laboratuvar',
  'Radyoloji',
  'Eczane',
  'Hemşirelik',
  'Yönetim',
]

const STEPS = [
  { label: 'Hastane Bilgileri', icon: Building2 },
  { label: 'Departmanlar', icon: LayoutGrid },
  { label: 'Eğitim Ayarları', icon: GraduationCap },
  { label: 'Tamamla', icon: Rocket },
]

interface FormData {
  // Step 1
  name: string
  code: string
  address: string
  phone: string
  email: string
  // Step 2
  departments: string[]
  // Step 3
  defaultPassingScore: number
  defaultMaxAttempts: number
  defaultExamDuration: number
}

export default function SetupWizardPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    name: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    departments: [...SUGGESTED_DEPARTMENTS],
    defaultPassingScore: 70,
    defaultMaxAttempts: 3,
    defaultExamDuration: 30,
  })

  const updateField = useCallback(<K extends keyof FormData>(key: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleDepartment = useCallback((dept: string) => {
    setFormData(prev => {
      const exists = prev.departments.includes(dept)
      return {
        ...prev,
        departments: exists
          ? prev.departments.filter(d => d !== dept)
          : [...prev.departments, dept],
      }
    })
  }, [])

  const [customDept, setCustomDept] = useState('')

  const addCustomDepartment = useCallback(() => {
    const trimmed = customDept.trim()
    if (trimmed && !formData.departments.includes(trimmed)) {
      setFormData(prev => ({ ...prev, departments: [...prev.departments, trimmed] }))
      setCustomDept('')
    }
  }, [customDept, formData.departments])

  const saveStep = useCallback(async (step: number) => {
    setSaving(true)
    setError(null)

    try {
      let payload: Record<string, unknown> = { step }

      switch (step) {
        case 1:
          payload = { ...payload, name: formData.name, code: formData.code, address: formData.address, phone: formData.phone, email: formData.email }
          break
        case 2:
          payload = { ...payload, departments: formData.departments }
          break
        case 3:
          payload = { ...payload, defaultPassingScore: formData.defaultPassingScore, defaultMaxAttempts: formData.defaultMaxAttempts, defaultExamDuration: formData.defaultExamDuration }
          break
        case 4:
          payload = { ...payload, complete: true }
          break
      }

      const res = await fetch('/api/admin/setup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Kaydetme hatası')
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu')
      return false
    } finally {
      setSaving(false)
    }
  }, [formData])

  const handleNext = useCallback(async () => {
    const success = await saveStep(currentStep)
    if (success) {
      if (currentStep < 4) {
        setCurrentStep(prev => prev + 1)
      }
    }
  }, [currentStep, saveStep])

  const handleBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
      setError(null)
    }
  }, [currentStep])

  const handleComplete = useCallback(async () => {
    const success = await saveStep(4)
    if (success) {
      router.push('/admin/dashboard')
    }
  }, [saveStep, router])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Hastane Kurulum Sihirbazı
        </h1>
        <p className="mt-2 text-slate-600">
          Sistemi kullanmaya başlamak için aşağıdaki adımları tamamlayın
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((step, idx) => {
          const stepNum = idx + 1
          const isActive = stepNum === currentStep
          const isCompleted = stepNum < currentStep
          const Icon = step.icon

          return (
            <div key={stepNum} className="flex items-center gap-2">
              {idx > 0 && (
                <div
                  className={`h-0.5 w-8 sm:w-12 ${
                    isCompleted ? 'bg-brand-500' : 'bg-slate-200'
                  }`}
                />
              )}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? 'border-brand-500 bg-brand-500 text-white'
                      : isActive
                        ? 'border-brand-500 bg-white text-brand-600'
                        : 'border-slate-200 bg-white text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={`hidden text-xs font-medium sm:block ${
                    isActive ? 'text-brand-600' : isCompleted ? 'text-brand-500' : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step content */}
      <Card className="border-slate-200 shadow-sm">
        {currentStep === 1 && (
          <>
            <CardHeader>
              <CardTitle>Hastane Bilgileri</CardTitle>
              <CardDescription>Hastanenizin temel bilgilerini girin</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Hastane Adı *</Label>
                  <Input
                    id="name"
                    placeholder="Örn: Ankara Şehir Hastanesi"
                    value={formData.name}
                    onChange={e => updateField('name', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Hastane Kodu *</Label>
                  <Input
                    id="code"
                    placeholder="Örn: ASH"
                    value={formData.code}
                    onChange={e => updateField('code', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Adres</Label>
                <Input
                  id="address"
                  placeholder="Hastane adresi"
                  value={formData.address}
                  onChange={e => updateField('address', e.target.value)}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    placeholder="Örn: 0312 123 45 67"
                    value={formData.phone}
                    onChange={e => updateField('phone', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-posta</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Örn: info@hastane.com"
                    value={formData.email}
                    onChange={e => updateField('email', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 2 && (
          <>
            <CardHeader>
              <CardTitle>Departmanlar</CardTitle>
              <CardDescription>
                Hastanenizin departmanlarını seçin veya özel departman ekleyin
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {SUGGESTED_DEPARTMENTS.map(dept => (
                  <label
                    key={dept}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
                      formData.departments.includes(dept)
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Checkbox
                      checked={formData.departments.includes(dept)}
                      onCheckedChange={() => toggleDepartment(dept)}
                    />
                    <span className="text-sm font-medium text-slate-700">{dept}</span>
                  </label>
                ))}
              </div>

              {/* Custom departments */}
              {formData.departments
                .filter(d => !SUGGESTED_DEPARTMENTS.includes(d))
                .map(dept => (
                  <div
                    key={dept}
                    className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-4 py-2"
                  >
                    <Check className="h-4 w-4 text-brand-600" />
                    <span className="flex-1 text-sm font-medium text-slate-700">{dept}</span>
                    <button
                      type="button"
                      onClick={() => toggleDepartment(dept)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Kaldır
                    </button>
                  </div>
                ))}

              <div className="flex gap-2">
                <Input
                  placeholder="Özel departman adı"
                  value={customDept}
                  onChange={e => setCustomDept(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomDepartment()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addCustomDepartment}
                  disabled={!customDept.trim()}
                >
                  Ekle
                </Button>
              </div>

              <p className="text-xs text-slate-500">
                Seçili departman sayısı: {formData.departments.length}
              </p>
            </CardContent>
          </>
        )}

        {currentStep === 3 && (
          <>
            <CardHeader>
              <CardTitle>Eğitim Varsayılanları</CardTitle>
              <CardDescription>
                Yeni eğitimler için varsayılan ayarları belirleyin. Bu değerler daha sonra değiştirilebilir.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="passingScore">Geçme Puanı (%)</Label>
                <Input
                  id="passingScore"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.defaultPassingScore}
                  onChange={e => updateField('defaultPassingScore', Number(e.target.value))}
                />
                <p className="text-xs text-slate-500">Personelin sınavı geçmesi için gereken minimum puan</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAttempts">Maksimum Deneme Sayısı</Label>
                <Input
                  id="maxAttempts"
                  type="number"
                  min={1}
                  max={10}
                  value={formData.defaultMaxAttempts}
                  onChange={e => updateField('defaultMaxAttempts', Number(e.target.value))}
                />
                <p className="text-xs text-slate-500">Personelin sınavı kaç kez deneyebileceği</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="examDuration">Sınav Süresi (dakika)</Label>
                <Input
                  id="examDuration"
                  type="number"
                  min={5}
                  max={180}
                  value={formData.defaultExamDuration}
                  onChange={e => updateField('defaultExamDuration', Number(e.target.value))}
                />
                <p className="text-xs text-slate-500">Sınav için ayrılan varsayılan süre</p>
              </div>
            </CardContent>
          </>
        )}

        {currentStep === 4 && (
          <>
            <CardHeader>
              <CardTitle>Kurulum Özeti</CardTitle>
              <CardDescription>Ayarlarınızı gözden geçirin ve kurulumu tamamlayın</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700">Hastane Bilgileri</h3>
                  <div className="mt-1 grid gap-1 text-sm text-slate-600">
                    <p>Ad: {formData.name || '—'}</p>
                    <p>Kod: {formData.code || '—'}</p>
                    {formData.address && <p>Adres: {formData.address}</p>}
                    {formData.phone && <p>Telefon: {formData.phone}</p>}
                    {formData.email && <p>E-posta: {formData.email}</p>}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <h3 className="text-sm font-semibold text-slate-700">Departmanlar</h3>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {formData.departments.map(dept => (
                      <span
                        key={dept}
                        className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700"
                      >
                        {dept}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-3">
                  <h3 className="text-sm font-semibold text-slate-700">Eğitim Ayarları</h3>
                  <div className="mt-1 grid gap-1 text-sm text-slate-600">
                    <p>Geçme Puanı: %{formData.defaultPassingScore}</p>
                    <p>Maks. Deneme: {formData.defaultMaxAttempts}</p>
                    <p>Sınav Süresi: {formData.defaultExamDuration} dakika</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || saving}
          >
            Geri
          </Button>

          {currentStep < 4 ? (
            <Button onClick={handleNext} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              İleri
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sisteme Başla
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
