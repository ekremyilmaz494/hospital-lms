'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, ArrowRight, Info, FileQuestion, Users, Check, Sparkles,
  Layers, ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { TRAINING_CATEGORIES } from '@/lib/training-categories';
import {
  K, cardStyle, distributePoints,
  type VideoItem, type QuestionItem, type CategoryOption,
} from './_steps/types';
import type { SelectedContent } from './content-library-modal';

// Lazy step component'leri — yalnızca o adıma gelindiğinde bundle yüklenir.
const stepLoading = () => (
  <div className="p-8" style={{ color: K.TEXT_MUTED }}>Yükleniyor…</div>
);
const BasicInfoStep = dynamic(() => import('./_steps/basic-info-step'), { loading: stepLoading });
const ContentStep = dynamic(() => import('./_steps/content-step'), { loading: stepLoading });
const QuestionsStep = dynamic(() => import('./_steps/questions-step'), { loading: stepLoading });
const AssignStep = dynamic(() => import('./_steps/assign-step'), { loading: stepLoading });

const steps = [
  { id: 1, title: 'Temel Bilgiler', description: 'Eğitim detayları', icon: Info },
  { id: 2, title: 'İçerikler', description: 'Video & Doküman', icon: Layers },
  { id: 3, title: 'Sınav Soruları', description: 'Soru bankası', icon: FileQuestion },
  { id: 4, title: 'Personel Atama', description: 'Hedef kitle', icon: Users },
];

export default function NewTrainingPage() {
  const router = useRouter();
  const { toast } = useToast();

  // Departments fetch'i AssignStep'e taşındı — staff/department fetch yalnızca 4. adımda atılır.
  const { data: dbCategories } = useFetch<{ id: string; value: string; label: string; icon: string }[]>('/api/admin/training-categories');
  const categories: readonly CategoryOption[] = dbCategories && dbCategories.length > 0 ? dbCategories : TRAINING_CATEGORIES;

  const [currentStep, setCurrentStep] = useState(1);
  const [publishing, setPublishing] = useState(false);

  // Step 1 — Basic info
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [examDurationMinutes, setExamDurationMinutes] = useState(30);
  const [smgPoints, setSmgPoints] = useState(10);
  const [isCompulsory, setIsCompulsory] = useState(false);
  const [complianceDeadline, setComplianceDeadline] = useState('');
  const [regulatoryBody, setRegulatoryBody] = useState('');
  const [renewalPeriodMonths, setRenewalPeriodMonths] = useState<number | ''>('');

  // Step 2 — Content
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number>>({});
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  // Step 3 — Questions
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { id: 1, text: '', points: 10, options: ['', '', '', ''], correct: -1 },
  ]);
  const [passingScore, setPassingScore] = useState(70);
  // AI tab'ında üretilmiş ama henüz "Soruları Ekle" ile manuel listeye taşınmamış soru sayısı.
  // > 0 ise step 3 ileri geçilemez — kullanıcı kazara AI sorularını kaybetmesin.
  const [pendingAiCount, setPendingAiCount] = useState(0);

  // Step 4 — Assignment
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [excludedStaff, setExcludedStaff] = useState<string[]>([]);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptSearch, setDeptSearch] = useState('');

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

    if (isPdf) {
      try {
        const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
        GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs`;
        const arrayBuf = await file.arrayBuffer();
        const pdf = await getDocument({ data: new Uint8Array(arrayBuf) }).promise;
        setVideos(prev => prev.map(v => v.id === itemId ? { ...v, pageCount: pdf.numPages } : v));
      } catch { /* continue */ }
    }

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
      const filled = prev.filter(v => v.url || v.title);
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
      const hasPlayable = videos.some(v => v.contentType === 'video' || v.contentType === 'audio');
      if (videos.length > 0 && !hasPlayable) {
        return 'Eğitimde en az bir video veya ses içeriği bulunmalıdır. PDF tek başına yeterli değildir.';
      }
    }
    if (step === 3) {
      if (pendingAiCount > 0) {
        return `AI sekmesinde ${pendingAiCount} adet üretilmiş soru var ama henüz eklenmedi. "Soruları Ekle (${pendingAiCount})" butonuna basın veya istemiyorsanız "Tümünü Yeniden Üret" ile temizleyin.`;
      }
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

  const handlePublish = async () => {
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
          videos: videos.filter(v => v.url).map(v => ({
            title: v.title || v.file?.name || (v.contentType === 'audio' ? 'Ses' : v.contentType === 'pdf' ? 'Doküman' : 'Video'),
            url: v.url,
            contentType: v.contentType,
            pageCount: v.pageCount,
            durationSeconds: v.durationSeconds,
            documentKey: v.documentKey,
          })),
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
          try {
            const parsedErrors = JSON.parse(body.error);
            if (Array.isArray(parsedErrors)) {
              throw new Error(`Eksik alan: ${parsedErrors.map((e: { path: string[] }) => e.path.join('.')).join(', ')}`);
            }
          } catch { /* ignore JSON error if it wasn't valid */ }
        }
        throw new Error(body.error || 'Eğitim oluşturulamadı');
      }
      toast('Eğitim başarıyla yayınlandı!', 'success');
      router.push('/admin/trainings');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
      setPublishing(false);
    }
  };

  return (
    <div className="k-page" style={{ background: K.BG, minHeight: '100%' }}>
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
        {/* Step Indicator */}
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

        {/* Step Content — lazy mount */}
        <div
          style={{
            background: K.SURFACE,
            border: `1.5px solid ${K.BORDER}`,
            borderRadius: 16,
            padding: 28,
            boxShadow: K.SHADOW_CARD,
          }}
        >
          {currentStep === 1 && (
            <BasicInfoStep
              title={title} setTitle={setTitle}
              description={description} setDescription={setDescription}
              selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
              categories={categories}
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              maxAttempts={maxAttempts} setMaxAttempts={setMaxAttempts}
              examDurationMinutes={examDurationMinutes} setExamDurationMinutes={setExamDurationMinutes}
              smgPoints={smgPoints} setSmgPoints={setSmgPoints}
              isCompulsory={isCompulsory} setIsCompulsory={setIsCompulsory}
              complianceDeadline={complianceDeadline} setComplianceDeadline={setComplianceDeadline}
              regulatoryBody={regulatoryBody} setRegulatoryBody={setRegulatoryBody}
              renewalPeriodMonths={renewalPeriodMonths} setRenewalPeriodMonths={setRenewalPeriodMonths}
            />
          )}
          {currentStep === 2 && (
            <ContentStep
              videos={videos} setVideos={setVideos}
              uploadProgress={uploadProgress}
              uploadFileToS3={uploadFileToS3}
              addFromLibrary={addFromLibrary}
              removeVideo={removeVideo}
              libraryModalOpen={libraryModalOpen}
              setLibraryModalOpen={setLibraryModalOpen}
              toast={toast}
            />
          )}
          {currentStep === 3 && (
            <QuestionsStep
              questions={questions} setQuestions={setQuestions}
              passingScore={passingScore} setPassingScore={setPassingScore}
              addQuestion={addQuestion}
              removeQuestion={removeQuestion}
              onPendingAiChange={setPendingAiCount}
            />
          )}
          {currentStep === 4 && (
            <AssignStep
              selectedDepts={selectedDepts} setSelectedDepts={setSelectedDepts}
              excludedStaff={excludedStaff} setExcludedStaff={setExcludedStaff}
              expandedDept={expandedDept} setExpandedDept={setExpandedDept}
              deptSearch={deptSearch} setDeptSearch={setDeptSearch}
            />
          )}
        </div>

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
              onClick={handlePublish}
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
