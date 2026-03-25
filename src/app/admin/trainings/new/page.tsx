'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Save, Info, Video, FileQuestion, Users, Check, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const steps = [
  { id: 1, title: 'Bilgiler', icon: Info },
  { id: 2, title: 'Videolar', icon: Video },
  { id: 3, title: 'Sorular', icon: FileQuestion },
  { id: 4, title: 'Atama', icon: Users },
];

export default function NewTrainingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Yeni Eğitim Oluştur</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Adım {currentStep} / {steps.length}</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-3">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          return (
            <div key={step.id} className="flex flex-1 items-center gap-3">
              <button
                onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                className="flex flex-1 items-center gap-2.5 rounded-lg px-4 py-3"
                style={{
                  background: isActive ? 'var(--color-primary-light)' : isCompleted ? 'var(--color-success-bg)' : 'var(--color-surface)',
                  border: `1.5px solid ${isActive ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--color-border)'}`,
                  transition: 'border-color var(--transition-fast), background var(--transition-fast)',
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    background: isCompleted ? 'var(--color-success)' : isActive ? 'var(--color-primary)' : 'var(--color-border)',
                    color: isCompleted || isActive ? 'white' : 'var(--color-text-muted)',
                  }}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <div className="text-left">
                  <p className="text-xs font-semibold" style={{ color: isActive ? 'var(--color-primary)' : isCompleted ? 'var(--color-success)' : 'var(--color-text-muted)' }}>{step.title}</p>
                </div>
              </button>
              {idx < steps.length - 1 && <div className="h-px w-6 shrink-0" style={{ background: 'var(--color-border)' }} />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>

        {/* Step 1: Info */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Eğitim Bilgileri</h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Eğitim Adı *</Label>
                <Input placeholder="Enfeksiyon Kontrol Eğitimi" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Kategori *</Label>
                <select className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                  <option value="">Kategori seçin...</option>
                  <option>Enfeksiyon</option><option>İş Güvenliği</option><option>Hasta Hakları</option><option>Radyoloji</option><option>Laboratuvar</option><option>Eczane</option>
                </select>
              </div>
            </div>
            <div>
              <Label style={{ color: 'var(--color-text-secondary)' }}>Açıklama</Label>
              <textarea rows={3} placeholder="Eğitim açıklaması..." className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)' }} />
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Baraj Puanı</Label><Input type="number" defaultValue={70} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Deneme Hakkı</Label><Input type="number" defaultValue={3} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Başlangıç Tarihi</Label><Input type="date" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
              <div><Label style={{ color: 'var(--color-text-secondary)' }}>Bitiş Tarihi</Label><Input type="date" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
            </div>
            <div><Label style={{ color: 'var(--color-text-secondary)' }}>Sınav Süresi (dakika)</Label><Input type="number" defaultValue={30} className="mt-1.5 max-w-xs" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} /></div>
          </div>
        )}

        {/* Step 2: Videos */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Eğitim Videoları</h3>
              <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><Plus className="h-4 w-4" /> Video Ekle</Button>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 rounded-lg border p-4" style={{ borderColor: 'var(--color-border)' }}>
                <GripVertical className="h-5 w-5 shrink-0 cursor-grab" style={{ color: 'var(--color-text-muted)' }} />
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                  <Video className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <Input placeholder={`Video ${i} başlığı`} style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                  <Input placeholder="Video URL veya dosya yükle" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <Button variant="ghost" size="icon" className="text-red-400"><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="rounded-lg border-2 border-dashed p-8 text-center" style={{ borderColor: 'var(--color-border)' }}>
              <Video className="mx-auto h-8 w-8 mb-2" style={{ color: 'var(--color-text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Video dosyasını sürükleyin veya tıklayın</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>MP4, WebM — Maks 500MB</p>
            </div>
          </div>
        )}

        {/* Step 3: Questions */}
        {currentStep === 3 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Sınav Soruları</h3>
              <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><Plus className="h-4 w-4" /> Soru Ekle</Button>
            </div>
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'var(--color-accent)' }}>{i}</span>
                  <Input placeholder={`Soru ${i} metnini girin...`} className="flex-1" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                  <Input type="number" defaultValue={10} className="w-20" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>puan</span>
                  <Button variant="ghost" size="icon" className="text-red-400"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="ml-10 space-y-2">
                  {['A', 'B', 'C', 'D'].map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <input type="radio" name={`q${i}`} className="h-4 w-4" style={{ accentColor: 'var(--color-primary)' }} />
                      <span className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{opt})</span>
                      <Input placeholder={`Şık ${opt}`} className="flex-1" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontSize: '13px' }} />
                    </div>
                  ))}
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Doğru cevabı işaretleyin</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 4: Assignment */}
        {currentStep === 4 && (
          <div className="space-y-5">
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Personel Atama</h3>
            <div className="flex gap-3">
              <Input placeholder="Personel ara (isim, departman)..." className="max-w-sm" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              <Button variant="outline" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>Tüm Personeli Seç</Button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {['Hemşirelik (45)', 'Acil Servis (28)', 'Radyoloji (12)', 'Laboratuvar (18)', 'Eczane (15)', 'Temizlik (22)', 'İdari (20)', 'Güvenlik (10)'].map((dept) => (
                <label key={dept} className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer" style={{ borderColor: 'var(--color-border)', transition: 'border-color var(--transition-fast)' }}>
                  <input type="checkbox" className="h-4 w-4 rounded" style={{ accentColor: 'var(--color-primary)' }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>{dept.split(' (')[0]}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{dept.match(/\((\d+)\)/)?.[1]} personel</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="rounded-lg p-4" style={{ background: 'var(--color-primary-light)' }}>
              <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>Seçili personel sayısı: <span style={{ fontFamily: 'var(--font-mono)' }}>0</span></p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back()}
          className="gap-2"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft className="h-4 w-4" />
          {currentStep === 1 ? 'İptal' : 'Önceki'}
        </Button>
        {currentStep < 4 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
            Sonraki <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
            <Save className="h-4 w-4" /> Eğitimi Yayınla
          </Button>
        )}
      </div>
    </div>
  );
}
