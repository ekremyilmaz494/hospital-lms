'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Info, Video, FileQuestion, Users, Check, Plus, Trash2,
  GripVertical, Upload, Clock, Award, Calendar, Target, Sparkles, CheckCircle2,
  ShieldCheck, RefreshCw, Building2, FileText, Layers, Music, ChevronRight, Library
} from 'lucide-react';

/** Klinova emerald palette — sabit hex'ler (CSS var bağımlılığını azaltmak için). */
const K = {
  PRIMARY: '#0d9668',
  PRIMARY_HOVER: '#087a54',
  PRIMARY_LIGHT: '#d1fae5',
  PRIMARY_SOFT: 'rgba(13, 150, 104, 0.08)',
  SURFACE: '#ffffff',
  BG: '#fafaf9',
  BG_SOFT: '#f5f4f1',
  BORDER: '#c9c4be',
  BORDER_SOFT: '#e7e5e0',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981',
  SUCCESS_BG: '#ecfdf5',
  WARNING: '#f59e0b',
  WARNING_BG: '#fffbeb',
  ERROR: '#ef4444',
  ERROR_BG: '#fef2f2',
  INFO: '#3b82f6',
  INFO_BG: '#eff6ff',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
  FONT_MONO: 'var(--font-mono, ui-monospace)',
} as const;

const cardStyle: React.CSSProperties = {
  background: K.SURFACE,
  border: `1.5px solid ${K.BORDER}`,
  borderRadius: 16,
  padding: 24,
  boxShadow: K.SHADOW_CARD,
};
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then(m => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => <div className="animate-pulse rounded-lg border h-28" style={{ background: K.SURFACE, borderColor: K.BORDER }} />,
  }
);
import { motion, AnimatePresence } from 'framer-motion';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

const steps = [
  { id: 1, title: 'Temel Bilgiler', description: 'Eğitim detayları', icon: Info },
  { id: 2, title: 'İçerikler', description: 'Video & Doküman', icon: Layers },
  { id: 3, title: 'Sınav Soruları', description: 'Soru bankası', icon: FileQuestion },
  { id: 4, title: 'Personel Atama', description: 'Hedef kitle', icon: Users },
];

import { TRAINING_CATEGORIES } from '@/lib/training-categories';
import { CategoryIcon } from '@/components/shared/category-icon';
import { ContentLibraryModal, type SelectedContent } from './content-library-modal';

interface DeptStaff { id: string; name: string; title: string; initials: string; }
interface Dept { id: string; name: string; count: number; color: string; staff: DeptStaff[]; }

/**
 * N soruyu 100 puana eşit dağıtır. Yuvarlama artığı son soruya eklenir,
 * böylece toplam her zaman tam 100 olur (örn. 3 soru → 33+33+34).
 */
const distributePoints = (n: number): number[] => {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const remainder = 100 - base * n;
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? base + remainder : base));
};

/** Baraj puanı için en az kaç doğru cevap gerektiğini hesaplar. */
const minCorrectForPassing = (passingScore: number, totalQuestions: number): number => {
  if (totalQuestions <= 0 || passingScore <= 0) return 0;
  return Math.ceil((passingScore / 100) * totalQuestions);
};

export default function NewTrainingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: departmentsData } = useFetch<Dept[]>('/api/admin/departments');
  const departments: Dept[] = departmentsData ?? [];
  const { data: dbCategories } = useFetch<{ id: string; value: string; label: string; icon: string }[]>('/api/admin/training-categories');
  const categories = dbCategories && dbCategories.length > 0 ? dbCategories : TRAINING_CATEGORIES;
  const [currentStep, setCurrentStep] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [excludedStaff, setExcludedStaff] = useState<string[]>([]);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptSearch, setDeptSearch] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [videos, setVideos] = useState<{
    id: number; title: string; url: string; file?: File;
    contentType: 'video' | 'pdf' | 'audio'; pageCount?: number; durationSeconds?: number;
    documentKey?: string; documentFile?: File; documentUploading?: boolean;
  }[]>([]);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const docFileInputRef = useRef<HTMLInputElement>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState([
    { id: 1, text: '', points: 10, options: ['', '', '', ''], correct: -1 },
  ]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [examDurationMinutes, setExamDurationMinutes] = useState(30);
  const [smgPoints, setSmgPoints] = useState(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  // Compliance alanları
  const [isCompulsory, setIsCompulsory] = useState(false);
  const [complianceDeadline, setComplianceDeadline] = useState('');
  const [regulatoryBody, setRegulatoryBody] = useState('');
  const [renewalPeriodMonths, setRenewalPeriodMonths] = useState<number | ''>('');

  const totalSelectedStaff = departments
    .filter(d => selectedDepts.includes(d.id))
    .reduce((sum, d) => sum + d.staff.filter(s => !excludedStaff.includes(s.id)).length, 0);

  const toggleStaffExclusion = (staffId: string) => {
    setExcludedStaff(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const toggleDept = (id: string) => {
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const addContent = (type: 'video' | 'audio' | 'pdf') => {
    setVideos(prev => [...prev, { id: Date.now(), title: '', url: '', contentType: type }]);
  };

  /** Shared upload handler — uploads file to S3 via presigned URL with progress tracking */
  const uploadFileToS3 = async (itemId: number, file: File) => {
    const isPdf = file.type === 'application/pdf';
    const isAudio = file.type.startsWith('audio/');
    const maxSize = isPdf ? 100 * 1024 * 1024 : isAudio ? 200 * 1024 * 1024 : 500 * 1024 * 1024;
    const maxLabel = isPdf ? '100MB' : isAudio ? '200MB' : '500MB';
    if (file.size > maxSize) {
      toast(`Dosya boyutu ${maxLabel} sınırını aşıyor`, 'error');
      return;
    }
    const detectedType: 'video' | 'pdf' | 'audio' = isPdf ? 'pdf' : isAudio ? 'audio' : 'video';
    setVideos(prev => prev.map(v => v.id === itemId ? { ...v, file, url: '', contentType: detectedType } : v));
    setUploadProgress(prev => ({ ...prev, [itemId]: 0 }));

    // PDF page count
    if (isPdf) {
      try {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs`;
        const arrayBuf = await file.arrayBuffer();
        const pdf = await getDocument({ data: new Uint8Array(arrayBuf) }).promise;
        setVideos(prev => prev.map(v => v.id === itemId ? { ...v, pageCount: pdf.numPages } : v));
      } catch { /* continue */ }
    }

    // Audio duration
    if (isAudio) {
      try {
        const objectUrl = URL.createObjectURL(file);
        const audioEl = new Audio(objectUrl);
        audioEl.onloadedmetadata = () => {
          setVideos(prev => prev.map(v => v.id === itemId ? { ...v, durationSeconds: Math.round(audioEl.duration) } : v));
          URL.revokeObjectURL(objectUrl);
        };
        audioEl.onerror = () => URL.revokeObjectURL(objectUrl);
      } catch { /* continue */ }
    }

    // Presigned URL → S3 upload with XHR progress
    try {
      setUploadProgress(prev => ({ ...prev, [itemId]: 5 }));
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type }),
      });
      if (!presignRes.ok) {
        const err = await presignRes.json();
        toast(err.error || 'Yükleme URL alınamadı', 'error');
        setVideos(prev => prev.map(v => v.id === itemId ? { ...v, url: '', file: undefined } : v));
        setUploadProgress(prev => { const n = { ...prev }; delete n[itemId]; return n; });
        return;
      }
      const { uploadUrl, key } = await presignRes.json();
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 95);
          setUploadProgress(prev => ({ ...prev, [itemId]: Math.max(5, pct) }));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(prev => ({ ...prev, [itemId]: 100 }));
          setTimeout(() => {
            setVideos(prev => prev.map(v => v.id === itemId ? { ...v, url: key, file } : v));
            setUploadProgress(prev => { const n = { ...prev }; delete n[itemId]; return n; });
          }, 500);
          toast(isPdf ? 'Doküman yüklendi' : isAudio ? 'Ses dosyası yüklendi' : 'Video yüklendi', 'success');
        } else {
          toast('Dosya yüklenemedi', 'error');
          setVideos(prev => prev.map(v => v.id === itemId ? { ...v, url: '', file: undefined } : v));
          setUploadProgress(prev => { const n = { ...prev }; delete n[itemId]; return n; });
        }
      };
      xhr.onerror = () => {
        toast('Dosya yüklenemedi — bağlantı hatası', 'error');
        setVideos(prev => prev.map(v => v.id === itemId ? { ...v, url: '', file: undefined } : v));
        setUploadProgress(prev => { const n = { ...prev }; delete n[itemId]; return n; });
      };
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    } catch {
      toast('Dosya yüklenemedi', 'error');
      setVideos(prev => prev.map(v => v.id === itemId ? { ...v, url: '', file: undefined } : v));
      setUploadProgress(prev => { const n = { ...prev }; delete n[itemId]; return n; });
    }
  };
  const addFromLibrary = (items: SelectedContent[]) => {
    setVideos(prev => {
      // Boş satırları kaldır (url ve title yok)
      const filled = prev.filter(v => v.url || v.title);
      // Kütüphaneden seçilenleri ekle
      const newItems = items.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        contentType: item.contentType,
        durationSeconds: item.durationSeconds,
        pageCount: item.pageCount,
        documentKey: item.documentKey,
      }));
      return [...filled, ...newItems];
    });
  };
  const removeVideo = (id: number) => setVideos(prev => prev.filter(v => v.id !== id));

  const addQuestion = () => setQuestions(prev => [...prev, { id: Date.now(), text: '', points: 10, options: ['', '', '', ''], correct: -1 }]);
  const removeQuestion = (id: number) => setQuestions(prev => prev.filter(q => q.id !== id));

  const validateStep = (step: number): string | null => {
    if (step === 1) {
      if (!title.trim()) return 'Eğitim adı boş olamaz.';
      if (!selectedCategory) return 'Kategori seçilmelidir.';
      if (!startDate || !endDate) return 'Başlangıç ve bitiş tarihleri zorunludur.';
      if (new Date(startDate) > new Date(endDate)) return 'Bitiş tarihi başlangıç tarihinden önce olamaz.';
      const ma = Number(maxAttempts);
      if (!Number.isFinite(ma) || ma < 1 || ma > 10) return 'Deneme hakkı 1 ile 10 arasında olmalıdır.';
      const ed = Number(examDurationMinutes);
      if (!Number.isFinite(ed) || ed < 1 || ed > 600) return 'Sınav süresi 1 ile 600 dakika arasında olmalıdır.';
      if (isCompulsory) {
        if (!complianceDeadline) return 'Zorunlu eğitimler için uyum son tarihi girilmelidir.';
        if (!regulatoryBody.trim()) return 'Zorunlu eğitimler için düzenleyici kurum girilmelidir.';
      }
    }
    if (step === 2) {
      if (Object.keys(uploadProgress).length > 0) {
        return 'Dosya yüklemesi devam ediyor. Lütfen tamamlanmasını bekleyin.';
      }
      const pending = videos.find(v => !v.url);
      if (pending) {
        return 'Tamamlanmamış içerik var. Dosya yükleyin ya da satırı kaldırın.';
      }
      const missingTitle = videos.find(v => v.url && !v.title.trim() && !v.file?.name);
      if (missingTitle) return 'Tüm içeriklere başlık girin.';
      // PDF içerikler son sınava geçişi tetiklemez — en az 1 video/ses zorunlu
      const hasPlayable = videos.some(v => v.contentType === 'video' || v.contentType === 'audio');
      if (videos.length > 0 && !hasPlayable) {
        return 'Eğitimde en az bir video veya ses içeriği bulunmalıdır. PDF tek başına yeterli değildir.';
      }
    }
    if (step === 3) {
      const ps = Number(passingScore);
      if (!Number.isFinite(ps) || ps < 0 || ps > 100) return 'Baraj puanı 0 ile 100 arasında olmalıdır.';
      for (const q of questions) {
        if (!q.text.trim()) return 'Tüm soruların metni doldurulmalıdır.';
        const emptyOption = q.options.findIndex(o => !o.trim());
        if (emptyOption !== -1) return 'Tüm seçenekler doldurulmalıdır (boş seçenek bırakmayın).';
        if (q.correct < 0 || q.correct > 3) return 'Her soru için doğru cevap seçilmelidir.';
      }
    }
    return null;
  };

  const goToNextStep = () => {
    const err = validateStep(currentStep);
    if (err) {
      toast(err, 'error');
      return;
    }
    setCurrentStep(currentStep + 1);
  };

  return (
    <div className="k-page" style={{ background: K.BG, minHeight: '100%' }}>
      {/* Page header — Klinova breadcrumb + title */}
      <header className="k-page-header" style={{ marginBottom: 24 }}>
        <div>
          <div className="k-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: K.TEXT_MUTED, marginBottom: 8 }}>
            <span>Panel</span>
            <ChevronRight size={12} />
            <span>Eğitimler</span>
            <ChevronRight size={12} />
            <span data-current="true" style={{ color: K.TEXT_PRIMARY, fontWeight: 600 }}>Yeni Eğitim</span>
          </div>
          <h1 className="k-page-title" style={{ fontFamily: K.FONT_DISPLAY, fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: K.TEXT_PRIMARY, margin: 0 }}>
            Yeni Eğitim Oluştur
          </h1>
          <p className="k-page-subtitle" style={{ fontSize: 14, color: K.TEXT_MUTED, marginTop: 6 }}>
            4 adımda eğitiminizi tamamlayın — bilgi, içerik, sınav ve atama.
          </p>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Step Indicator — emerald progress + numbered circles */}
      <div style={{ ...cardStyle, padding: 20 }}>
        <div className="flex items-center" style={{ gap: 0 }}>
          {steps.map((step, idx) => {
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            const isPending = !isActive && !isCompleted;
            const circleBg = isActive ? K.PRIMARY : isCompleted ? K.PRIMARY : '#f5f4f1';
            const circleColor = isActive || isCompleted ? '#fff' : K.TEXT_MUTED;
            const circleBorder = isPending ? `1.5px solid ${K.BORDER}` : 'none';
            return (
              <div key={step.id} className="flex flex-1 items-center">
                <button
                  onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                  className="flex flex-1 items-center gap-3 px-3 py-2"
                  style={{
                    background: 'transparent',
                    cursor: step.id <= currentStep ? 'pointer' : 'default',
                    border: 'none',
                    borderRadius: 10,
                  }}
                >
                  <div
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: circleBg,
                      color: circleColor,
                      border: circleBorder,
                      fontFamily: K.FONT_DISPLAY,
                      fontWeight: 700,
                      fontSize: 14,
                      transition: 'background 150ms ease',
                    }}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : step.id}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: isActive ? K.TEXT_PRIMARY : isCompleted ? K.PRIMARY : K.TEXT_MUTED,
                        margin: 0,
                      }}
                    >
                      {step.title}
                    </p>
                    <p style={{ fontSize: 11, color: K.TEXT_MUTED, margin: 0 }}>
                      {step.description}
                    </p>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className="shrink-0"
                    style={{
                      height: 2,
                      width: 40,
                      background: isCompleted ? K.PRIMARY : K.BORDER_SOFT,
                      borderRadius: 999,
                      transition: 'background 150ms ease',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          style={{
            background: K.SURFACE,
            border: `1.5px solid ${K.BORDER}`,
            borderRadius: 16,
            padding: 28,
            boxShadow: K.SHADOW_CARD,
          }}
        >
          {/* Step 1: Info */}
          {currentStep === 1 && (
            <div className="space-y-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
                  <Info className="h-5 w-5" style={{ color: K.PRIMARY }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Eğitim Bilgileri</h3>
                  <p className="text-xs" style={{ color: K.TEXT_MUTED }}>Temel bilgileri doldurun</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>Eğitim Adı *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="örn. Enfeksiyon Kontrol Eğitimi"
                    className="mt-2 h-12 text-base"
                    style={{ background: K.BG, borderColor: K.BORDER, borderRadius: 10 }}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>Kategori *</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setSelectedCategory(cat.value)}
                        className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all duration-200"
                        style={{
                          borderColor: selectedCategory === cat.value ? K.PRIMARY : K.BORDER,
                          background: selectedCategory === cat.value ? K.PRIMARY_LIGHT : K.BG,
                          boxShadow: selectedCategory === cat.value ? '0 2px 8px rgba(13, 150, 104, 0.18)' : 'none',
                        }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            background: selectedCategory === cat.value
                              ? K.PRIMARY
                              : `color-mix(in srgb, ${'color' in cat ? cat.color : K.PRIMARY} 10%, transparent)`,
                          }}
                        >
                          <CategoryIcon
                            name={cat.icon}
                            className="h-4 w-4"
                            style={{
                              color: selectedCategory === cat.value
                                ? '#fff'
                                : ('color' in cat ? cat.color : K.TEXT_MUTED),
                            }}
                          />
                        </div>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: selectedCategory === cat.value ? K.PRIMARY : K.TEXT_SECONDARY }}
                        >
                          {cat.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>Açıklama</Label>
                  <div className="mt-2">
                    <RichTextEditor
                      value={description}
                      onChange={setDescription}
                      placeholder="Eğitim hakkında açıklama yazın..."
                      minHeight={100}
                    />
                  </div>
                </div>

                <div
                  className="rounded-xl p-5"
                  style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
                >
                  <p className="text-sm font-semibold mb-4" style={{ color: K.TEXT_PRIMARY }}>Eğitim Tarihleri</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="h-3.5 w-3.5" style={{ color: K.INFO }} />
                        <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Başlangıç</Label>
                      </div>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="h-3.5 w-3.5" style={{ color: K.ERROR }} />
                        <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Bitiş</Label>
                      </div>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-xl p-5"
                  style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
                >
                  <p className="text-sm font-semibold mb-1" style={{ color: K.TEXT_PRIMARY }}>Sınav Ayarları</p>
                  <p className="text-[11px] mb-4" style={{ color: K.TEXT_MUTED }}>Baraj puanı &quot;Sınav Soruları&quot; adımında belirlenir — soru sayısına göre otomatik hesaplama yapılır.</p>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Award className="h-3.5 w-3.5" style={{ color: K.WARNING }} />
                        <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Deneme Hakkı</Label>
                      </div>
                      <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="h-3.5 w-3.5" style={{ color: K.PRIMARY_HOVER }} />
                        <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Süre (dk)</Label>
                      </div>
                      <Input type="number" value={examDurationMinutes} onChange={(e) => setExamDurationMinutes(Number(e.target.value))} className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Award className="h-3.5 w-3.5" style={{ color: K.SUCCESS }} />
                        <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>SMG Puanı</Label>
                      </div>
                      <Input type="number" min={0} max={999} value={smgPoints} onChange={(e) => setSmgPoints(Number(e.target.value))} className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
                      <p className="text-[10px] mt-1" style={{ color: K.TEXT_MUTED }}>Eğitim geçilince staff&apos;a yazılacak SMG puanı</p>
                    </div>
                  </div>
                </div>

                {/* Compliance / Uyum Ayarları */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: isCompulsory ? K.WARNING_BG : K.BG, border: `1px solid ${isCompulsory ? K.WARNING : K.BORDER}`, transition: 'all 150ms ease' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" style={{ color: isCompulsory ? K.WARNING : K.TEXT_MUTED }} />
                      <p className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Zorunlu Eğitim (Uyum)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCompulsory(v => !v)}
                      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent"
                      style={{
                        background: isCompulsory ? K.WARNING : K.BORDER,
                        transition: 'background 150ms ease',
                      }}
                    >
                      <span
                        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow"
                        style={{
                          transform: isCompulsory ? 'translateX(20px)' : 'translateX(0)',
                          transition: 'transform 150ms ease',
                        }}
                      />
                    </button>
                  </div>
                  {isCompulsory && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Calendar className="h-3.5 w-3.5" style={{ color: K.WARNING }} />
                          <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Uyum Son Tarihi</Label>
                        </div>
                        <Input
                          type="date"
                          value={complianceDeadline}
                          onChange={(e) => setComplianceDeadline(e.target.value)}
                          className="h-10"
                          style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Building2 className="h-3.5 w-3.5" style={{ color: K.WARNING }} />
                          <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Düzenleyici Kurum</Label>
                        </div>
                        <Input
                          value={regulatoryBody}
                          onChange={(e) => setRegulatoryBody(e.target.value)}
                          placeholder="örn. Sağlık Bakanlığı, JCI"
                          className="h-10"
                          style={{ background: K.SURFACE, borderColor: K.BORDER, borderRadius: 10 }}
                        />
                      </div>
                    </div>
                  )}
                  {!isCompulsory && (
                    <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
                      Bu eğitim zorunlu değil. Zorunlu olarak işaretlerseniz uyum takibi yapılır.
                    </p>
                  )}
                </div>

                {/* Sertifika Geçerliliği — zorunlu eğitimden bağımsız, her eğitim için geçerli */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <RefreshCw className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />
                    <p className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Sertifika Geçerliliği</p>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs font-medium mb-2 block" style={{ color: K.TEXT_MUTED }}>Sertifika Yenileme Süresi (Ay)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={120}
                        value={renewalPeriodMonths}
                        onChange={(e) => setRenewalPeriodMonths(e.target.value ? Number(e.target.value) : '')}
                        placeholder="örn. 12 (boş = süresiz)"
                        className="h-10"
                        style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }}
                      />
                      <p className="text-xs mt-1.5" style={{ color: K.TEXT_MUTED }}>
                        Sertifika bu süre sonunda yenilenmelidir. Boş bırakılırsa süresiz geçerli olur.
                      </p>
                    </div>
                    {isCompulsory && renewalPeriodMonths === '' && (
                      <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: K.WARNING_BG, border: `1.5px solid ${K.WARNING}` }}>
                        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" style={{ color: K.WARNING }} />
                        <p className="text-xs" style={{ color: K.TEXT_PRIMARY }}>
                          Zorunlu eğitimler için İSG/KVKK denetim gerekliliklerine göre yenileme süresi tanımlanması önerilir.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Content (Video + PDF + Audio) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
                  <Layers className="h-5 w-5" style={{ color: K.PRIMARY }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Eğitim İçerikleri</h3>
                  <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
                    {videos.filter(v => v.contentType === 'video').length} video, {videos.filter(v => v.contentType === 'audio').length} ses, {videos.filter(v => v.contentType === 'pdf').length} doküman eklendi
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                {/* Hidden file inputs */}
                <input
                  ref={docFileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const newId = Date.now();
                      setVideos(prev => [...prev, { id: newId, title: file.name.replace(/\.[^.]+$/, ''), url: '', contentType: 'pdf' as const }]);
                      setTimeout(() => uploadFileToS3(newId, file), 0);
                    }
                    e.target.value = '';
                  }}
                />
                <input
                  ref={mediaFileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,.mp3,.wav,.m4a,.ogg,.aac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/aac"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const isAudio = file.type.startsWith('audio/');
                      const newId = Date.now();
                      setVideos(prev => [...prev, { id: newId, title: file.name.replace(/\.[^.]+$/, ''), url: '', contentType: isAudio ? 'audio' as const : 'video' as const }]);
                      setTimeout(() => uploadFileToS3(newId, file), 0);
                    }
                    e.target.value = '';
                  }}
                />

                <Button
                  onClick={() => docFileInputRef.current?.click()}
                  variant="outline"
                  className="gap-2 font-semibold rounded-xl"
                  style={{ borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
                >
                  <FileText className="h-4 w-4" />
                  Doküman Yükle
                </Button>
                <Button
                  onClick={() => mediaFileInputRef.current?.click()}
                  variant="outline"
                  className="gap-2 font-semibold rounded-xl"
                  style={{ borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
                >
                  <Upload className="h-4 w-4" />
                  Video/Ses Yükle
                </Button>
                <Button
                  onClick={() => setLibraryModalOpen(true)}
                  className="gap-2 font-semibold text-white rounded-xl"
                  style={{ background: K.PRIMARY }}
                >
                  <Library className="h-4 w-4" />
                  Kütüphaneden Seç
                </Button>
              </div>

              {/* Content list — filtered by active tab */}
              <div className="space-y-4">
                {videos.map((video, idx) => (
                  <div
                    key={video.id}
                    className="rounded-xl border group"
                    style={{
                      borderColor: K.BORDER,
                      background: K.BG,
                      transition: 'border-color 150ms ease',
                    }}
                  >
                    {/* Content header */}
                    <div className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: `1.5px solid ${K.BORDER}` }}>
                      <GripVertical className="h-5 w-5 shrink-0 cursor-grab" style={{ color: K.TEXT_MUTED }} />
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                        style={{ background: video.contentType === 'audio' ? K.WARNING : K.PRIMARY, color: 'white' }}
                      >
                        {video.contentType === 'audio' ? <Music className="h-4 w-4" /> : idx + 1}
                      </div>
                      <Input
                        placeholder={video.contentType === 'audio' ? 'Ses başlığı girin...' : 'Video başlığı girin...'}
                        value={video.title}
                        onChange={(e) => setVideos(prev => prev.map(v => v.id === video.id ? { ...v, title: e.target.value } : v))}
                        className="flex-1 h-9 border-0 bg-transparent text-sm font-medium focus-visible:ring-0 px-0"
                        style={{ color: K.TEXT_PRIMARY }}
                      />
                      <div className="flex items-center gap-2">
                        {video.contentType === 'audio' && video.durationSeconds ? (
                          <span className="text-xs px-2 py-1 rounded-md" style={{ background: '#fef3c7', color: K.WARNING, fontFamily: K.FONT_MONO }}>
                            {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')} dk
                          </span>
                        ) : null}
                        {videos.length > 0 && (
                          <button
                            onClick={() => removeVideo(video.id)}
                            className="rounded-lg p-2 opacity-0 group-hover:opacity-100"
                            style={{ color: K.ERROR, transition: 'opacity 150ms ease' }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Kütüphaneden seçilmiş içerik göstergesi */}
                    {video.url && !video.file && (
                      <div
                        className="flex items-center gap-4 px-5 py-4"
                        style={{ background: K.SUCCESS_BG }}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: K.PRIMARY_LIGHT }}>
                          <Library className="h-4.5 w-4.5" style={{ color: K.PRIMARY }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: K.SUCCESS }}>
                            Kütüphaneden eklendi
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                            {video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')} dk` : video.contentType === 'pdf' ? 'Doküman' : video.contentType === 'audio' ? 'Ses dosyası' : 'Video'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="rounded-lg text-xs gap-1.5"
                          style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                          onClick={() => setVideos(prev => prev.map(v => v.id === video.id ? { ...v, url: '', file: undefined } : v))}
                        >
                          Değiştir
                        </Button>
                      </div>
                    )}

                    {/* Upload area — video/pdf */}
                    {video.contentType !== 'audio' && !(video.url && !video.file) && (
                    <div
                      className="flex items-center gap-4 px-5 py-5 relative"
                      style={{ background: K.SURFACE }}
                    >
                      <input
                        type="file"
                        accept={video.contentType === 'pdf' ? 'application/pdf' : 'video/mp4,video/webm,application/pdf'}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadFileToS3(video.id, file);
                          }
                        }}
                      />
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: video.file ? K.SUCCESS_BG : K.PRIMARY_LIGHT }}
                      >
                        {video.file ? (
                          video.contentType === 'pdf' ? (
                            <FileText className="h-5 w-5" style={{ color: K.SUCCESS }} />
                          ) : (
                            <Video className="h-5 w-5" style={{ color: K.SUCCESS }} />
                          )
                        ) : (
                          <Upload className="h-5 w-5" style={{ color: K.PRIMARY }} />
                        )}
                      </div>
                      <div className="flex-1">
                        {video.file ? (
                          <>
                            <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                              {video.file.name}
                            </p>
                            {uploadProgress[video.id] !== undefined ? (
                              <div className="mt-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: K.BORDER }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${uploadProgress[video.id]}%`,
                                        background: K.PRIMARY,
                                        transition: 'width 0.2s ease',
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold shrink-0" style={{ fontFamily: K.FONT_MONO, color: K.PRIMARY, minWidth: 36, textAlign: 'right' }}>
                                    {uploadProgress[video.id]}%
                                  </span>
                                </div>
                                <p className="text-[10px] mt-1" style={{ color: K.TEXT_MUTED }}>
                                  {(video.file.size / (1024 * 1024)).toFixed(1)} MB • {uploadProgress[video.id] < 80 ? 'Dosya gönderiliyor...' : uploadProgress[video.id] < 100 ? 'S3\'e yükleniyor...' : 'Tamamlandı!'}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs mt-0.5" style={{ color: video.url ? K.SUCCESS : K.TEXT_MUTED }}>
                                {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                                {video.contentType === 'pdf' && video.pageCount ? ` • ${video.pageCount} sayfa` : ''}
                                {video.url ? ' • Yüklendi ✓' : ''}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                              Dosyayı sürükleyin veya tıklayıp seçin
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                              {video.contentType === 'pdf' ? 'PDF — Maks. 100MB' : 'Video (MP4, WebM — Maks. 500MB) veya PDF (Maks. 100MB)'}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant={video.file ? 'default' : 'outline'}
                          size="sm"
                          type="button"
                          className="rounded-lg text-xs gap-1.5 pointer-events-none"
                          style={video.file ? { background: K.BG_SOFT, color: K.TEXT_PRIMARY } : { borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                        >
                          {video.file ? <Check className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                          {video.file ? 'Değiştir' : 'Dosya Seç'}
                        </Button>
                        {!video.file && (
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="rounded-lg text-xs gap-1.5 relative z-10"
                            style={{ color: K.PRIMARY }}
                            onClick={(e) => { e.stopPropagation(); setLibraryModalOpen(true); }}
                          >
                            <Library className="h-3.5 w-3.5" />
                            Kütüphane
                          </Button>
                        )}
                      </div>
                    </div>
                    )}

                    {/* Upload area — audio + optional document */}
                    {video.contentType === 'audio' && !(video.url && !video.file) && (
                    <div className="divide-y" style={{ borderColor: K.BORDER }}>
                      {/* Audio upload */}
                      <div
                        className="flex items-center gap-4 px-5 py-5 relative"
                        style={{ background: K.SURFACE }}
                      >
                        <input
                          type="file"
                          accept=".mp3,.wav,.m4a,.ogg,.aac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/aac"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              uploadFileToS3(video.id, file);
                            }
                          }}
                        />
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: video.file ? K.SUCCESS_BG : '#fef3c7' }}
                        >
                          {video.file ? (
                            <Music className="h-5 w-5" style={{ color: K.SUCCESS }} />
                          ) : (
                            <Music className="h-5 w-5" style={{ color: K.WARNING }} />
                          )}
                        </div>
                        <div className="flex-1">
                          {video.file ? (
                            <>
                              <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                                {video.file.name}
                              </p>
                              {uploadProgress[video.id] !== undefined ? (
                                <div className="mt-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: K.BORDER }}>
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${uploadProgress[video.id]}%`,
                                          background: K.WARNING,
                                          transition: 'width 0.2s ease',
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold shrink-0" style={{ fontFamily: K.FONT_MONO, color: K.WARNING, minWidth: 36, textAlign: 'right' }}>
                                      {uploadProgress[video.id]}%
                                    </span>
                                  </div>
                                  <p className="text-[10px] mt-1" style={{ color: K.TEXT_MUTED }}>
                                    {(video.file.size / (1024 * 1024)).toFixed(1)} MB • {uploadProgress[video.id] < 80 ? 'Dosya gönderiliyor...' : uploadProgress[video.id] < 100 ? 'S3\'e yükleniyor...' : 'Tamamlandı!'}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs mt-0.5" style={{ color: video.url ? K.SUCCESS : K.TEXT_MUTED }}>
                                  Ses · {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                                  {video.durationSeconds ? ` · ${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')} dk` : ''}
                                  {video.url ? ' · Yüklendi ✓' : ''}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>
                                Ses dosyasını sürükleyin veya tıklayıp seçin
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: K.TEXT_MUTED }}>
                                MP3, WAV, M4A, OGG, AAC — Maks. 200MB
                              </p>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant={video.file ? 'default' : 'outline'}
                            size="sm"
                            type="button"
                            className="rounded-lg text-xs gap-1.5 pointer-events-none"
                            style={video.file ? { background: K.BG_SOFT, color: K.TEXT_PRIMARY } : { borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                          >
                            {video.file ? <Check className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}
                            {video.file ? 'Değiştir' : 'Ses Seç'}
                          </Button>
                          {!video.file && (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              className="rounded-lg text-xs gap-1.5 relative z-10"
                              style={{ color: K.PRIMARY }}
                              onClick={(e) => { e.stopPropagation(); setLibraryModalOpen(true); }}
                            >
                              <Library className="h-3.5 w-3.5" />
                              Kütüphane
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Optional document upload for audio */}
                      <div
                        className="flex items-center gap-4 px-5 py-4 relative"
                        style={{ background: K.BG }}
                      >
                        <input
                          type="file"
                          accept="application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 100 * 1024 * 1024) {
                                toast('Doküman boyutu 100MB sınırını aşıyor', 'error');
                                return;
                              }
                              setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: file, documentKey: '', documentUploading: true } : v));

                              // Presigned URL ile client-side S3 upload
                              try {
                                const presignRes = await fetch('/api/upload/presign', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ fileName: file.name, contentType: file.type }),
                                });
                                if (!presignRes.ok) {
                                  const err = await presignRes.json();
                                  toast(err.error || 'Yükleme URL alınamadı', 'error');
                                  setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: undefined, documentKey: undefined, documentUploading: false } : v));
                                  return;
                                }
                                const { uploadUrl, key } = await presignRes.json();
                                const uploadRes = await fetch(uploadUrl, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': file.type },
                                  body: file,
                                });
                                if (uploadRes.ok) {
                                  setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentKey: key, documentUploading: false } : v));
                                  toast('Doküman yüklendi', 'success');
                                } else {
                                  toast('Doküman yüklenemedi', 'error');
                                  setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: undefined, documentKey: undefined, documentUploading: false } : v));
                                }
                              } catch {
                                toast('Doküman yüklenemedi — bağlantı hatası', 'error');
                                setVideos(prev => prev.map(v => v.id === video.id ? { ...v, documentFile: undefined, documentKey: undefined, documentUploading: false } : v));
                              }
                            }
                          }}
                        />
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                          style={{ background: video.documentFile ? K.SUCCESS_BG : K.BG_SOFT }}
                        >
                          <FileText className="h-4 w-4" style={{ color: video.documentFile ? K.SUCCESS : K.TEXT_MUTED }} />
                        </div>
                        <div className="flex-1">
                          {video.documentFile ? (
                            <p className="text-sm" style={{ color: video.documentKey ? K.SUCCESS : K.TEXT_PRIMARY }}>
                              {video.documentFile.name}
                              {video.documentUploading ? ' — Yükleniyor...' : video.documentKey ? ' ✓' : ''}
                            </p>
                          ) : (
                            <>
                              <p className="text-sm" style={{ color: K.TEXT_SECONDARY }}>
                                Eşlik eden doküman ekle (opsiyonel)
                              </p>
                              <p className="text-[11px] mt-0.5" style={{ color: K.TEXT_MUTED }}>
                                PDF veya PPTX — Maks. 100MB
                              </p>
                            </>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="rounded-lg text-xs gap-1.5 pointer-events-none"
                          style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          {video.documentFile ? 'Değiştir' : 'Doküman Seç'}
                        </Button>
                      </div>
                    </div>
                    )}
                  </div>
                ))}
                {videos.length === 0 && (
                  <div
                    className="flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed"
                    style={{ borderColor: K.BORDER, background: K.SURFACE }}
                  >
                    <Layers className="h-10 w-10 mb-3" style={{ color: K.TEXT_MUTED, opacity: 0.5 }} />
                    <p className="text-sm font-medium" style={{ color: K.TEXT_MUTED }}>
                      Henüz içerik eklenmedi
                    </p>
                    <p className="text-xs mt-1" style={{ color: K.TEXT_MUTED, opacity: 0.7 }}>
                      Doküman, video veya ses yükleyin ya da kütüphaneden seçin
                    </p>
                  </div>
                )}
              </div>

              {/* Content Library Modal */}
              <ContentLibraryModal
                open={libraryModalOpen}
                onClose={() => setLibraryModalOpen(false)}
                onSelect={addFromLibrary}
                defaultFilter="all"
              />
            </div>
          )}

          {/* Step 3: Questions */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: '#fef3c7' }}>
                    <FileQuestion className="h-5 w-5" style={{ color: K.WARNING }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Sınav Soruları</h3>
                    <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
                      {questions.length} soru • Her soru eşit puan değerinde (otomatik dağıtılır — toplam 100)
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={addQuestion}
                    className="gap-2 font-semibold text-white rounded-xl"
                    style={{ background: K.WARNING, transition: 'opacity 150ms ease' }}
                  >
                    <Plus className="h-4 w-4" /> Soru Ekle
                  </Button>
                </div>
              </div>

              {/* Baraj Puanı — soru sayısına göre canlı hesaplama */}
              <div
                className="rounded-xl p-5"
                style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <Target className="h-4 w-4" style={{ color: K.PRIMARY }} />
                  <Label className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Baraj Puanı</Label>
                  <span className="text-[11px]" style={{ color: K.TEXT_MUTED }}>(100 üzerinden)</span>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr] sm:items-center">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={passingScore}
                    onChange={(e) => setPassingScore(Number(e.target.value))}
                    className="h-11 text-center text-base font-bold"
                    style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }}
                  />
                  <div
                    className="rounded-lg px-4 py-3 text-sm"
                    style={{
                      background: K.PRIMARY_LIGHT,
                      color: K.PRIMARY_HOVER,
                      border: `1.5px dashed ${K.PRIMARY}`,
                    }}
                  >
                    {questions.length > 0 && passingScore > 0 ? (
                      <>
                        Personel barajı geçmek için{' '}
                        <strong style={{ color: K.PRIMARY }}>{questions.length}</strong> sorudan en az{' '}
                        <strong style={{ color: K.PRIMARY, fontSize: '1.05em' }}>
                          {minCorrectForPassing(passingScore, questions.length)}
                        </strong>{' '}
                        tanesini doğru cevaplamalı.
                      </>
                    ) : (
                      <span style={{ color: K.TEXT_MUTED }}>
                        Soru ekledikçe ve baraj puanı girdikçe burada kaç doğru gerektiği gösterilecek.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border"
                    style={{ borderColor: K.BORDER, background: K.BG }}
                  >
                    {/* Question header */}
                    <div
                      className="flex items-center gap-3 px-5 py-3.5"
                      style={{ borderBottom: `1.5px solid ${K.BORDER}`, background: K.SURFACE }}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{ background: K.WARNING }}
                      >
                        {qIdx + 1}
                      </div>
                      <Input
                        value={q.text}
                        onChange={(e) => setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, text: e.target.value } : pq))}
                        placeholder="Soruyu yazın..."
                        className="flex-1 h-9 border-0 bg-transparent text-sm font-medium focus-visible:ring-0 px-0"
                        style={{ color: K.TEXT_PRIMARY }}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: '#fef3c7',
                            color: K.WARNING,
                            fontFamily: K.FONT_MONO,
                          }}
                          title="Puan otomatik hesaplanır — 100 / soru sayısı"
                        >
                          {distributePoints(questions.length)[qIdx] ?? 0} puan
                        </span>
                        <button
                          onClick={() => removeQuestion(q.id)}
                          className="rounded-lg p-1.5"
                          style={{ color: K.ERROR, transition: 'opacity 150ms ease' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Options */}
                    <div className="p-5 space-y-2.5">
                      {['A', 'B', 'C', 'D'].map((opt, optIdx) => (
                        <label
                          key={opt}
                          className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
                          style={{
                            border: `1.5px solid ${q.correct === optIdx ? K.SUCCESS : K.BORDER}`,
                            background: q.correct === optIdx ? K.SUCCESS_BG : K.SURFACE,
                            transition: 'border-color 150ms ease, background 150ms ease',
                          }}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="h-4 w-4"
                            style={{ accentColor: K.SUCCESS }}
                            checked={q.correct === optIdx}
                            onChange={() => {
                              setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, correct: optIdx } : pq));
                            }}
                          />
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold"
                            style={{
                              background: q.correct === optIdx ? K.SUCCESS : K.BG_SOFT,
                              color: q.correct === optIdx ? 'white' : K.TEXT_MUTED,
                            }}
                          >
                            {opt}
                          </span>
                          <Input
                            value={q.options[optIdx]}
                            onChange={(e) => setQuestions(prev => prev.map(pq => {
                              if (pq.id === q.id) {
                                const newOptions = [...pq.options];
                                newOptions[optIdx] = e.target.value;
                                return { ...pq, options: newOptions };
                              }
                              return pq;
                            }))}
                            placeholder={`Şık ${opt}`}
                            className="flex-1 h-8 border-0 bg-transparent text-sm focus-visible:ring-0 px-0"
                            style={{ color: K.TEXT_PRIMARY }}
                          />
                        </label>
                      ))}
                      <p className="text-[11px] pl-1" style={{ color: K.TEXT_MUTED }}>
                        <CheckCircle2 className="h-3 w-3 inline mr-1" style={{ color: K.SUCCESS }} />
                        Doğru cevabı seçmek için tıklayın
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Assignment */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.INFO_BG }}>
                  <Users className="h-5 w-5" style={{ color: K.INFO }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Personel Atama</h3>
                  <p className="text-xs" style={{ color: K.TEXT_MUTED }}>Eğitimi atamak istediğiniz departmanları seçin</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Input
                  placeholder="Departman veya personel ara..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="max-w-sm h-11"
                  style={{ background: K.BG, borderColor: K.BORDER, borderRadius: 10 }}
                />
                <Button
                  variant="outline"
                  onClick={() => setSelectedDepts(selectedDepts.length === departments.length ? [] : departments.map(d => d.id))}
                  className="h-11 rounded-xl"
                  style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
                >
                  {selectedDepts.length === departments.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {departments.filter(dept => {
                  const q = deptSearch.trim().toLocaleLowerCase('tr-TR');
                  if (!q) return true;
                  if (dept.name.toLocaleLowerCase('tr-TR').includes(q)) return true;
                  return dept.staff.some(s => s.name.toLocaleLowerCase('tr-TR').includes(q));
                }).map((dept) => {
                  const isSelected = selectedDepts.includes(dept.id);
                  const activeStaff = dept.staff.filter(s => !excludedStaff.includes(s.id));
                  const isExpanded = expandedDept === dept.id;
                  return (
                    <div key={dept.id} className="relative">
                      <button
                        type="button"
                        onClick={() => toggleDept(dept.id)}
                        className="relative flex w-full flex-col items-start gap-2 rounded-xl border p-4 text-left"
                        style={{
                          borderColor: isSelected ? dept.color : K.BORDER,
                          background: isSelected ? K.BG : K.SURFACE,
                          transition: 'border-color 150ms ease, background 150ms ease',
                        }}
                      >
                        {isSelected && (
                          <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: dept.color }}>
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: dept.color }}>
                          {dept.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{dept.name}</p>
                          <p className="text-xs font-mono" style={{ color: K.TEXT_MUTED }}>
                            {isSelected ? `${activeStaff.length}/${dept.staff.length}` : `${dept.staff.length}`} kişi
                          </p>
                        </div>
                      </button>
                      {isSelected && (
                        <button
                          type="button"
                          onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors duration-150"
                          style={{ color: dept.color, background: isExpanded ? `${dept.color}10` : 'transparent' }}
                        >
                          {isExpanded ? 'Gizle' : 'Kişileri Gör'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Expanded Staff List */}
              {expandedDept && selectedDepts.includes(expandedDept) && (() => {
                const dept = departments.find(d => d.id === expandedDept);
                if (!dept) return null;
                return (
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: dept.color, background: K.SURFACE }}
                  >
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: `${dept.color}10`, borderBottom: `1px solid ${dept.color}30` }}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: dept.color }} />
                        <span className="text-sm font-bold">{dept.name}</span>
                        <span className="text-xs font-mono" style={{ color: K.TEXT_MUTED }}>
                          {dept.staff.filter(s => !excludedStaff.includes(s.id)).length}/{dept.staff.length} kişi seçili
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedDept(null)}
                        className="text-xs font-medium px-2 py-1 rounded-md"
                        style={{ color: K.TEXT_MUTED }}
                      >
                        Kapat
                      </button>
                    </div>
                    <div className="divide-y" style={{ borderColor: K.BORDER }}>
                      {dept.staff.map((staff) => {
                        const isExcluded = excludedStaff.includes(staff.id);
                        return (
                          <div
                            key={staff.id}
                            className="flex items-center justify-between px-4 py-2.5 transition-colors duration-100"
                            style={{ background: isExcluded ? K.ERROR_BG : 'transparent' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ background: isExcluded ? K.TEXT_MUTED : dept.color, opacity: isExcluded ? 0.5 : 1 }}
                              >
                                {staff.initials}
                              </div>
                              <div>
                                <p className="text-sm font-medium" style={{ textDecoration: isExcluded ? 'line-through' : 'none', opacity: isExcluded ? 0.5 : 1 }}>{staff.name}</p>
                                <p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>{staff.title}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleStaffExclusion(staff.id)}
                              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150"
                              style={{
                                background: isExcluded ? K.SUCCESS_BG : K.ERROR_BG,
                                color: isExcluded ? K.SUCCESS : K.ERROR,
                              }}
                            >
                              {isExcluded ? (
                                <><Check className="h-3 w-3" /> Dahil Et</>
                              ) : (
                                <><Trash2 className="h-3 w-3" /> Çıkar</>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Summary */}
              <div
                className="flex items-center justify-between rounded-xl px-5 py-4"
                style={{
                  background: totalSelectedStaff > 0 ? K.PRIMARY : K.BG,
                  border: totalSelectedStaff > 0 ? 'none' : `1.5px solid ${K.BORDER}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5" style={{ color: totalSelectedStaff > 0 ? 'rgba(255,255,255,0.7)' : K.TEXT_MUTED }} />
                  <span className="text-sm font-medium" style={{ color: totalSelectedStaff > 0 ? 'white' : K.TEXT_SECONDARY }}>
                    Seçili personel sayısı
                  </span>
                </div>
                <span
                  className="text-lg font-bold"
                  style={{ fontFamily: K.FONT_MONO, color: totalSelectedStaff > 0 ? 'white' : K.TEXT_MUTED }}
                >
                  {totalSelectedStaff}
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div
        className="flex justify-between items-center rounded-2xl px-6 py-4"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          boxShadow: K.SHADOW_CARD,
        }}
      >
        <Button
          variant="outline"
          onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back())}
          className="gap-2 h-11 rounded-xl"
          style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
        >
          <ArrowLeft className="h-4 w-4" />
          {currentStep === 1 ? 'İptal' : 'Önceki Adım'}
        </Button>

        <div className="flex items-center gap-1.5">
          {steps.map((step) => (
            <div
              key={step.id}
              className="h-1.5 rounded-full"
              style={{
                width: step.id === currentStep ? '24px' : '8px',
                background: step.id <= currentStep ? K.PRIMARY : K.BORDER,
                transition: 'width 150ms ease, background 150ms ease',
              }}
            />
          ))}
        </div>

        {currentStep < 4 ? (
          <Button
            onClick={goToNextStep}
            className="gap-2 h-11 rounded-xl font-semibold text-white"
            style={{
              background: K.PRIMARY,
              boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
              transition: 'opacity 150ms ease',
            }}
          >
            Sonraki Adım <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={publishing}
            onClick={async () => {
              for (const step of [1, 2, 3]) {
                const err = validateStep(step);
                if (err) {
                  toast(`Adım ${step}: ${err}`, 'error');
                  setCurrentStep(step);
                  return;
                }
              }
              setPublishing(true);
              try {
                const res = await fetch('/api/admin/trainings', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      title,
                      description,
                      category: selectedCategory,
                      passingScore: Number(passingScore) || 70,
                      maxAttempts: Number(maxAttempts) || 3,
                      examDurationMinutes: Number(examDurationMinutes) || 30,
                      smgPoints: Math.max(0, Math.min(999, Number(smgPoints) || 0)),
                      startDate: new Date(startDate).toISOString(),
                      endDate: new Date(endDate).toISOString(),
                      isCompulsory,
                      complianceDeadline: isCompulsory && complianceDeadline ? new Date(complianceDeadline).toISOString() : null,
                      regulatoryBody: isCompulsory && regulatoryBody ? regulatoryBody : null,
                      renewalPeriodMonths: renewalPeriodMonths !== '' ? Number(renewalPeriodMonths) : null,
                      videos: videos.filter(v => v.url).map(v => ({ title: v.title || v.file?.name || (v.contentType === 'audio' ? 'Ses' : v.contentType === 'pdf' ? 'Doküman' : 'Video'), url: v.url, contentType: v.contentType, pageCount: v.pageCount, durationSeconds: v.durationSeconds, documentKey: v.documentKey })),
                      // Puanlar otomatik dağıtılır: her soru 100/N, son soru yuvarlama artığını alır → toplam her zaman 100
                      questions: (() => {
                        const dist = distributePoints(questions.length);
                        return questions.map((q, i) => ({ ...q, points: dist[i] }));
                      })(),
                      selectedDepts,
                      excludedStaff,
                    }),
                  });
                  if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    if (body.error && typeof body.error === 'string') {
                      // Attempt to safely display zod validation errors if they look like JSON
                      try {
                        const parsedErrors = JSON.parse(body.error);
                        if (Array.isArray(parsedErrors)) {
                          throw new Error(`Eksik alan: ${parsedErrors.map((e: { path: string[] }) => e.path.join('.')).join(', ')}`);
                        }
                      } catch { } // ignore JSON error if it wasn't valid 
                    }
                    throw new Error(body.error || 'Eğitim oluşturulamadı');
                  }
                  toast('Eğitim başarıyla yayınlandı!', 'success');
                  router.push('/admin/trainings');
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
                setPublishing(false);
              }
            }}
            className="gap-2 h-11 rounded-xl font-semibold text-white"
            style={{
              background: K.PRIMARY,
              boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
              transition: 'opacity 150ms ease',
            }}
          >
            <Sparkles className="h-4 w-4" /> Eğitimi Yayınla
          </Button>
        )}
      </div>

      </div>
    </div>
  );
}
