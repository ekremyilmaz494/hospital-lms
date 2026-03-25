'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Info, Video, FileQuestion, Users, Clock, Award, Calendar, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface TrainingEditData {
  title: string;
  category: string;
  description: string;
  passingScore: number;
  maxAttempts: number;
  examDuration: number;
  startDate: string;
  endDate: string;
}

const categories = [
  { value: 'enfeksiyon', label: 'Enfeksiyon' },
  { value: 'is-guvenligi', label: 'İş Güvenliği' },
  { value: 'hasta-haklari', label: 'Hasta Hakları' },
  { value: 'radyoloji', label: 'Radyoloji' },
  { value: 'laboratuvar', label: 'Laboratuvar' },
  { value: 'eczane', label: 'Eczane' },
  { value: 'acil', label: 'Acil Servis' },
  { value: 'genel', label: 'Genel Eğitim' },
];

export default function EditTrainingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : null;
  const { data, isLoading, error } = useFetch<TrainingEditData>(id ? `/api/admin/trainings/${id}` : null);
  const [formData, setFormData] = useState<TrainingEditData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) setFormData(data);
  }, [data]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  if (!formData) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Eğitim bulunamadı</div></div>;
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/trainings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Kayıt başarısız');
      }
      setSaved(true);
      setTimeout(() => router.push(`/admin/trainings/${id}`), 1000);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Eğitim Düzenle</h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{formData.title}</p>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Basic Info */}
      <BlurFade delay={0.05}>
        <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
              <Info className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            </div>
            <h3 className="text-base font-bold">Temel Bilgiler</h3>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Eğitim Adı *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="h-11 rounded-xl" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Kategori *</Label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="h-11 w-full rounded-xl border px-3 text-sm" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}>
                {categories.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block" style={{ color: 'var(--color-text-secondary)' }}>Açıklama</Label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }} />
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Exam Settings */}
      <BlurFade delay={0.1}>
        <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent-light)' }}>
              <Award className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <h3 className="text-base font-bold">Sınav Ayarları</h3>
          </div>

          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4">
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Target className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} /> Baraj Puanı
              </Label>
              <Input type="number" value={formData.passingScore} onChange={(e) => setFormData({ ...formData, passingScore: Number(e.target.value) })} className="h-10 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Award className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} /> Deneme Hakkı
              </Label>
              <Input type="number" value={formData.maxAttempts} onChange={(e) => setFormData({ ...formData, maxAttempts: Number(e.target.value) })} className="h-10 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-error)' }} /> Süre (dk)
              </Label>
              <Input type="number" value={formData.examDuration} onChange={(e) => setFormData({ ...formData, examDuration: Number(e.target.value) })} className="h-10 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--color-info)' }} /> Son Tarih
              </Label>
              <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="h-10 rounded-xl font-mono" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Actions */}
      <BlurFade delay={0.15}>
        <div className="flex items-center justify-between">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => router.back()} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            İptal
          </Button>
          <ShimmerButton
            onClick={handleSave}
            disabled={saving || saved}
            className="gap-2 text-sm font-semibold"
            borderRadius="12px"
            background={saved ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #0d9668, #065f46)'}
            shimmerColor="rgba(255,255,255,0.15)"
          >
            {saving ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Kaydediliyor...</>
            ) : saved ? (
              <><Save className="h-4 w-4" /> Kaydedildi!</>
            ) : (
              <><Save className="h-4 w-4" /> Değişiklikleri Kaydet</>
            )}
          </ShimmerButton>
        </div>
      </BlurFade>
    </div>
  );
}
