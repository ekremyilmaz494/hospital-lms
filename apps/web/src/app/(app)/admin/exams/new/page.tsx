'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Info,
  FileQuestion,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Save,
  Plus,
  Trash2,
  GripVertical,
  Library,
  X,
  Check,
  Search,
  Users,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFetch } from '@/hooks/use-fetch';
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
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse rounded-lg h-28"
        style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}
      />
    ),
  },
);

interface QuestionItem {
  id: number;
  text: string;
  points: number;
  options: string[];
  correct: number;
}

interface BankQuestion {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  points: number;
  options: { text: string; isCorrect: boolean; order: number }[];
}

const TRAINING_CATEGORIES = [
  { value: 'Enfeksiyon', label: 'Enfeksiyon', icon: 'syringe' },
  { value: 'İş Güvenliği', label: 'İş Güvenliği', icon: 'hardhat' },
  { value: 'Hasta Hakları', label: 'Hasta Hakları', icon: 'scale' },
  { value: 'Radyoloji', label: 'Radyoloji', icon: 'radiation' },
  { value: 'Laboratuvar', label: 'Laboratuvar', icon: 'flask' },
  { value: 'Eczane', label: 'Eczane', icon: 'pill' },
  { value: 'Acil', label: 'Acil', icon: 'ambulance' },
  { value: 'Genel', label: 'Genel', icon: 'clipboard' },
];

const steps = [
  { id: 1, title: 'Temel Bilgiler', description: 'Sınav detayları', icon: Info },
  { id: 2, title: 'Sorular', description: 'Soru bankası', icon: FileQuestion },
];

export default function NewExamPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: dbCategories } = useFetch<{ id: string; value: string; label: string; icon: string }[]>(
    '/api/admin/training-categories',
  );
  const categories = dbCategories && dbCategories.length > 0 ? dbCategories : TRAINING_CATEGORIES;

  // Step
  const [currentStep, setCurrentStep] = useState(1);
  const [publishing, setPublishing] = useState(false);

  // Step 1: Basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  );
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [examDurationMinutes, setExamDurationMinutes] = useState(30);
  const [isCompulsory, setIsCompulsory] = useState(false);
  const [randomizeQuestions, setRandomizeQuestions] = useState(false);

  // Department & staff assignment
  const { data: departments } = useFetch<{ id: string; name: string; color: string | null; count: number; staff: { id: string; name: string; title: string; initials: string }[] }[]>('/api/admin/departments');
  const [selectedDepts, setSelectedDepts] = useState<Set<string>>(new Set());
  const [excludedStaff, setExcludedStaff] = useState<Set<string>>(new Set());

  const toggleDept = (deptId: string) => {
    setSelectedDepts(prev => {
      const next = new Set(prev);
      if (next.has(deptId)) { next.delete(deptId); } else { next.add(deptId); }
      return next;
    });
    // Remove excluded staff from deselected dept
    if (selectedDepts.has(deptId)) {
      const deptStaffIds = new Set(departments?.find(d => d.id === deptId)?.staff.map(s => s.id) ?? []);
      setExcludedStaff(prev => {
        const next = new Set(prev);
        deptStaffIds.forEach(id => next.delete(id));
        return next;
      });
    }
  };

  const toggleAllDepts = () => {
    if (!departments) return;
    if (selectedDepts.size === departments.length) {
      setSelectedDepts(new Set());
      setExcludedStaff(new Set());
    } else {
      setSelectedDepts(new Set(departments.map(d => d.id)));
    }
  };

  const toggleExcludeStaff = (staffId: string) => {
    setExcludedStaff(prev => {
      const next = new Set(prev);
      if (next.has(staffId)) { next.delete(staffId); } else { next.add(staffId); }
      return next;
    });
  };

  const selectedStaffCount = useMemo(() => {
    if (!departments || selectedDepts.size === 0) return 0;
    return departments
      .filter(d => selectedDepts.has(d.id))
      .reduce((sum, d) => sum + d.staff.filter(s => !excludedStaff.has(s.id)).length, 0);
  }, [departments, selectedDepts, excludedStaff]);

  // Step 2: Questions
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { id: 1, text: '', points: 1, options: ['', '', '', ''], correct: -1 },
  ]);

  // Question Bank Modal
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankDifficulty, setBankDifficulty] = useState('');
  const [bankCategory, setBankCategory] = useState('');
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set());
  const { data: bankData } = useFetch<{ questions: BankQuestion[] }>(
    showBankModal
      ? `/api/admin/question-bank?limit=100${bankSearch ? `&search=${bankSearch}` : ''}${bankDifficulty ? `&difficulty=${bankDifficulty}` : ''}${bankCategory ? `&category=${bankCategory}` : ''}`
      : null,
  );

  const totalPoints = useMemo(
    () => questions.reduce((s, q) => s + q.points, 0),
    [questions],
  );
  const estimatedMinutes = useMemo(
    () => Math.max(1, Math.ceil(questions.length * 1.5)),
    [questions],
  );

  const addQuestion = () =>
    setQuestions((prev) => [
      ...prev,
      { id: Date.now(), text: '', points: 1, options: ['', '', '', ''], correct: -1 },
    ]);

  const removeQuestion = (id: number) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));

  const updateQuestion = (id: number, patch: Partial<QuestionItem>) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const updateOption = (qId: number, optIdx: number, value: string) =>
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const opts = [...q.options];
        opts[optIdx] = value;
        return { ...q, options: opts };
      }),
    );

  const addFromBank = () => {
    const bankQuestions = bankData?.questions ?? [];
    const selected = bankQuestions.filter((bq) => selectedBankIds.has(bq.id));
    const newQuestions: QuestionItem[] = selected.map((bq) => ({
      id: Date.now() + Math.random(),
      text: bq.text,
      points: bq.points,
      options: bq.options
        .sort((a, b) => a.order - b.order)
        .map((o) => o.text),
      correct: bq.options.sort((a, b) => a.order - b.order).findIndex((o) => o.isCorrect),
    }));
    setQuestions((prev) => [...prev, ...newQuestions]);
    setSelectedBankIds(new Set());
    setShowBankModal(false);
    toast(`${newQuestions.length} soru eklendi`, 'success');
  };

  const canGoNext = () => {
    if (currentStep === 1) {
      return title.length >= 3 && startDate && endDate;
    }
    return true;
  };

  const handleSubmit = async (publishStatus: 'draft' | 'published') => {
    // Validasyon
    const validQuestions = questions.filter(
      (q) => q.text.length >= 5 && q.options.every((o) => o.length > 0) && q.correct >= 0,
    );
    if (validQuestions.length === 0 && publishStatus === 'published') {
      toast('En az 1 geçerli soru gerekli (metin, 4 şık ve doğru cevap)', 'error');
      return;
    }

    setPublishing(true);
    try {
      const res = await fetch('/api/admin/standalone-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          passingScore: Number(passingScore) || 70,
          maxAttempts: Number(maxAttempts) || 3,
          examDurationMinutes: Number(examDurationMinutes) || 30,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          isCompulsory,
          randomizeQuestions,
          selectedDepts: selectedDepts.size > 0 ? Array.from(selectedDepts) : undefined,
          excludedStaff: excludedStaff.size > 0 ? Array.from(excludedStaff) : undefined,
          questions: (publishStatus === 'published' ? validQuestions : questions.filter((q) => q.text.length > 0)).map(
            (q) => ({
              text: q.text,
              points: q.points,
              correctOptionIndex: q.correct,
              options: q.options,
            }),
          ),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Sınav oluşturulamadı');
      }

      toast(
        publishStatus === 'published' ? 'Sınav başarıyla yayınlandı!' : 'Sınav taslak olarak kaydedildi',
        'success',
      );
      router.push('/admin/exams');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Step Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ ...sectionHeading, fontSize: 22 }} className="text-balance">Yeni Sınav Oluştur</h2>
          <p className="text-sm mt-1" style={{ color: K.TEXT_SECONDARY }}>
            Video olmadan, sadece sorulardan oluşan bağımsız sınav
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-3">
        {steps.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          const StepIcon = step.icon;
          return (
            <div key={step.id} className="flex items-center gap-3">
              {idx > 0 && (
                <div
                  className="h-[2px] w-8"
                  style={{ background: isCompleted ? K.PRIMARY : K.BORDER }}
                />
              )}
              <button
                onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                className="flex items-center gap-2.5 rounded-xl px-4 py-2.5"
                style={{
                  background: isActive
                    ? K.PRIMARY
                    : isCompleted
                      ? K.PRIMARY_LIGHT
                      : K.SURFACE,
                  border: `1.5px solid ${isActive ? K.PRIMARY : isCompleted ? K.PRIMARY : K.BORDER}`,
                  cursor: step.id <= currentStep ? 'pointer' : 'default',
                  opacity: step.id > currentStep ? 0.5 : 1,
                }}
              >
                <StepIcon
                  className="h-4 w-4"
                  style={{ color: isActive ? '#fff' : isCompleted ? K.PRIMARY : K.TEXT_MUTED }}
                />
                <div className="text-left">
                  <p
                    className="text-xs font-semibold"
                    style={{ color: isActive ? '#fff' : isCompleted ? K.PRIMARY : K.TEXT_PRIMARY }}
                  >
                    {step.title}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: isActive ? 'rgba(255,255,255,0.8)' : K.TEXT_MUTED }}
                  >
                    {step.description}
                  </p>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
        >
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Kart 1: Sınav Bilgileri */}
              <div className="p-6" style={cardStyle}>
                <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Sınav Bilgileri</h3>
                <div className="space-y-4">
                  <div>
                    <Label>Sınav Adı *</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Örn: 2024 Enfeksiyon Kontrol Sınavı"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Açıklama</Label>
                    <div className="mt-1">
                      <RichTextEditor
                        value={description}
                        onChange={setDescription}
                        placeholder="Sınav hakkında açıklama yazın..."
                        minHeight={100}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Kart 2: Tarihler */}
              <div className="p-6" style={cardStyle}>
                <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Sınav Tarihleri</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Başlangıç Tarihi *</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Bitiş Tarihi *</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Kart 3: Ayarlar */}
              <div className="p-6" style={cardStyle}>
                <h3 style={{ ...sectionHeading, marginBottom: 16 }}>Sınav Ayarları</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Baraj Puanı (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={passingScore}
                      onChange={(e) => setPassingScore(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Deneme Hakkı</Label>
                    <Input
                      type="number"
                      min={1}
                      max={10}
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Süre (dk)</Label>
                    <Input
                      type="number"
                      min={5}
                      max={180}
                      value={examDurationMinutes}
                      onChange={(e) => setExamDurationMinutes(Number(e.target.value))}
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Soruları Karıştır */}
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                      Soruları Karıştır
                    </p>
                    <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
                      Her personele farklı soru sırası gösterilir
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRandomizeQuestions((v) => !v)}
                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent"
                    style={{
                      background: randomizeQuestions ? K.PRIMARY : K.BORDER,
                      transition: 'background 0.25s',
                    }}
                  >
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow"
                      style={{
                        transform: randomizeQuestions ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 0.25s',
                      }}
                    />
                  </button>
                </div>

              </div>

              {/* Kart 4: Departman & Personel Atama */}
              <div className="p-6" style={cardStyle}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" style={{ color: K.PRIMARY }} />
                    <h3 style={sectionHeading}>Departman & Personel Atama</h3>
                  </div>
                  {departments && departments.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleAllDepts}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ color: K.PRIMARY, background: K.PRIMARY_LIGHT }}
                    >
                      {selectedDepts.size === departments.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                    </button>
                  )}
                </div>
                <p className="text-xs mb-3" style={{ color: K.TEXT_MUTED }}>
                  Sınavı hangi departmanlara atamak istediğinizi seçin. Seçmezseniz sınav kimseye atanmaz.
                </p>

                {/* Departman Seçimi */}
                {departments && departments.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {departments.map((dept) => {
                        const isSelected = selectedDepts.has(dept.id);
                        return (
                          <button
                            key={dept.id}
                            type="button"
                            onClick={() => toggleDept(dept.id)}
                            className="flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left"
                            style={{
                              border: `1.5px solid ${isSelected ? K.PRIMARY : K.BORDER}`,
                              background: isSelected ? K.PRIMARY_LIGHT : K.BG,
                              transition: 'border-color 0.15s, background 0.15s',
                            }}
                          >
                            <div
                              className="h-3 w-3 rounded-full shrink-0"
                              style={{ background: dept.color || K.PRIMARY }}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" style={{ color: isSelected ? K.PRIMARY : K.TEXT_SECONDARY }}>
                                {dept.name}
                              </p>
                              <p className="text-[10px]" style={{ color: K.TEXT_MUTED }}>{dept.count} personel</p>
                            </div>
                            {isSelected && <Check className="h-4 w-4 shrink-0" style={{ color: K.PRIMARY }} />}
                          </button>
                        );
                      })}
                    </div>

                    {/* Seçili Departmanların Personeli */}
                    {selectedDepts.size > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" style={{ color: K.TEXT_MUTED }} />
                            <p className="text-xs font-semibold" style={{ color: K.TEXT_SECONDARY }}>
                              Atanacak Personel ({selectedStaffCount} kişi)
                            </p>
                          </div>
                          {excludedStaff.size > 0 && (
                            <button
                              type="button"
                              onClick={() => setExcludedStaff(new Set())}
                              className="text-[10px] font-medium px-2 py-1 rounded"
                              style={{ color: K.TEXT_MUTED }}
                            >
                              Hariç tutulanları temizle
                            </button>
                          )}
                        </div>
                        <div
                          className="rounded-xl p-3 max-h-48 overflow-y-auto space-y-1"
                          style={{ border: `1px solid ${K.BORDER_LIGHT}`, background: K.BG }}
                        >
                          {departments
                            .filter(d => selectedDepts.has(d.id))
                            .flatMap(d => d.staff.map(s => ({ ...s, deptName: d.name, deptColor: d.color })))
                            .map(s => {
                              const isExcluded = excludedStaff.has(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleExcludeStaff(s.id)}
                                  className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 text-left"
                                  style={{
                                    opacity: isExcluded ? 0.45 : 1,
                                    background: isExcluded ? K.ERROR_BG : 'transparent',
                                    transition: 'opacity 0.15s, background 0.15s',
                                  }}
                                >
                                  <div
                                    className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                                    style={{ background: s.deptColor || K.PRIMARY }}
                                  >
                                    {s.initials}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate" style={{ color: K.TEXT_PRIMARY, textDecoration: isExcluded ? 'line-through' : 'none' }}>{s.name}</p>
                                    <p className="text-[10px] truncate" style={{ color: K.TEXT_MUTED }}>{s.deptName}{s.title ? ` · ${s.title}` : ''}</p>
                                  </div>
                                  {isExcluded && (
                                    <span className="shrink-0 rounded-full" style={{ padding: '2px 8px', fontSize: 11, fontWeight: 600, background: K.ERROR_BG, color: K.ERROR }}>
                                      Hariç
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          {departments
                            .filter(d => selectedDepts.has(d.id))
                            .every(d => d.staff.length === 0) && (
                            <p className="text-xs text-center py-3" style={{ color: K.TEXT_MUTED }}>Seçili departmanlarda aktif personel yok</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: K.TEXT_MUTED }}>Henüz departman tanımlanmamış</p>
                )}
              </div>

              {/* Kart 5: Zorunlu */}
              <div className="p-6" style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 style={sectionHeading}>Zorunlu Sınav</h3>
                    <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                      Personelin tamamlaması zorunlu sınav olarak işaretler
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCompulsory((v) => !v)}
                    className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent"
                    style={{
                      background: isCompulsory ? K.WARNING : K.BORDER,
                      transition: 'background 0.25s',
                    }}
                  >
                    <span
                      className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow"
                      style={{
                        transform: isCompulsory ? 'translateX(20px)' : 'translateX(0)',
                        transition: 'transform 0.25s',
                      }}
                    />
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              {/* Üst bilgi */}
              <div
                className="flex items-center gap-4 px-5 py-3"
                style={cardStyle}
              >
                <span className="text-sm font-semibold" style={{ color: K.PRIMARY }}>
                  {questions.length} soru
                </span>
                <span className="text-xs" style={{ color: K.TEXT_MUTED }}>·</span>
                <span className="text-sm" style={{ color: K.TEXT_SECONDARY }}>
                  Toplam {totalPoints} puan
                </span>
                <span className="text-xs" style={{ color: K.TEXT_MUTED }}>·</span>
                <span className="text-sm" style={{ color: K.TEXT_SECONDARY }}>
                  Tahmini {estimatedMinutes} dk
                </span>
              </div>

              {/* Soru listesi */}
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="p-5"
                  style={cardStyle}
                >
                  <div className="flex items-start gap-3">
                    {/* Drag handle */}
                    <div
                      className="mt-2 cursor-grab"
                      style={{ color: K.TEXT_MUTED }}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div className="flex-1 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs font-bold uppercase tracking-wider"
                          style={{ color: K.PRIMARY }}
                        >
                          Soru {idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <Label className="text-[11px]">Puan:</Label>
                            <Input
                              type="number"
                              min={1}
                              max={10}
                              value={q.points}
                              onChange={(e) =>
                                updateQuestion(q.id, { points: Number(e.target.value) || 1 })
                              }
                              className="h-7 w-16 text-xs text-center"
                            />
                          </div>
                          {questions.length > 1 && (
                            <button
                              onClick={() => removeQuestion(q.id)}
                              className="rounded-md p-1.5"
                              style={{ color: K.ERROR }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Soru metni */}
                      <textarea
                        value={q.text}
                        onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                        placeholder="Soru metnini yazın..."
                        rows={2}
                        className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                        style={{
                          background: K.BG,
                          border: `1px solid ${K.BORDER}`,
                          color: K.TEXT_PRIMARY,
                        }}
                      />

                      {/* Şıklar */}
                      <div className="grid grid-cols-2 gap-2">
                        {['A', 'B', 'C', 'D'].map((letter, optIdx) => (
                          <label
                            key={letter}
                            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 cursor-pointer"
                            style={{
                              border: `1.5px solid ${q.correct === optIdx ? K.SUCCESS : K.BORDER}`,
                              background:
                                q.correct === optIdx ? K.SUCCESS_BG : K.SURFACE,
                              transition:
                                'border-color 0.15s, background 0.15s',
                            }}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={q.correct === optIdx}
                              onChange={() => updateQuestion(q.id, { correct: optIdx })}
                              className="sr-only"
                            />
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                              style={{
                                background:
                                  q.correct === optIdx ? K.SUCCESS : K.BORDER,
                                color: q.correct === optIdx ? '#fff' : K.TEXT_MUTED,
                              }}
                            >
                              {q.correct === optIdx ? <Check className="h-3 w-3" /> : letter}
                            </span>
                            <Input
                              value={q.options[optIdx]}
                              onChange={(e) => updateOption(q.id, optIdx, e.target.value)}
                              placeholder={`${letter} şıkkı`}
                              className="flex-1 h-7 border-0 bg-transparent text-sm"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Soru ekleme butonları */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={addQuestion}
                  className="gap-2 rounded-xl flex-1"
                  style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
                >
                  <Plus className="h-4 w-4" /> Manuel Soru Ekle
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowBankModal(true)}
                  className="gap-2 rounded-xl flex-1"
                  style={{ background: K.PRIMARY_LIGHT, border: `1px solid ${K.PRIMARY}`, color: K.PRIMARY }}
                >
                  <Library className="h-4 w-4" /> Soru Bankasından Seç
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between px-6 py-4" style={cardStyle}>
        <Button
          variant="outline"
          onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back())}
          className="gap-2 rounded-xl"
          style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
        >
          <ArrowLeft className="h-4 w-4" />
          {currentStep === 1 ? 'İptal' : 'Geri'}
        </Button>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {steps.map((step) => (
            <div
              key={step.id}
              className="h-1.5 rounded-full"
              style={{
                width: step.id === currentStep ? '24px' : '8px',
                background: step.id <= currentStep ? K.PRIMARY : K.BORDER,
                transition: 'width 0.2s, background 0.2s',
              }}
            />
          ))}
        </div>

        {currentStep < 2 ? (
          <Button
            onClick={() => setCurrentStep(2)}
            disabled={!canGoNext()}
            className="gap-2 rounded-xl font-semibold"
            style={{
              background: K.PRIMARY,
              color: '#fff',
            }}
          >
            Sonraki Adım <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSubmit('draft')}
              disabled={publishing}
              className="gap-2 rounded-xl"
              style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
            >
              <Save className="h-4 w-4" /> Taslak Kaydet
            </Button>
            <Button
              onClick={() => handleSubmit('published')}
              disabled={publishing}
              className="gap-2 rounded-xl font-semibold"
              style={{
                background: K.PRIMARY,
                color: '#fff',
              }}
            >
              <Sparkles className="h-4 w-4" /> {publishing ? 'Kaydediliyor...' : 'Yayınla'}
            </Button>
          </div>
        )}
      </div>

      {/* Soru Bankası Modal */}
      {showBankModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="mx-4 w-full max-w-2xl overflow-hidden"
            style={{ ...cardStyle, boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)' }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
            >
              <h3 style={sectionHeading}>Soru Bankasından Seç</h3>
              <button onClick={() => setShowBankModal(false)}>
                <X className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />
              </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 px-6 py-3" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
              <div className="relative flex-1">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                  style={{ color: K.TEXT_MUTED }}
                />
                <Input
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  placeholder="Soru ara..."
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <select
                value={bankDifficulty}
                onChange={(e) => setBankDifficulty(e.target.value)}
                className="rounded-lg border px-2 text-xs h-8"
                style={{ background: K.SURFACE, borderColor: K.BORDER }}
              >
                <option value="">Tüm Zorluklar</option>
                <option value="easy">Kolay</option>
                <option value="medium">Orta</option>
                <option value="hard">Zor</option>
              </select>
              <select
                value={bankCategory}
                onChange={(e) => setBankCategory(e.target.value)}
                className="rounded-lg border px-2 text-xs h-8"
                style={{ background: K.SURFACE, borderColor: K.BORDER }}
              >
                <option value="">Tüm Kategoriler</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Question List */}
            <div className="max-h-80 overflow-y-auto px-6 py-3">
              {(bankData?.questions ?? []).length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>
                  Soru bankasında soru bulunamadı
                </p>
              ) : (
                <div className="space-y-2">
                  {(bankData?.questions ?? []).map((bq) => {
                    const isSelected = selectedBankIds.has(bq.id);
                    return (
                      <button
                        key={bq.id}
                        onClick={() =>
                          setSelectedBankIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(bq.id)) next.delete(bq.id);
                            else next.add(bq.id);
                            return next;
                          })
                        }
                        className="flex w-full items-center gap-3 rounded-lg p-3 text-left"
                        style={{
                          border: `1px solid ${isSelected ? K.PRIMARY : K.BORDER_LIGHT}`,
                          background: isSelected ? K.PRIMARY_LIGHT : 'transparent',
                        }}
                      >
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                          style={{
                            border: `1px solid ${isSelected ? K.PRIMARY : K.BORDER}`,
                            background: isSelected ? K.PRIMARY : 'transparent',
                          }}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: K.TEXT_PRIMARY }}>
                            {bq.text}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px]" style={{ color: K.TEXT_MUTED }}>
                              {bq.category}
                            </span>
                            <span
                              className="rounded-full"
                              style={{
                                padding: '1px 6px',
                                fontSize: 10,
                                fontWeight: 600,
                                background:
                                  bq.difficulty === 'easy'
                                    ? K.SUCCESS_BG
                                    : bq.difficulty === 'hard'
                                      ? K.ERROR_BG
                                      : K.WARNING_BG,
                                color:
                                  bq.difficulty === 'easy'
                                    ? K.SUCCESS
                                    : bq.difficulty === 'hard'
                                      ? K.ERROR
                                      : K.WARNING,
                              }}
                            >
                              {bq.difficulty === 'easy' ? 'Kolay' : bq.difficulty === 'hard' ? 'Zor' : 'Orta'}
                            </span>
                            <span className="text-[10px]" style={{ color: K.TEXT_MUTED }}>
                              {bq.points} puan
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-between px-6 py-3"
              style={{ borderTop: `1px solid ${K.BORDER_LIGHT}` }}
            >
              <span className="text-xs" style={{ color: K.TEXT_MUTED }}>
                {selectedBankIds.size} soru seçildi
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBankModal(false)}
                  className="rounded-lg"
                  style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
                >
                  İptal
                </Button>
                <Button
                  size="sm"
                  onClick={addFromBank}
                  disabled={selectedBankIds.size === 0}
                  className="rounded-lg gap-1.5"
                  style={{ background: K.PRIMARY, color: '#fff' }}
                >
                  <Plus className="h-3.5 w-3.5" /> {selectedBankIds.size} Soruyu Ekle
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
