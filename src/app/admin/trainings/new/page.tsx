'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, Save, Info, Video, FileQuestion, Users, Check, Plus, Trash2,
  GripVertical, Upload, Clock, Award, Calendar, Target, Sparkles, BookOpen, CheckCircle2,
  ShieldCheck, RefreshCw, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

const steps = [
  { id: 1, title: 'Temel Bilgiler', description: 'Eğitim detayları', icon: Info },
  { id: 2, title: 'Videolar', description: 'İçerik yükleme', icon: Video },
  { id: 3, title: 'Sınav Soruları', description: 'Soru bankası', icon: FileQuestion },
  { id: 4, title: 'Personel Atama', description: 'Hedef kitle', icon: Users },
];

import { TRAINING_CATEGORIES } from '@/lib/training-categories';
const categories = TRAINING_CATEGORIES;

interface DeptStaff { id: string; name: string; title: string; initials: string; }
interface Dept { id: string; name: string; count: number; color: string; staff: DeptStaff[]; }

export default function NewTrainingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: departmentsData, isLoading: deptsLoading } = useFetch<Dept[]>('/api/admin/departments');
  const departments: Dept[] = departmentsData ?? [];
  const [currentStep, setCurrentStep] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [excludedStaff, setExcludedStaff] = useState<string[]>([]);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [videos, setVideos] = useState<{ id: number; title: string; url: string; file?: File }[]>([
    { id: 1, title: '', url: '' },
  ]);
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

  const addVideo = () => setVideos(prev => [...prev, { id: Date.now(), title: '', url: '' }]);
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
                        className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3"
                        style={{
                          borderColor: selectedCategory === cat.value ? 'var(--color-primary)' : 'var(--color-border)',
                          background: selectedCategory === cat.value ? 'var(--color-primary-light)' : 'var(--color-bg)',
                          transition: 'border-color var(--transition-fast), background var(--transition-fast)',
                        }}
                      >
                        <span className="text-lg">{cat.icon}</span>
                        <span
                          className="text-sm font-medium"
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
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Eğitim hakkında kısa bir açıklama yazın..."
                    className="mt-2 w-full rounded-xl border px-4 py-3 text-sm"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-body)', resize: 'vertical' }}
                  />
                </div>

                <div
                  className="rounded-xl p-5"
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
                >
                  <p className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>Sınav Ayarları</p>
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
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

          {/* Step 2: Videos */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-primary-light)' }}>
                    <Video className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Eğitim Videoları</h3>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{videos.length} video eklendi</p>
                  </div>
                </div>
                <Button
                  onClick={addVideo}
                  className="gap-2 font-semibold text-white rounded-xl"
                  style={{ background: 'var(--color-primary)', transition: 'opacity var(--transition-fast)' }}
                >
                  <Plus className="h-4 w-4" /> Video Ekle
                </Button>
              </div>

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
                    {/* Video header */}
                    <div className="flex items-center gap-4 px-4 py-3" style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <GripVertical className="h-5 w-5 shrink-0 cursor-grab" style={{ color: 'var(--color-text-muted)' }} />
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold"
                        style={{ background: 'var(--color-primary)', color: 'white' }}
                      >
                        {idx + 1}
                      </div>
                      <Input
                        placeholder="Video başlığı girin..."
                        className="flex-1 h-9 border-0 bg-transparent text-sm font-medium focus-visible:ring-0 px-0"
                        style={{ color: 'var(--color-text-primary)' }}
                      />
                      {videos.length > 1 && (
                        <button
                          onClick={() => removeVideo(video.id)}
                          className="rounded-lg p-2 opacity-0 group-hover:opacity-100"
                          style={{ color: 'var(--color-error)', transition: 'opacity var(--transition-fast)' }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {/* Upload area per video */}
                    <div
                      className="flex items-center gap-4 px-5 py-5 relative"
                      style={{ background: 'var(--color-surface)' }}
                    >
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 500 * 1024 * 1024) {
                              toast('Dosya boyutu 500MB sınırını aşıyor', 'error');
                              return;
                            }
                            // Show uploading state
                            setVideos(prev => prev.map(v => v.id === video.id ? { ...v, file, url: '' } : v));
                            try {
                              const formData = new FormData();
                              formData.append('file', file);
                              const res = await fetch('/api/upload/video', { method: 'POST', body: formData });
                              if (!res.ok) throw new Error('Upload failed');
                              const data = await res.json();
                              setVideos(prev => prev.map(v => v.id === video.id ? { ...v, url: data.url, file } : v));
                              toast('Video yüklendi', 'success');
                            } catch {
                              toast('Video yüklenemedi', 'error');
                              setVideos(prev => prev.map(v => v.id === video.id ? { ...v, url: '', file: undefined } : v));
                            }
                          }
                        }}
                      />
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                        style={{ background: video.file ? 'var(--color-success-bg)' : 'var(--color-primary-light)' }}
                      >
                        {video.file ? (
                          <Video className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
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
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                              {(video.file.size / (1024 * 1024)).toFixed(2)} MB • {video.url ? 'Yüklendi ✓' : 'Yükleniyor...'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                              Video dosyasını sürükleyin veya tıklayıp seçin
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                              MP4, WebM — Maks. 500MB
                            </p>
                          </>
                        )}
                      </div>
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
                    </div>
                  </div>
                ))}
              </div>
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
                <Button
                  onClick={addQuestion}
                  className="gap-2 font-semibold text-white rounded-xl"
                  style={{ background: 'var(--color-accent)', transition: 'opacity var(--transition-fast)' }}
                >
                  <Plus className="h-4 w-4" /> Soru Ekle
                </Button>
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
              boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
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
                      videos: videos.map(v => ({ title: v.title, url: v.url })),
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
              boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
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
