'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Info, Video, FileQuestion, Users, Check, Plus, Trash2,
  GripVertical, Upload, Clock, Award, Calendar, Target, Sparkles, BookOpen, CheckCircle2,
  ShieldCheck, RefreshCw, Building2, FileText, Layers, Music, ChevronDown, Library
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import dynamic from 'next/dynamic';
const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then(m => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => <div className="animate-pulse rounded-lg border h-28" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />,
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
              transition: 'border-color var(--transition-fast)',
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Yeni Eğitim Oluştur
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              4 adımda eğitiminizi tamamlayın
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <BookOpen className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            <span style={{ color: 'var(--color-text-secondary)' }}>Taslak</span>
          </div>
        </div>
      </div>

      {/* Premium Step Indicator */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            return (
              <div key={step.id} className="flex flex-1 items-center gap-2">
                <button
                  onClick={() => step.id <= currentStep && setCurrentStep(step.id)}
                  className="flex flex-1 items-center gap-3 rounded-xl px-4 py-3"
                  style={{
                    background: isActive
                      ? 'linear-gradient(135deg, var(--color-primary), #0f4a35)'
                      : isCompleted
                      ? 'var(--color-success-bg)'
                      : 'transparent',
                    cursor: step.id <= currentStep ? 'pointer' : 'default',
                    transition: 'background var(--transition-fast), transform var(--transition-fast)',
                  }}
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: isActive
                        ? 'rgba(255,255,255,0.2)'
                        : isCompleted
                        ? 'var(--color-success)'
                        : 'var(--color-surface-hover)',
                    }}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <Icon className="h-4 w-4" style={{ color: isActive ? 'white' : 'var(--color-text-muted)' }} />
                    )}
                  </div>
                  <div className="text-left hidden lg:block">
                    <p
                      className="text-sm font-semibold"
                      style={{ color: isActive ? 'white' : isCompleted ? 'var(--color-success)' : 'var(--color-text-muted)' }}
                    >
                      {step.title}
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: isActive ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)' }}
                    >
                      {step.description}
                    </p>
                  </div>
                </button>
                {idx < steps.length - 1 && (
                  <div className="flex items-center">
                    <div
                      className="h-px w-6 shrink-0"
                      style={{ background: isCompleted ? 'var(--color-success)' : 'var(--color-border)' }}
                    />
                  </div>
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
          className="rounded-2xl border p-8"
          style={{
            background: 'var(--color-surface)',
            borderColor: 'var(--color-border)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Step 1: Info */}
          {currentStep === 1 && (
            <div className="space-y-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                  <Info className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Eğitim Bilgileri</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Temel bilgileri doldurun</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <Label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Eğitim Adı *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="örn. Enfeksiyon Kontrol Eğitimi"
                    className="mt-2 h-12 text-base"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Kategori *</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {categories.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setSelectedCategory(cat.value)}
                        className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-all duration-200"
                        style={{
                          borderColor: selectedCategory === cat.value ? 'var(--color-primary)' : 'var(--color-border)',
                          background: selectedCategory === cat.value ? 'var(--color-primary-light)' : 'var(--color-bg)',
                          boxShadow: selectedCategory === cat.value ? '0 2px 8px color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'none',
                        }}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                          style={{
                            background: selectedCategory === cat.value
                              ? 'var(--color-primary)'
                              : `color-mix(in srgb, ${'color' in cat ? cat.color : 'var(--color-primary)'} 10%, transparent)`,
                          }}
                        >
                          <CategoryIcon
                            name={cat.icon}
                            className="h-4 w-4"
                            style={{
                              color: selectedCategory === cat.value
                                ? '#fff'
                                : ('color' in cat ? cat.color : 'var(--color-text-muted)'),
                            }}
                          />
                        </div>
                        <span
                          className="text-sm font-semibold"
                          style={{ color: selectedCategory === cat.value ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                        >
                          {cat.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Açıklama</Label>
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
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Eğitim Tarihleri</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--color-info)' }} />
                        <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Başlangıç</Label>
                      </div>
                      <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--color-error)' }} />
                        <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Bitiş</Label>
                      </div>
                      <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }} />
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Sınav Ayarları</p>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Target className="h-3.5 w-3.5" style={{ color: 'var(--color-primary)' }} />
                        <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Baraj Puanı</Label>
                      </div>
                      <Input type="number" value={passingScore} onChange={(e) => setPassingScore(Number(e.target.value))} className="h-10" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Award className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
                        <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Deneme Hakkı</Label>
                      </div>
                      <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(Number(e.target.value))} className="h-10" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-primary-dark)' }} />
                        <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Süre (dk)</Label>
                      </div>
                      <Input type="number" value={examDurationMinutes} onChange={(e) => setExamDurationMinutes(Number(e.target.value))} className="h-10" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }} />
                    </div>
                  </div>
                </div>

                {/* Compliance / Uyum Ayarları */}
                <div
                  className="rounded-xl p-5"
                  style={{ background: isCompulsory ? 'var(--color-warning-bg, #fffbeb)' : 'var(--color-bg)', border: `1px solid ${isCompulsory ? 'var(--color-warning, #f59e0b)' : 'var(--color-border)'}`, transition: 'all var(--transition-fast)' }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4" style={{ color: isCompulsory ? 'var(--color-warning, #f59e0b)' : 'var(--color-text-muted)' }} />
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Zorunlu Eğitim (Uyum)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCompulsory(v => !v)}
                      className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent"
                      style={{
                        background: isCompulsory ? 'var(--color-warning, #f59e0b)' : 'var(--color-border)',
                        transition: 'background var(--transition-fast)',
                      }}
                    >
                      <span
                        className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow"
                        style={{
                          transform: isCompulsory ? 'translateX(20px)' : 'translateX(0)',
                          transition: 'transform var(--transition-fast)',
                        }}
                      />
                    </button>
                  </div>
                  {isCompulsory && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--color-warning, #f59e0b)' }} />
                          <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Uyum Son Tarihi</Label>
                        </div>
                        <Input
                          type="date"
                          value={complianceDeadline}
                          onChange={(e) => setComplianceDeadline(e.target.value)}
                          className="h-10"
                          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--color-warning, #f59e0b)' }} />
                          <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Düzenleyici Kurum</Label>
                        </div>
                        <Input
                          value={regulatoryBody}
                          onChange={(e) => setRegulatoryBody(e.target.value)}
                          placeholder="örn. Sağlık Bakanlığı, JCI"
                          className="h-10"
                          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 mb-2">
                          <RefreshCw className="h-3.5 w-3.5" style={{ color: 'var(--color-warning, #f59e0b)' }} />
                          <Label className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Yenileme (Ay)</Label>
                        </div>
                        <Input
                          type="number"
                          value={renewalPeriodMonths}
                          onChange={(e) => setRenewalPeriodMonths(e.target.value ? Number(e.target.value) : '')}
                          placeholder="örn. 12"
                          className="h-10"
                          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }}
                        />
                      </div>
                    </div>
                  )}
                  {!isCompulsory && (
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Bu eğitim zorunlu değil. Zorunlu olarak işaretlerseniz uyum takibi yapılır.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Content (Video + PDF + Audio) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                  <Layers className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Eğitim İçerikleri</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
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
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  <FileText className="h-4 w-4" />
                  Doküman Yükle
                </Button>
                <Button
                  onClick={() => mediaFileInputRef.current?.click()}
                  variant="outline"
                  className="gap-2 font-semibold rounded-xl"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  <Upload className="h-4 w-4" />
                  Video/Ses Yükle
                </Button>
                <Button
                  onClick={() => setLibraryModalOpen(true)}
                  className="gap-2 font-semibold text-white rounded-xl"
                  style={{ background: 'var(--color-primary)' }}
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
                      borderColor: 'var(--color-border)',
                      background: 'var(--color-bg)',
                      transition: 'border-color var(--transition-fast)',
                    }}
                  >
                    {/* Content header */}
                    <div className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <GripVertical className="h-5 w-5 shrink-0 cursor-grab" style={{ color: 'var(--color-text-muted)' }} />
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                        style={{ background: video.contentType === 'audio' ? 'var(--color-accent)' : 'var(--color-primary)', color: 'white' }}
                      >
                        {video.contentType === 'audio' ? <Music className="h-4 w-4" /> : idx + 1}
                      </div>
                      <Input
                        placeholder={video.contentType === 'audio' ? 'Ses başlığı girin...' : 'Video başlığı girin...'}
                        value={video.title}
                        onChange={(e) => setVideos(prev => prev.map(v => v.id === video.id ? { ...v, title: e.target.value } : v))}
                        className="flex-1 h-9 border-0 bg-transparent text-sm font-medium focus-visible:ring-0 px-0"
                        style={{ color: 'var(--color-text-primary)' }}
                      />
                      <div className="flex items-center gap-2">
                        {video.contentType === 'audio' && video.durationSeconds ? (
                          <span className="text-xs px-2 py-1 rounded-md" style={{ background: 'var(--color-accent-light)', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)' }}>
                            {Math.floor(video.durationSeconds / 60)}:{String(video.durationSeconds % 60).padStart(2, '0')} dk
                          </span>
                        ) : null}
                        {videos.length > 0 && (
                          <button
                            onClick={() => removeVideo(video.id)}
                            className="rounded-lg p-2 opacity-0 group-hover:opacity-100"
                            style={{ color: 'var(--color-error)', transition: 'opacity var(--transition-fast)' }}
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
                        style={{ background: 'var(--color-success-bg)' }}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                          <Library className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium" style={{ color: 'var(--color-success)' }}>
                            Kütüphaneden eklendi
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')} dk` : video.contentType === 'pdf' ? 'Doküman' : video.contentType === 'audio' ? 'Ses dosyası' : 'Video'}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          className="rounded-lg text-xs gap-1.5"
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
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
                      style={{ background: 'var(--color-surface)' }}
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
                        style={{ background: video.file ? 'var(--color-success-bg)' : 'var(--color-primary-light)' }}
                      >
                        {video.file ? (
                          video.contentType === 'pdf' ? (
                            <FileText className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                          ) : (
                            <Video className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                          )
                        ) : (
                          <Upload className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                        )}
                      </div>
                      <div className="flex-1">
                        {video.file ? (
                          <>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                              {video.file.name}
                            </p>
                            {uploadProgress[video.id] !== undefined ? (
                              <div className="mt-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                                    <div
                                      className="h-full rounded-full"
                                      style={{
                                        width: `${uploadProgress[video.id]}%`,
                                        background: 'var(--color-primary)',
                                        transition: 'width 0.2s ease',
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)', minWidth: 36, textAlign: 'right' }}>
                                    {uploadProgress[video.id]}%
                                  </span>
                                </div>
                                <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                  {(video.file.size / (1024 * 1024)).toFixed(1)} MB • {uploadProgress[video.id] < 80 ? 'Dosya gönderiliyor...' : uploadProgress[video.id] < 100 ? 'S3\'e yükleniyor...' : 'Tamamlandı!'}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs mt-0.5" style={{ color: video.url ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                                {video.contentType === 'pdf' && video.pageCount ? ` • ${video.pageCount} sayfa` : ''}
                                {video.url ? ' • Yüklendi ✓' : ''}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                              Dosyayı sürükleyin veya tıklayıp seçin
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
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
                          style={video.file ? { background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
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
                            style={{ color: 'var(--color-primary)' }}
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
                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {/* Audio upload */}
                      <div
                        className="flex items-center gap-4 px-5 py-5 relative"
                        style={{ background: 'var(--color-surface)' }}
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
                          style={{ background: video.file ? 'var(--color-success-bg)' : 'var(--color-accent-light)' }}
                        >
                          {video.file ? (
                            <Music className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                          ) : (
                            <Music className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                          )}
                        </div>
                        <div className="flex-1">
                          {video.file ? (
                            <>
                              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                {video.file.name}
                              </p>
                              {uploadProgress[video.id] !== undefined ? (
                                <div className="mt-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${uploadProgress[video.id]}%`,
                                          background: 'var(--color-accent)',
                                          transition: 'width 0.2s ease',
                                        }}
                                      />
                                    </div>
                                    <span className="text-xs font-bold shrink-0" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', minWidth: 36, textAlign: 'right' }}>
                                      {uploadProgress[video.id]}%
                                    </span>
                                  </div>
                                  <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                                    {(video.file.size / (1024 * 1024)).toFixed(1)} MB • {uploadProgress[video.id] < 80 ? 'Dosya gönderiliyor...' : uploadProgress[video.id] < 100 ? 'S3\'e yükleniyor...' : 'Tamamlandı!'}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs mt-0.5" style={{ color: video.url ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                                  Ses · {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                                  {video.durationSeconds ? ` · ${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')} dk` : ''}
                                  {video.url ? ' · Yüklendi ✓' : ''}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                Ses dosyasını sürükleyin veya tıklayıp seçin
                              </p>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
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
                            style={video.file ? { background: 'var(--color-surface-hover)', color: 'var(--color-text-primary)' } : { borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
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
                              style={{ color: 'var(--color-primary)' }}
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
                        style={{ background: 'var(--color-bg)' }}
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
                          style={{ background: video.documentFile ? 'var(--color-success-bg)' : 'var(--color-surface-hover)' }}
                        >
                          <FileText className="h-4 w-4" style={{ color: video.documentFile ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                        </div>
                        <div className="flex-1">
                          {video.documentFile ? (
                            <p className="text-sm" style={{ color: video.documentKey ? 'var(--color-success)' : 'var(--color-text-primary)' }}>
                              {video.documentFile.name}
                              {video.documentUploading ? ' — Yükleniyor...' : video.documentKey ? ' ✓' : ''}
                            </p>
                          ) : (
                            <>
                              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                Eşlik eden doküman ekle (opsiyonel)
                              </p>
                              <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
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
                          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
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
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
                  >
                    <Layers className="h-10 w-10 mb-3" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                      Henüz içerik eklenmedi
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-accent-light)' }}>
                    <FileQuestion className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Sınav Soruları</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {questions.length} soru • Toplam {questions.reduce((s, q) => s + q.points, 0)} puan
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    disabled
                    variant="outline"
                    className="gap-2 font-semibold rounded-xl"
                    title="Soru kütüphanesi yakında eklenecek"
                  >
                    <BookOpen className="h-4 w-4" /> Kütüphaneden Ekle
                  </Button>
                  <Button
                    onClick={addQuestion}
                    className="gap-2 font-semibold text-white rounded-xl"
                    style={{ background: 'var(--color-accent)', transition: 'opacity var(--transition-fast)' }}
                  >
                    <Plus className="h-4 w-4" /> Soru Ekle
                  </Button>
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
                  >
                    {/* Question header */}
                    <div
                      className="flex items-center gap-3 px-5 py-3.5"
                      style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
                        style={{ background: 'var(--color-accent)' }}
                      >
                        {qIdx + 1}
                      </div>
                      <Input
                        value={q.text}
                        onChange={(e) => setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, text: e.target.value } : pq))}
                        placeholder="Soruyu yazın..."
                        className="flex-1 h-9 border-0 bg-transparent text-sm font-medium focus-visible:ring-0 px-0"
                        style={{ color: 'var(--color-text-primary)' }}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          value={q.points}
                          onChange={(e) => setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, points: Number(e.target.value) } : pq))}
                          className="w-16 h-8 text-center text-xs"
                          style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)', borderRadius: 'var(--radius-lg)' }}
                        />
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>puan</span>
                        <button
                          onClick={() => removeQuestion(q.id)}
                          className="rounded-lg p-1.5"
                          style={{ color: 'var(--color-error)', transition: 'opacity var(--transition-fast)' }}
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
                            border: `1.5px solid ${q.correct === optIdx ? 'var(--color-success)' : 'var(--color-border)'}`,
                            background: q.correct === optIdx ? 'var(--color-success-bg)' : 'var(--color-surface)',
                            transition: 'border-color var(--transition-fast), background var(--transition-fast)',
                          }}
                        >
                          <input
                            type="radio"
                            name={`q-${q.id}`}
                            className="h-4 w-4"
                            style={{ accentColor: 'var(--color-success)' }}
                            checked={q.correct === optIdx}
                            onChange={() => {
                              setQuestions(prev => prev.map(pq => pq.id === q.id ? { ...pq, correct: optIdx } : pq));
                            }}
                          />
                          <span
                            className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold"
                            style={{
                              background: q.correct === optIdx ? 'var(--color-success)' : 'var(--color-surface-hover)',
                              color: q.correct === optIdx ? 'white' : 'var(--color-text-muted)',
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
                            style={{ color: 'var(--color-text-primary)' }}
                          />
                        </label>
                      ))}
                      <p className="text-[11px] pl-1" style={{ color: 'var(--color-text-muted)' }}>
                        <CheckCircle2 className="h-3 w-3 inline mr-1" style={{ color: 'var(--color-success)' }} />
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
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-info-bg)' }}>
                  <Users className="h-5 w-5" style={{ color: 'var(--color-info)' }} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Personel Atama</h3>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Eğitimi atamak istediğiniz departmanları seçin</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Input
                  placeholder="Departman veya personel ara..."
                  className="max-w-sm h-11"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}
                />
                <Button
                  variant="outline"
                  onClick={() => setSelectedDepts(selectedDepts.length === departments.length ? [] : departments.map(d => d.id))}
                  className="h-11 rounded-xl"
                  style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                >
                  {selectedDepts.length === departments.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {departments.map((dept) => {
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
                          borderColor: isSelected ? dept.color : 'var(--color-border)',
                          background: isSelected ? 'var(--color-bg)' : 'var(--color-surface)',
                          transition: 'border-color var(--transition-fast), background var(--transition-fast)',
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
                          <p className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
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
                    style={{ borderColor: dept.color, background: 'var(--color-surface)' }}
                  >
                    <div className="flex items-center justify-between px-4 py-3" style={{ background: `${dept.color}10`, borderBottom: `1px solid ${dept.color}30` }}>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ background: dept.color }} />
                        <span className="text-sm font-bold">{dept.name}</span>
                        <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                          {dept.staff.filter(s => !excludedStaff.includes(s.id)).length}/{dept.staff.length} kişi seçili
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setExpandedDept(null)}
                        className="text-xs font-medium px-2 py-1 rounded-md"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Kapat
                      </button>
                    </div>
                    <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                      {dept.staff.map((staff) => {
                        const isExcluded = excludedStaff.includes(staff.id);
                        return (
                          <div
                            key={staff.id}
                            className="flex items-center justify-between px-4 py-2.5 transition-colors duration-100"
                            style={{ background: isExcluded ? 'var(--color-error-bg)' : 'transparent' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                style={{ background: isExcluded ? 'var(--color-text-muted)' : dept.color, opacity: isExcluded ? 0.5 : 1 }}
                              >
                                {staff.initials}
                              </div>
                              <div>
                                <p className="text-sm font-medium" style={{ textDecoration: isExcluded ? 'line-through' : 'none', opacity: isExcluded ? 0.5 : 1 }}>{staff.name}</p>
                                <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{staff.title}</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleStaffExclusion(staff.id)}
                              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150"
                              style={{
                                background: isExcluded ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
                                color: isExcluded ? 'var(--color-success)' : 'var(--color-error)',
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
                  background: totalSelectedStaff > 0 ? 'linear-gradient(135deg, var(--color-primary), #0f4a35)' : 'var(--color-bg)',
                  border: totalSelectedStaff > 0 ? 'none' : '1px solid var(--color-border)',
                }}
              >
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5" style={{ color: totalSelectedStaff > 0 ? 'rgba(255,255,255,0.7)' : 'var(--color-text-muted)' }} />
                  <span className="text-sm font-medium" style={{ color: totalSelectedStaff > 0 ? 'white' : 'var(--color-text-secondary)' }}>
                    Seçili personel sayısı
                  </span>
                </div>
                <span
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-mono)', color: totalSelectedStaff > 0 ? 'white' : 'var(--color-text-muted)' }}
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
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Button
          variant="outline"
          onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : router.back())}
          className="gap-2 h-11 rounded-xl"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
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
                background: step.id <= currentStep ? 'var(--color-primary)' : 'var(--color-border)',
                transition: 'width var(--transition-fast), background var(--transition-fast)',
              }}
            />
          ))}
        </div>

        {currentStep < 4 ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            className="gap-2 h-11 rounded-xl font-semibold text-white"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), #0f4a35)',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
              transition: 'opacity var(--transition-fast)',
            }}
          >
            Sonraki Adım <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            disabled={publishing}
            onClick={async () => {
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
                      startDate: new Date(startDate).toISOString(),
                      endDate: new Date(endDate).toISOString(),
                      isCompulsory,
                      complianceDeadline: isCompulsory && complianceDeadline ? new Date(complianceDeadline).toISOString() : null,
                      regulatoryBody: isCompulsory && regulatoryBody ? regulatoryBody : null,
                      renewalPeriodMonths: isCompulsory && renewalPeriodMonths !== '' ? Number(renewalPeriodMonths) : null,
                      videos: videos.filter(v => v.url).map(v => ({ title: v.title || v.file?.name || (v.contentType === 'audio' ? 'Ses' : v.contentType === 'pdf' ? 'Doküman' : 'Video'), url: v.url, contentType: v.contentType, pageCount: v.pageCount, durationSeconds: v.durationSeconds, documentKey: v.documentKey })),
                      questions,
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
              background: 'linear-gradient(135deg, var(--color-primary), #0f4a35)',
              boxShadow: '0 4px 12px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
              transition: 'opacity var(--transition-fast)',
            }}
          >
            <Sparkles className="h-4 w-4" /> Eğitimi Yayınla
          </Button>
        )}
      </div>

    </div>
  );
}
