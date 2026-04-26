'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, Info, Clock, Award, Calendar, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface TrainingEditData {
  title: string;
  category: string;
  description: string;
  passingScore: number;
  maxAttempts: number;
  feedbackMandatory: boolean;
  examDurationMinutes: number;
  smgPoints: number;
  startDate: string;
  endDate: string;
  questionCount?: number;
}

import { TRAINING_CATEGORIES } from '@/lib/training-categories';
const categories = TRAINING_CATEGORIES;

/** Baraj puanı için en az kaç doğru cevap gerektiğini hesaplar. */
const minCorrectForPassing = (passingScore: number, totalQuestions: number): number => {
  if (totalQuestions <= 0 || passingScore <= 0) return 0;
  return Math.ceil((passingScore / 100) * totalQuestions);
};

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
    if (data) {
      setFormData({
        title: data.title || '',
        category: data.category || '',
        description: data.description || '',
        passingScore: data.passingScore || 70,
        maxAttempts: data.maxAttempts || 3,
        feedbackMandatory: data.feedbackMandatory ?? false,
        examDurationMinutes: data.examDurationMinutes || 30,
        smgPoints: typeof data.smgPoints === 'number' ? data.smgPoints : 10,
        startDate: data.startDate ? new Date(data.startDate).toISOString().split('T')[0] : '',
        endDate: data.endDate ? new Date(data.endDate).toISOString().split('T')[0] : '',
        questionCount: data.questionCount ?? 0,
      });
    }
  }, [data]);

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: K.ERROR }}>{error}</div></div>;
  }

  if (!formData) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: K.TEXT_MUTED }}>Eğitim bulunamadı</div></div>;
  }

  const validate = (d: TrainingEditData): string | null => {
    if (!d.title.trim()) return 'Eğitim adı boş olamaz.';
    if (!d.category.trim()) return 'Kategori seçilmelidir.';
    if (!Number.isFinite(d.passingScore) || d.passingScore < 0 || d.passingScore > 100) {
      return 'Baraj puanı 0 ile 100 arasında olmalıdır.';
    }
    if (!Number.isFinite(d.maxAttempts) || d.maxAttempts < 1 || d.maxAttempts > 10) {
      return 'Deneme hakkı 1 ile 10 arasında olmalıdır.';
    }
    if (!Number.isFinite(d.examDurationMinutes) || d.examDurationMinutes < 1 || d.examDurationMinutes > 600) {
      return 'Sınav süresi 1 ile 600 dakika arasında olmalıdır.';
    }
    if (!Number.isFinite(d.smgPoints) || d.smgPoints < 0 || d.smgPoints > 999) {
      return 'SMG puanı 0 ile 999 arasında olmalıdır.';
    }
    if (d.startDate && d.endDate && new Date(d.startDate) > new Date(d.endDate)) {
      return 'Son tarih başlangıç tarihinden önce olamaz.';
    }
    return null;
  };

  const handleSave = async () => {
    if (!formData) return;
    const err = validate(formData);
    if (err) {
      toast(err, 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        startDate: formData.startDate ? new Date(formData.startDate).toISOString() : undefined,
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
      };

      const res = await fetch(`/api/admin/trainings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  const cardStyle = { background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD };
  const inputStyle = { background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY };
  const sectionHeading = { fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}>
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}>Eğitim Düzenle</h2>
              <p className="text-sm mt-0.5" style={{ color: K.TEXT_MUTED }}>{formData.title}</p>
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Basic Info */}
      <BlurFade delay={0.05}>
        <div className="p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
              <Info className="h-5 w-5" style={{ color: K.PRIMARY }} />
            </div>
            <h3 style={sectionHeading}>Temel Bilgiler</h3>
          </div>

          <div className="space-y-5">
            <div>
              <Label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>Eğitim Adı *</Label>
              <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="h-11 rounded-xl" style={inputStyle} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>Kategori *</Label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="h-11 w-full rounded-xl border px-3 text-sm" style={inputStyle}>
                {categories.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 block" style={{ color: K.TEXT_SECONDARY }}>Açıklama</Label>
              <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} className="w-full rounded-xl border px-3 py-2.5 text-sm resize-none" style={inputStyle} />
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Exam Settings */}
      <BlurFade delay={0.1}>
        <div className="p-6" style={cardStyle}>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
              <Award className="h-5 w-5" style={{ color: K.ACCENT }} />
            </div>
            <h3 style={sectionHeading}>Sınav Ayarları</h3>
          </div>

          <div className="grid grid-cols-2 gap-5 lg:grid-cols-5">
            <div className="col-span-2 lg:col-span-5">
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: K.TEXT_SECONDARY }}>
                <Target className="h-3.5 w-3.5" style={{ color: K.PRIMARY }} /> Baraj Puanı
              </Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                <Input type="number" min={0} max={100} value={formData.passingScore} onChange={(e) => setFormData({ ...formData, passingScore: Number(e.target.value) })} className="h-10 rounded-xl font-mono" style={inputStyle} />
                <div
                  className="rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: K.PRIMARY_LIGHT,
                    color: K.PRIMARY_HOVER,
                    border: `1px dashed ${K.PRIMARY}`,
                  }}
                >
                  {(formData.questionCount ?? 0) > 0 && formData.passingScore > 0 ? (
                    <>
                      Personel barajı geçmek için{' '}
                      <strong style={{ color: K.PRIMARY }}>{formData.questionCount}</strong> sorudan en az{' '}
                      <strong style={{ color: K.PRIMARY }}>
                        {minCorrectForPassing(formData.passingScore, formData.questionCount ?? 0)}
                      </strong>{' '}
                      tanesini doğru cevaplamalı.
                    </>
                  ) : (
                    <span style={{ color: K.TEXT_MUTED }}>
                      Bu eğitimde henüz soru yok — baraj etkisi için önce soru eklemelisin.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: K.TEXT_SECONDARY }}>
                <Award className="h-3.5 w-3.5" style={{ color: K.ACCENT }} /> Deneme Hakkı
              </Label>
              <Input type="number" value={formData.maxAttempts} onChange={(e) => setFormData({ ...formData, maxAttempts: Number(e.target.value) })} className="h-10 rounded-xl font-mono" style={inputStyle} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: K.TEXT_SECONDARY }}>
                <Clock className="h-3.5 w-3.5" style={{ color: K.ERROR }} /> Süre (dk)
              </Label>
              <Input type="number" value={formData.examDurationMinutes} onChange={(e) => setFormData({ ...formData, examDurationMinutes: Number(e.target.value) })} className="h-10 rounded-xl font-mono" style={inputStyle} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: K.TEXT_SECONDARY }}>
                <Award className="h-3.5 w-3.5" style={{ color: K.SUCCESS }} /> SMG Puanı
              </Label>
              <Input type="number" min={0} max={999} value={formData.smgPoints} onChange={(e) => setFormData({ ...formData, smgPoints: Number(e.target.value) })} className="h-10 rounded-xl font-mono" style={inputStyle} />
            </div>
            <div>
              <Label className="text-xs font-semibold mb-1.5 flex items-center gap-1.5" style={{ color: K.TEXT_SECONDARY }}>
                <Calendar className="h-3.5 w-3.5" style={{ color: K.INFO }} /> Son Tarih
              </Label>
              <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="h-10 rounded-xl font-mono" style={inputStyle} />
            </div>
          </div>
        </div>
      </BlurFade>

      {/* Feedback zorunluluğu */}
      <BlurFade delay={0.12}>
        <div className="p-5" style={cardStyle}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.feedbackMandatory}
              onChange={(e) => setFormData({ ...formData, feedbackMandatory: e.target.checked })}
              className="mt-1 w-4 h-4 rounded"
              style={{ accentColor: K.PRIMARY }}
            />
            <div>
              <div className="text-[13px] font-semibold" style={{ color: K.TEXT_PRIMARY }}>Geri bildirim formu zorunlu</div>
              <div className="text-[12px] mt-1" style={{ color: K.TEXT_MUTED }}>
                İşaretlenirse personel bu eğitimi bitirdikten sonra geri bildirim formunu doldurmadan başka bir eğitime başlayamaz.
              </div>
            </div>
          </label>
        </div>
      </BlurFade>

      {/* Actions */}
      <BlurFade delay={0.15}>
        <div className="flex items-center justify-between">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={() => router.back()} style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY, background: K.SURFACE }}>
            İptal
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || saved}
            className="gap-2 text-sm font-semibold rounded-xl text-white"
            style={{ background: saved ? K.SUCCESS : K.PRIMARY }}
          >
            {saving ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Kaydediliyor...</>
            ) : saved ? (
              <><Save className="h-4 w-4" /> Kaydedildi!</>
            ) : (
              <><Save className="h-4 w-4" /> Değişiklikleri Kaydet</>
            )}
          </Button>
        </div>
      </BlurFade>
    </div>
  );
}
