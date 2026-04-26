'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Loader2, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/shared/toast';
import { PageLoading } from '@/components/shared/page-loading';

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

const cardStyle: React.CSSProperties = {
  background: K.SURFACE,
  border: `1.5px solid ${K.BORDER}`,
  borderRadius: 14,
  boxShadow: K.SHADOW_CARD,
};

const sectionHeading: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  fontFamily: K.FONT_DISPLAY,
  color: K.TEXT_PRIMARY,
};

const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then((m) => ({ default: m.RichTextEditor })),
  { ssr: false, loading: () => <div className="animate-pulse rounded-lg h-28" style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }} /> },
);

interface QuestionItem {
  id: string;
  text: string;
  points: number;
  options: string[];
  correct: number;
}

interface ExamData {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  maxAttempts: number;
  examDurationMinutes: number;
  startDate: string;
  endDate: string;
  isCompulsory: boolean;
  isActive: boolean;
  publishStatus: string;
  randomizeQuestions?: boolean;
  attemptCount?: number;
  questions: {
    id: string;
    text: string;
    points?: number;
    options: { id: string; text: string; isCorrect: boolean; order?: number }[];
  }[];
}

export default function EditExamPage() {
  const router = useRouter();
  const params = useParams();
  const examId = params.id as string;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [examDurationMinutes, setExamDurationMinutes] = useState(30);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCompulsory, setIsCompulsory] = useState(false);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);
  const [hasAttempts, setHasAttempts] = useState(false);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);

  useEffect(() => {
    fetch(`/api/admin/standalone-exams/${examId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error('load-failed');
        return r.json();
      })
      .then((exam: ExamData) => {
        setTitle(exam.title);
        setDescription(exam.description ?? '');
        setPassingScore(exam.passingScore);
        setMaxAttempts(exam.maxAttempts);
        setExamDurationMinutes(exam.examDurationMinutes);
        setStartDate(exam.startDate.split('T')[0]);
        setEndDate(exam.endDate.split('T')[0]);
        setIsCompulsory(exam.isCompulsory);
        setRandomizeQuestions(exam.randomizeQuestions ?? false);
        setHasAttempts((exam.attemptCount ?? 0) > 0);
        setQuestions(
          exam.questions.map((q) => ({
            id: q.id,
            text: q.text,
            points: q.points ?? 10,
            options: q.options.map((o) => o.text),
            correct: q.options.findIndex((o) => o.isCorrect),
          }))
        );
        setLoading(false);
      })
      .catch(() => {
        toast('Sınav yüklenemedi', 'error');
        router.push('/admin/exams');
      });
  }, [examId, router, toast]);

  const addQuestion = () => {
    setQuestions(prev => [...prev, { id: `new-${Date.now()}`, text: '', points: 10, options: ['', '', '', ''], correct: -1 }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!title.trim()) { toast('Sınav adı gerekli', 'error'); return; }
    if (new Date(endDate) <= new Date(startDate)) {
      toast('Bitiş tarihi başlangıç tarihinden sonra olmalı', 'error');
      return;
    }
    const validQuestions = questions.filter(
      (q) => q.text.trim().length >= 5 && q.options.every((o) => o.trim().length > 0) && q.correct >= 0,
    );
    if (questions.length !== validQuestions.length) {
      toast('Tüm sorularda metin (min 5 karakter), 4 şık ve doğru cevap gerekli', 'error');
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title,
        description,
        passingScore,
        maxAttempts,
        examDurationMinutes,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        isCompulsory,
        randomizeQuestions,
      };
      if (!hasAttempts) {
        body.questions = validQuestions.map((q) => ({
          text: q.text,
          points: q.points,
          correctOptionIndex: q.correct,
          options: q.options,
        }));
      }
      const res = await fetch(`/api/admin/standalone-exams/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Güncelleme başarısız');
      toast('Sınav güncellendi', 'success');
      router.push('/admin/exams');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/exams')} style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 style={{ ...sectionHeading, fontSize: 20 }}>Sınavı Düzenle</h1>
            <p className="text-sm" style={{ color: K.TEXT_MUTED }}>{title}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 font-semibold rounded-xl" style={{ background: K.PRIMARY, color: '#fff' }}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Kaydet
        </Button>
      </div>

      {/* Sınav Bilgileri */}
      <div className="p-6" style={cardStyle}>
        <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Sınav Bilgileri</h3>
        <div className="space-y-4">
          <div>
            <Label>Sınav Adı *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Açıklama</Label>
            <div className="mt-1">
              <RichTextEditor value={description} onChange={setDescription} placeholder="Sınav hakkında açıklama..." minHeight={100} />
            </div>
          </div>
        </div>
      </div>

      {/* Tarihler */}
      <div className="p-6" style={cardStyle}>
        <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Sınav Tarihleri</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Başlangıç Tarihi *</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Bitiş Tarihi *</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
          </div>
        </div>
      </div>

      {/* Ayarlar */}
      <div className="p-6" style={cardStyle}>
        <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Sınav Ayarları</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Label>Baraj Puanı (%)</Label>
            <Input type="number" min={0} max={100} value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label>Deneme Hakkı</Label>
            <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label>Süre (dk)</Label>
            <Input type="number" min={5} max={180} value={examDurationMinutes} onChange={(e) => setExamDurationMinutes(Number(e.target.value))} className="mt-1" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsCompulsory((v) => !v)}
              className="relative inline-flex shrink-0 cursor-pointer rounded-full"
              style={{ width: 48, height: 26, background: isCompulsory ? K.PRIMARY : K.BORDER, transition: 'background 0.25s' }}
            >
              <span className="absolute rounded-full bg-white" style={{ width: 20, height: 20, top: 3, left: isCompulsory ? 25 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.25s' }} />
            </button>
            <span className="text-sm" style={{ color: K.TEXT_SECONDARY }}>Zorunlu Sınav</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setRandomizeQuestions((v) => !v)}
              className="relative inline-flex shrink-0 cursor-pointer rounded-full"
              style={{ width: 48, height: 26, background: randomizeQuestions ? K.PRIMARY : K.BORDER, transition: 'background 0.25s' }}
            >
              <span className="absolute rounded-full bg-white" style={{ width: 20, height: 20, top: 3, left: randomizeQuestions ? 25 : 3, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.25s' }} />
            </button>
            <span className="text-sm" style={{ color: K.TEXT_SECONDARY }}>Soruları Karıştır</span>
          </div>
        </div>
      </div>

      {/* Sorular */}
      <div className="p-6" style={cardStyle}>
        <div className="flex items-center justify-between mb-4">
          <h3 style={sectionHeading}>{questions.length} Soru</h3>
          {!hasAttempts && (
            <Button onClick={addQuestion} variant="outline" className="gap-2 rounded-xl" style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}>
              <Plus className="h-4 w-4" /> Soru Ekle
            </Button>
          )}
        </div>
        {hasAttempts && (
          <div className="mb-4 rounded-xl border p-3 text-xs flex items-start gap-2" style={{ background: K.WARNING_BG, borderColor: K.WARNING, color: K.WARNING }}>
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Sınava katılım başladığı için sorular değiştirilemez. Değişiklik için önce sınavı arşivleyin veya yeni bir sınav oluşturun.</span>
          </div>
        )}

        <div className="space-y-4">
          {questions.map((q, qi) => (
            <div key={q.id} className="rounded-xl border p-4" style={{ borderColor: K.BORDER_LIGHT, background: K.BG }}>
              <div className="flex items-start gap-3">
                <GripVertical className="h-5 w-5 mt-2 shrink-0" style={{ color: K.TEXT_MUTED }} />
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: K.TEXT_MUTED }}>S{qi + 1}</span>
                    <Input
                      value={q.text}
                      readOnly={hasAttempts}
                      onChange={(e) => setQuestions(prev => prev.map((p, i) => i === qi ? { ...p, text: e.target.value } : p))}
                      placeholder="Soru metni..."
                      className="flex-1"
                    />
                    {!hasAttempts && (
                      <Button variant="ghost" size="icon" onClick={() => removeQuestion(qi)}>
                        <Trash2 className="h-4 w-4" style={{ color: K.ERROR }} />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          disabled={hasAttempts}
                          onClick={() => setQuestions(prev => prev.map((p, i) => i === qi ? { ...p, correct: oi } : p))}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold disabled:cursor-not-allowed"
                          style={{
                            borderColor: q.correct === oi ? K.SUCCESS : K.BORDER,
                            background: q.correct === oi ? K.SUCCESS : 'transparent',
                            color: q.correct === oi ? '#fff' : K.TEXT_MUTED,
                          }}
                        >
                          {String.fromCharCode(65 + oi)}
                        </button>
                        <Input
                          value={opt}
                          readOnly={hasAttempts}
                          onChange={(e) => {
                            const newOptions = [...q.options];
                            newOptions[oi] = e.target.value;
                            setQuestions(prev => prev.map((p, i) => i === qi ? { ...p, options: newOptions } : p));
                          }}
                          placeholder={`${String.fromCharCode(65 + oi)} şıkkı`}
                          className="flex-1 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
