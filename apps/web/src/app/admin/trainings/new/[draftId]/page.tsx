'use client';

/**
 * Taslak destekli eğitim wizard'ı — /admin/trainings/new/[draftId]
 *
 * - Mount'ta GET /api/admin/trainings/[id]/draft → state hydration
 * - State değişimleri 1 sn debounce ile PATCH .../draft (auto-save)
 * - Video upload'ları admin layout'taki UploadManager üzerinden — sayfadan
 *   ayrılsa da arka planda devam eder
 * - "Yayınla" → POST /api/admin/trainings/[id]/publish (drafttan published'a)
 *
 * Eski /admin/trainings/new altındaki tek-component versiyonun (538 satırlık
 * page.tsx) refactor edilmiş hali. Step component'leri (_steps/*) tamamen
 * paylaşılır, prop interface'leri değişmedi.
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  ArrowLeft, ArrowRight, Info, FileQuestion, Users, Check, Sparkles,
  Layers, ChevronRight, CloudUpload, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import {
  K, cardStyle, distributePoints,
  type VideoItem, type QuestionItem, type CategoryOption,
} from '../_steps/types';
import type { SelectedContent } from '../media-library-modal';
import { useUploadManager, type UploadItem } from '@/components/admin/upload-manager';

const stepLoading = () => (
  <div className="p-8" style={{ color: K.TEXT_MUTED }}>Yükleniyor…</div>
);
const BasicInfoStep = dynamic(() => import('../_steps/basic-info-step'), { loading: stepLoading });
const ContentStep = dynamic(() => import('../_steps/content-step'), { loading: stepLoading });
const QuestionsStep = dynamic(() => import('../_steps/questions-step'), { loading: stepLoading });
const AssignStep = dynamic(() => import('../_steps/assign-step'), { loading: stepLoading });

const steps = [
  { id: 1, title: 'Temel Bilgiler', description: 'Eğitim detayları', icon: Info },
  { id: 2, title: 'İçerikler', description: 'Video & Doküman', icon: Layers },
  { id: 3, title: 'Sınav Soruları', description: 'Soru bankası', icon: FileQuestion },
  { id: 4, title: 'Personel Atama', description: 'Hedef kitle', icon: Users },
];

/** AI pending state — henüz "Soruları Ekle" butonuyla onaylanmamış AI soruları.
 *  Lokal tipi import'lamak yerine inline tutuyoruz (component bağımlılık zinciri sade kalsın). */
interface AiPendingSnapshot {
  displayed: Array<{
    questionText: string;
    options: string[];
    correctIndex: number;
    sourceQuote: string;
    sourcePage?: number;
    sourceKey?: string;
    clientId: string;
  }>;
  queue: Array<{
    questionText: string;
    options: string[];
    correctIndex: number;
    sourceQuote: string;
    sourcePage?: number;
    sourceKey?: string;
    clientId: string;
  }>;
}

/** Auto-save'in PATCH'leyeceği tam wizard snapshot'ı — DB'de Json kolonu olarak saklanır. */
interface DraftSnapshot {
  title: string;
  description: string;
  instructorName: string;
  selectedCategory: string;
  startDate: string;
  endDate: string;
  maxAttempts: number | '';
  examDurationMinutes: number | '';
  isCompulsory: boolean;
  complianceDeadline: string;
  regulatoryBody: string;
  renewalPeriodMonths: number | '';
  videos: VideoItem[];
  questions: QuestionItem[];
  passingScore: number;
  selectedDepts: string[];
  excludedStaff: string[];
  /** Step 3 AI tab — pending sorular ve aktif mod (manuel/ai) */
  questionsActiveMode?: 'manual' | 'ai';
  aiPending?: AiPendingSnapshot;
  /** Step 3 AI tab — yüklenmiş kaynak dosyalar (S3 key + metadata).
   *  Sayfa yenilenince admin kaynakları tekrar yüklemek zorunda kalmasın. */
  aiUploadedSources?: Array<{
    s3Key: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    pageCount?: number;
  }>;
}

export default function DraftWizardPage() {
  const router = useRouter();
  const { toast } = useToast();
  const params = useParams<{ draftId: string }>();
  const draftId = params.draftId;
  const uploadMgr = useUploadManager();

  // Kategoriler tek kaynaktan: Kategori Yönetimi (TrainingCategory tablosu).
  // Statik fallback kaldırıldı — yönetimde silinen/eklenen kategoriler sihirbaza
  // birebir yansısın. İlk yüklemede DB boşsa GET endpoint kendisi default'ları seed'liyor.
  const { data: dbCategories } = useFetch<{ id: string; value: string; label: string; icon: string }[]>('/api/admin/training-categories');
  const categories: readonly CategoryOption[] = dbCategories ?? [];

  const [hydrated, setHydrated] = useState(false);
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [publishing, setPublishing] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  // Validasyondan ileri geçen adımlar. Geriye dönüp ilgili adımdaki kritik
  // alanları bozarsa o adım otomatik dirty olur — `completedHashes`'taki snapshot
  // mevcut state ile karşılaştırılır. Yayın butonu sadece tüm 4 step "fresh
  // valid" olduğunda etkin.
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(() => new Set());
  // Her başarılı validasyonun snapshot'ı — geri dönüp düzeltme yapılınca dirty
  // hesabı için. Sadece o adımı etkileyen field'ları içerir; ref kullanıyoruz çünkü
  // tetikleyici state mutasyonu istemiyoruz, derived olarak okunur.
  const completedHashes = useRef<Map<number, string>>(new Map());

  // Step 1
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructorName, setInstructorName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [maxAttempts, setMaxAttempts] = useState<number | ''>('');
  const [examDurationMinutes, setExamDurationMinutes] = useState<number | ''>('');
  const [isCompulsory, setIsCompulsory] = useState(false);
  const [complianceDeadline, setComplianceDeadline] = useState('');
  const [regulatoryBody, setRegulatoryBody] = useState('');
  const [renewalPeriodMonths, setRenewalPeriodMonths] = useState<number | ''>('');
  // R2 — Publish hatasında step 4'te inline banner için (toast'a ek). Step değişiminde
  // de görünür kalır, kullanıcı tekrar publish denerken bağlamı kaybetmez.
  const [publishError, setPublishError] = useState<string | null>(null);

  // Step 2 — videos artık manager üzerinden upload ediliyor
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);

  // Step 3
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { id: 1, text: '', points: 10, options: ['', '', '', ''], correct: -1 },
  ]);
  const [passingScore, setPassingScore] = useState(70);
  const [pendingAiCount, setPendingAiCount] = useState(0);
  // AI tab pending state — mode geçişi ve sayfa yenilemede korunur, draft'a kaydedilir.
  const [questionsActiveMode, setQuestionsActiveMode] = useState<'manual' | 'ai'>('manual');
  const [aiPending, setAiPending] = useState<AiPendingSnapshot>({ displayed: [], queue: [] });
  // F — AI kaynak dosyaları (S3 key) draft'a kaydedilir. Sayfa yenilenince admin
  // tekrar dosya yüklemek zorunda kalmaz. S3 lifecycle policy bu key'leri belirli
  // bir süre sonra silebilir; o durumda hydration sonrası admin yeniden yüklemeli.
  const [aiUploadedSources, setAiUploadedSources] = useState<NonNullable<DraftSnapshot['aiUploadedSources']>>([]);

  // Step 4
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [excludedStaff, setExcludedStaff] = useState<string[]>([]);
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptSearch, setDeptSearch] = useState('');

  // ── Hydration ──
  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/trainings/${draftId}/draft`, { cache: 'no-store' });
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Taslak bulunamadı veya silinmiş' : 'Taslak yüklenemedi');
        }
        const { draftData, draftStep } = (await res.json()) as { draftData: DraftSnapshot | null; draftStep: number };
        if (cancelled) return;

        if (draftData) {
          setTitle(draftData.title ?? '');
          setDescription(draftData.description ?? '');
          setInstructorName(draftData.instructorName ?? '');
          setSelectedCategory(draftData.selectedCategory ?? '');
          if (draftData.startDate) setStartDate(draftData.startDate);
          if (draftData.endDate) setEndDate(draftData.endDate);
          setMaxAttempts(draftData.maxAttempts ?? '');
          setExamDurationMinutes(draftData.examDurationMinutes ?? '');
          setIsCompulsory(!!draftData.isCompulsory);
          setComplianceDeadline(draftData.complianceDeadline ?? '');
          setRegulatoryBody(draftData.regulatoryBody ?? '');
          setRenewalPeriodMonths(draftData.renewalPeriodMonths ?? '');
          setVideos(Array.isArray(draftData.videos) ? draftData.videos : []);
          if (Array.isArray(draftData.questions) && draftData.questions.length > 0) {
            setQuestions(draftData.questions);
          }
          setPassingScore(draftData.passingScore ?? 70);
          setSelectedDepts(Array.isArray(draftData.selectedDepts) ? draftData.selectedDepts : []);
          setExcludedStaff(Array.isArray(draftData.excludedStaff) ? draftData.excludedStaff : []);
          if (draftData.questionsActiveMode === 'manual' || draftData.questionsActiveMode === 'ai') {
            setQuestionsActiveMode(draftData.questionsActiveMode);
          }
          if (draftData.aiPending && Array.isArray(draftData.aiPending.displayed) && Array.isArray(draftData.aiPending.queue)) {
            // Eski draft'larda yarıda kalmış skeleton placeholder (questionText:'')
            // kaydedilmiş olabilir → restore'da temizle; aksi halde "Soruları Ekle"
            // kalıcı disabled kalıp admin'i draft'ta kilitler.
            setAiPending({
              displayed: draftData.aiPending.displayed.filter((q) => q.questionText.trim() !== ''),
              queue: draftData.aiPending.queue.filter((q) => q.questionText.trim() !== ''),
            });
          }
          if (Array.isArray(draftData.aiUploadedSources)) {
            setAiUploadedSources(draftData.aiUploadedSources);
          }
        }
        setCurrentStep(Math.min(4, Math.max(1, draftStep || 1)));
        setHydrated(true);
      } catch (err) {
        if (!cancelled) {
          setHydrationError(err instanceof Error ? err.message : 'Taslak yüklenemedi');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [draftId]);

  // ── Auto-save (debounced 1 sn) ──
  // videos[] içindeki File objeleri JSON'a serialize edilemez — `url` dolmamış
  // (henüz yüklenmemiş) kayıtları snapshot'tan eler ve File referanslarını siler.
  // Sayfadan ayrılırsa upload zaten kesilir; eksik kalan dosya kullanıcının
  // tekrar seçmesi gerekir, bu yüzden tutmanın anlamı yok.
  const persistableVideos = useMemo<VideoItem[]>(
    () => videos
      .filter(v => !!v.url)
      .map(({ file: _f, ...rest }) => rest),
    [videos],
  );

  const snapshot = useMemo<DraftSnapshot>(() => ({
    title, description, instructorName, selectedCategory, startDate, endDate,
    maxAttempts, examDurationMinutes, isCompulsory,
    complianceDeadline, regulatoryBody, renewalPeriodMonths,
    videos: persistableVideos, questions, passingScore, selectedDepts, excludedStaff,
    questionsActiveMode, aiPending, aiUploadedSources,
  }), [
    title, description, instructorName, selectedCategory, startDate, endDate,
    maxAttempts, examDurationMinutes, isCompulsory,
    complianceDeadline, regulatoryBody, renewalPeriodMonths,
    persistableVideos, questions, passingScore, selectedDepts, excludedStaff,
    questionsActiveMode, aiPending, aiUploadedSources,
  ]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJson = useRef<string>('');
  // Pending snapshot — unmount'ta flush etmek için
  const pendingPayload = useRef<{ draftData: DraftSnapshot; draftStep: number } | null>(null);

  useEffect(() => {
    if (!hydrated || !draftId) return;
    const json = JSON.stringify(snapshot);
    if (json === lastSavedJson.current) {
      pendingPayload.current = null;
      return;
    }

    pendingPayload.current = { draftData: snapshot, draftStep: currentStep };

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        setSaving(true);
        const res = await fetch(`/api/admin/trainings/${draftId}/draft`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draftData: snapshot, draftStep: currentStep }),
        });
        if (res.ok) {
          lastSavedJson.current = json;
          pendingPayload.current = null;
          setSavedAt(new Date());
        }
      } catch { /* sessizce yut — sonraki state değişiminde yeniden denenir */ }
      finally { setSaving(false); }
    }, 1000);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [snapshot, currentStep, hydrated, draftId]);

  // Unmount flush — kullanıcı sayfadan ayrılırsa son 1 saniyenin değişikliği
  // debounce timer'ı clear edileceği için kaybolurdu. sendBeacon kullanıyoruz:
  // sayfa zaten kapanıyor olsa bile tarayıcı POST'u garantili gönderir.
  useEffect(() => {
    return () => {
      const payload = pendingPayload.current;
      if (!payload || !draftId) return;
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        // sendBeacon body POST gönderir; PATCH desteklemez. Bu yüzden ayrı bir
        // route eşdeğeri yok — fetch + keepalive ile aynı amacı sağlıyoruz.
        void fetch(`/api/admin/trainings/${draftId}/draft`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: blob,
          keepalive: true,
        });
      } catch { /* ignore — best-effort flush */ }
    };
  }, [draftId]);

  // ── Upload Manager entegrasyonu ──
  // Aynı draftId'ye ait upload'ları follow et; tamamlananı videos[]'a yansıt.
  const draftUploads = uploadMgr.getByDraft(draftId);

  // contentItemId → progress yüzdesi (content-step prop'u için)
  const uploadProgress = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    for (const u of draftUploads) {
      if (u.status === 'uploading' || u.status === 'pending') {
        map[u.contentItemId] = u.progress;
      } else if (u.status === 'done' && u.progress < 100) {
        map[u.contentItemId] = 100;
      }
    }
    return map;
  }, [draftUploads]);

  // Done olan upload'ları videos[]'a uygula (bir kere — uploadId set ile track edilir).
  // Wizard remount olduysa videos[] hydrate edilmiş olabilir veya boş — append-video
  // endpoint'i zaten draft'a yazdı, ama UI'ın bu render'ında görünmesi için lokal
  // state'i de güncelliyoruz.
  //
  // Hidrasyon tamamlanmadan apply çalışırsa async hidrasyon `setVideos([])` ile
  // üzerine yazıp uploadu kaybeder. `hydrated` guard'ı bu race'i engeller.
  const appliedUploadIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!hydrated) return;
    for (const u of draftUploads) {
      if (u.status === 'done' && u.result && !appliedUploadIds.current.has(u.uploadId)) {
        appliedUploadIds.current.add(u.uploadId);
        const result = u.result;
        const kind: VideoItem['contentType'] = u.kind;
        setVideos(prev => {
          const existing = prev.find(v => v.id === u.contentItemId);
          if (existing) {
            return prev.map(v =>
              v.id === u.contentItemId
                ? { ...v, url: result.key, contentType: kind, durationSeconds: result.durationSeconds ?? v.durationSeconds, pageCount: result.pageCount ?? v.pageCount }
                : v
            );
          }
          // Wizard yeniden mount oldu — eski state kayıp; yeni satır ekle.
          // (Hydration'da zaten draft'tan geldiyse ID eşleşir ve buraya düşmeyiz.)
          return [...prev, {
            id: u.contentItemId,
            title: u.fileName.replace(/\.[^.]+$/, ''),
            url: result.key,
            contentType: kind,
            durationSeconds: result.durationSeconds,
            pageCount: result.pageCount,
          }];
        });
      }
      if (u.status === 'error' && !appliedUploadIds.current.has(u.uploadId)) {
        appliedUploadIds.current.add(u.uploadId);
        toast(u.errorMessage || 'Yükleme başarısız', 'error');
        // Boş kayıt videos listesinde kalmasın
        setVideos(prev => prev.filter(v => v.id !== u.contentItemId || v.url));
      }
    }
  }, [hydrated, draftUploads, toast]);

  // Wizard'ın mevcut imzasıyla uyumlu wrapper — content-step bunu çağırır.
  const uploadFileToS3 = useCallback(async (itemId: number, file: File) => {
    const isPdf = file.type === 'application/pdf';
    const isAudio = file.type.startsWith('audio/');
    const maxSize = isPdf ? 100 * 1024 * 1024 : isAudio ? 200 * 1024 * 1024 : 500 * 1024 * 1024;
    const maxLabel = isPdf ? '100MB' : isAudio ? '200MB' : '500MB';
    if (file.size > maxSize) {
      toast(`Dosya boyutu ${maxLabel} sınırını aşıyor`, 'error');
      return;
    }
    const detectedType: VideoItem['contentType'] = isPdf ? 'pdf' : isAudio ? 'audio' : 'video';
    setVideos(prev => prev.map(v => v.id === itemId ? { ...v, file, url: '', contentType: detectedType } : v));

    uploadMgr.enqueue({
      draftId,
      contentItemId: itemId,
      file,
      onComplete: () => {
        toast(isPdf ? 'Doküman yüklendi' : isAudio ? 'Ses dosyası yüklendi' : 'Video yüklendi', 'success');
      },
      onError: (msg) => {
        toast(msg, 'error');
      },
    });
  }, [draftId, toast, uploadMgr]);

  const addFromLibrary = (items: SelectedContent[]) => {
    setVideos(prev => {
      const filled = prev.filter(v => v.url || v.title);
      const newItems: VideoItem[] = items.map(item => ({
        id: item.id,
        title: item.title,
        url: item.url,
        contentType: item.contentType,
        durationSeconds: item.durationSeconds,
        pageCount: item.pageCount,
        documentKey: item.documentKey,
        sourceMediaAssetId: item.sourceMediaAssetId,
      }));
      return [...filled, ...newItems];
    });
  };
  const removeVideo = (id: number) => setVideos(prev => prev.filter(v => v.id !== id));

  const addQuestion = () => setQuestions(prev => [...prev, { id: Date.now(), text: '', points: 10, options: ['', '', '', ''], correct: -1 }]);
  const removeQuestion = (id: number) => setQuestions(prev => prev.filter(q => q.id !== id));

  // Wizard validasyonu için aktif upload sayısı — kullanıcı sonraki adıma geçmesin
  const activeUploadCount = draftUploads.filter(u => u.status === 'uploading' || u.status === 'pending').length;

  // Cross-step rollup — Step 4'teki özet panele ve uyarı bloklarına geçirilir.
  // Adım 1-3 state'inden türetilir; AssignStep prop-driven olduğu için saf okuma.
  const trainingSummary = useMemo(() => {
    const realQuestionCount = questions.filter(q => q.text.trim() !== '').length;
    const totalDur = videos
      .filter(v => v.contentType === 'video' || v.contentType === 'audio')
      .reduce((s, v) => s + (v.durationSeconds ?? 0), 0);
    return {
      title,
      category: selectedCategory,
      videoCount: videos.filter(v => v.contentType === 'video').length,
      audioCount: videos.filter(v => v.contentType === 'audio').length,
      pdfCount: videos.filter(v => v.contentType === 'pdf').length,
      totalDurationSeconds: totalDur,
      questionCount: realQuestionCount,
      passingScore,
      examDurationMinutes: examDurationMinutes === '' ? 30 : Number(examDurationMinutes),
      isCompulsory,
      renewalPeriodMonths: renewalPeriodMonths === '' ? null : Number(renewalPeriodMonths),
      startDate,
      endDate,
    };
  }, [title, selectedCategory, videos, questions, passingScore, examDurationMinutes, isCompulsory, renewalPeriodMonths, startDate, endDate]);

  // Step hash'leri — geri dönüş sonrası dirty kontrolü için. Her adımın yayın-kritik
  // field'larını içerir; eklemeyi sade tutmak için JSON kullanıyoruz (alanlar küçük).
  const stepHashes = useMemo<Record<number, string>>(() => ({
    1: JSON.stringify({ title, selectedCategory, startDate, endDate, maxAttempts, examDurationMinutes, isCompulsory, complianceDeadline, regulatoryBody, renewalPeriodMonths }),
    2: JSON.stringify({ videos: videos.map(v => ({ id: v.id, url: v.url, contentType: v.contentType, title: v.title })) }),
    3: JSON.stringify({ passingScore, questions: questions.map(q => ({ text: q.text, options: q.options, correct: q.correct })) }),
    4: JSON.stringify({ selectedDepts, excludedStaff }),
  }), [title, selectedCategory, startDate, endDate, maxAttempts, examDurationMinutes, isCompulsory, complianceDeadline, regulatoryBody, renewalPeriodMonths, videos, passingScore, questions, selectedDepts, excludedStaff]);

  // Bir adım valid kabul edildiyse ve o adımın hash'i o anki hash ile eşleşiyorsa "completed".
  // Eşleşmiyorsa kullanıcı sonradan değiştirmiş demektir → dirty (stepper uyarı, ileri geçişte yeniden validate).
  const stepCompletedFresh = useCallback((step: number): boolean => {
    if (!completedSteps.has(step)) return false;
    return completedHashes.current.get(step) === stepHashes[step];
  }, [completedSteps, stepHashes]);

  const stepIsDirty = useCallback((step: number): boolean => {
    return completedSteps.has(step) && completedHashes.current.get(step) !== stepHashes[step];
  }, [completedSteps, stepHashes]);

  const validateStep = (step: number): string | null => {
    if (step === 1) {
      if (!title.trim()) return 'Eğitim adı boş olamaz.';
      if (!selectedCategory) return 'Kategori seçilmelidir.';
      if (!startDate || !endDate) return 'Başlangıç ve bitiş tarihleri zorunludur.';
      if (new Date(startDate) > new Date(endDate)) return 'Bitiş tarihi başlangıç tarihinden önce olamaz.';
      // Boş input → default kullan (UX: kullanıcı alanı temizlerse hata vermez, kayıtta default oturur).
      const ma = maxAttempts === '' ? 3 : Number(maxAttempts);
      if (!Number.isFinite(ma) || ma < 1 || ma > 10) return 'Deneme hakkı 1 ile 10 arasında olmalıdır.';
      const ed = examDurationMinutes === '' ? 30 : Number(examDurationMinutes);
      if (!Number.isFinite(ed) || ed < 1 || ed > 600) return 'Sınav süresi 1 ile 600 dakika arasında olmalıdır.';
      if (isCompulsory) {
        if (!complianceDeadline) return 'Zorunlu eğitimler için uyum son tarihi girilmelidir.';
        if (!regulatoryBody.trim()) return 'Zorunlu eğitimler için düzenleyici kurum girilmelidir.';
      }
    }
    if (step === 2) {
      if (activeUploadCount > 0) return 'Dosya yüklemesi devam ediyor. Lütfen tamamlanmasını bekleyin.';
      const pending = videos.find(v => !v.url);
      if (pending) return 'Tamamlanmamış içerik var. Dosya yükleyin ya da satırı kaldırın.';
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
      // Boş satır sayılmaz — "Soru Ekle"den boş satır kalır veya AI sonrası boş slot olabilir.
      // En az 1 GERÇEK soru zorunlu; aksi halde sınavsız eğitim yayınlanır.
      const realQuestions = questions.filter(q => q.text.trim() !== '');
      if (realQuestions.length === 0) return 'En az 1 soru tanımlanmalıdır. Manuel ekleyin veya AI ile üretin.';
      const ps = Number(passingScore);
      if (!Number.isFinite(ps) || ps < 0 || ps > 100) return 'Baraj puanı 0 ile 100 arasında olmalıdır.';
      for (const q of questions) {
        if (!q.text.trim()) return 'Tüm soruların metni doldurulmalıdır (boş satır bırakmayın).';
        const emptyOption = q.options.findIndex(o => !o.trim());
        if (emptyOption !== -1) return 'Tüm seçenekler doldurulmalıdır (boş seçenek bırakmayın).';
        if (q.correct < 0 || q.correct > 3) return 'Her soru için doğru cevap seçilmelidir.';
      }
    }
    if (step === 4) {
      if (selectedDepts.length === 0) {
        return isCompulsory
          ? 'Zorunlu eğitim en az bir departmana atanmalıdır.'
          : 'En az bir departman seçmelisiniz. Eğitim kimseye atanmazsa görüntülenemez.';
      }
    }
    return null;
  };

  const goToNextStep = () => {
    const err = validateStep(currentStep);
    if (err) { toast(err, 'error'); return; }
    // Bu adımı "fresh valid" olarak işaretle — sonradan değiştirilirse dirty olur.
    completedHashes.current.set(currentStep, stepHashes[currentStep]);
    setCompletedSteps(prev => new Set(prev).add(currentStep));
    setCurrentStep(currentStep + 1);
  };

  // Stepper üzerinden geçmiş adıma tıklama — currentStep iniyor ama completed
  // flag'i kalıyor; geri dönüldükten sonra değişiklik yapılırsa dirty hesabı
  // otomatik (hash karşılaştırması derived).
  const jumpToStep = (target: number) => {
    if (target > currentStep) return; // ileri zıplamaya izin yok
    setCurrentStep(target);
  };

  const handlePublish = async () => {
    // Yayın öncesi 4 adımı da revalidate — geriye dönüp düzenleme yapıldıysa
    // (örn. Step 1'de tarihi geri aldı, Step 4'te bir dept kaldırdı) yakalanmalı.
    for (const step of [1, 2, 3, 4]) {
      const err = validateStep(step);
      if (err) {
        toast(`Adım ${step}: ${err}`, 'error');
        setCurrentStep(step);
        return;
      }
    }
    setPublishing(true);
    setPublishError(null);
    try {
      // Önce taslağı son haliyle senkronla — debounce'tan kaçan değişiklikler için
      await fetch(`/api/admin/trainings/${draftId}/draft`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftData: snapshot, draftStep: currentStep }),
      }).catch(() => null);

      const res = await fetch(`/api/admin/trainings/${draftId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          instructorName: instructorName.trim() || null,
          category: selectedCategory,
          passingScore: Number(passingScore) || 70,
          maxAttempts: Number(maxAttempts) || 3,
          examDurationMinutes: Number(examDurationMinutes) || 30,
          smgPoints: 0,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          isCompulsory,
          complianceDeadline: isCompulsory && complianceDeadline ? new Date(complianceDeadline).toISOString() : null,
          regulatoryBody: isCompulsory && regulatoryBody ? regulatoryBody : null,
          renewalPeriodMonths: renewalPeriodMonths !== '' ? Number(renewalPeriodMonths) : null,
          videos: persistableVideos.map(v => ({
            title: v.title || v.file?.name || (v.contentType === 'audio' ? 'Ses' : v.contentType === 'pdf' ? 'Doküman' : 'Video'),
            url: v.url,
            contentType: v.contentType,
            pageCount: v.pageCount,
            durationSeconds: v.durationSeconds,
            documentKey: v.documentKey,
            sourceMediaAssetId: v.sourceMediaAssetId,
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
        throw new Error(body.error || 'Eğitim oluşturulamadı');
      }
      // R1 — Yayın sonrası listeye değil, oluşturulan eğitimin detayına git.
      // Admin "az önce oluşturduğum eğitim hangi?" sorusunu sormak zorunda kalmasın.
      const published = await res.json().catch(() => null) as { id?: string } | null;
      toast('Eğitim başarıyla yayınlandı!', 'success');
      if (published?.id) {
        router.push(`/admin/trainings/${published.id}`);
      } else {
        router.push('/admin/trainings');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bir hata oluştu';
      toast(msg, 'error');
      // R2 — Toast hızlıca kaybolur; admin "ne oldu?" sorusunu kaybetmesin diye
      // adım üzerinde inline kalsın. Sonraki publish denemesinde başta sıfırlanır.
      setPublishError(msg);
      setPublishing(false);
    }
  };

  // ── Render ──
  if (hydrationError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <p className="text-sm" style={{ color: 'var(--k-error)' }}>{hydrationError}</p>
        <Button variant="outline" onClick={() => router.push('/admin/trainings')}>
          Eğitimler listesine dön
        </Button>
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2" style={{ color: K.TEXT_MUTED }}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Taslak yükleniyor…</span>
        </div>
      </div>
    );
  }

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
          <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 6 }}>
            <p className="k-page-subtitle" style={{ fontSize: 14, color: K.TEXT_MUTED, margin: 0 }}>
              4 adımda eğitiminizi tamamlayın — bilgi, içerik, sınav ve atama.
            </p>
            <SaveStatusBadge saving={saving} savedAt={savedAt} />
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ ...cardStyle, padding: 20 }}>
          <div className="flex items-center" style={{ gap: 0 }}>
            {steps.map((step, idx) => {
              const isActive = step.id === currentStep;
              const isFreshCompleted = step.id < currentStep && stepCompletedFresh(step.id);
              const isDirty = stepIsDirty(step.id) && step.id < currentStep;
              const isPending = step.id > currentStep;
              // Renk kodu: dirty (uyarı, sarı) > fresh completed (yeşil) > active > pending.
              const circleBg = isActive ? K.PRIMARY : isDirty ? K.WARNING : isFreshCompleted ? K.PRIMARY : '#f5f4f1';
              const circleColor = isActive || isFreshCompleted || isDirty ? '#fff' : K.TEXT_MUTED;
              const circleBorder = isPending ? `1.5px solid ${K.BORDER}` : 'none';
              const titleColor = isActive ? K.TEXT_PRIMARY : isDirty ? K.WARNING : isFreshCompleted ? K.PRIMARY : K.TEXT_MUTED;
              return (
                <div key={step.id} className="flex flex-1 items-center">
                  <button
                    onClick={() => jumpToStep(step.id)}
                    title={isDirty ? 'Bu adımda değişiklik yaptınız — yeniden kontrol edilmesi gerekiyor.' : undefined}
                    className="flex flex-1 items-center gap-3 px-3 py-2"
                    style={{ background: 'transparent', cursor: step.id <= currentStep ? 'pointer' : 'default', border: 'none', borderRadius: 10 }}
                  >
                    <div className="flex shrink-0 items-center justify-center"
                      style={{ width: 36, height: 36, borderRadius: 999, background: circleBg, color: circleColor, border: circleBorder, fontFamily: K.FONT_DISPLAY, fontWeight: 700, fontSize: 14 }}>
                      {isFreshCompleted ? <Check className="h-4 w-4" /> : isDirty ? '!' : step.id}
                    </div>
                    <div className="text-left hidden lg:block">
                      <p style={{ fontSize: 13, fontWeight: 600, color: titleColor, margin: 0 }}>{step.title}</p>
                      <p style={{ fontSize: 11, color: isDirty ? K.WARNING : K.TEXT_MUTED, margin: 0 }}>
                        {isDirty ? 'Değişiklik — kontrol gerekli' : step.description}
                      </p>
                    </div>
                  </button>
                  {idx < steps.length - 1 && (
                    <div className="shrink-0" style={{ height: 2, width: 40, background: isFreshCompleted ? K.PRIMARY : isDirty ? K.WARNING : K.BORDER_SOFT, borderRadius: 999 }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 16, padding: 28, boxShadow: K.SHADOW_CARD }}>
          {currentStep === 1 && (
            <BasicInfoStep
              title={title} setTitle={setTitle}
              description={description} setDescription={setDescription}
              instructorName={instructorName} setInstructorName={setInstructorName}
              selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory}
              categories={categories}
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              maxAttempts={maxAttempts} setMaxAttempts={setMaxAttempts}
              examDurationMinutes={examDurationMinutes} setExamDurationMinutes={setExamDurationMinutes}
              isCompulsory={isCompulsory} setIsCompulsory={setIsCompulsory}
              complianceDeadline={complianceDeadline} setComplianceDeadline={setComplianceDeadline}
              regulatoryBody={regulatoryBody} setRegulatoryBody={setRegulatoryBody}
              renewalPeriodMonths={renewalPeriodMonths} setRenewalPeriodMonths={setRenewalPeriodMonths}
              questionCount={trainingSummary.questionCount}
              passingScore={passingScore}
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
              activeMode={questionsActiveMode} setActiveMode={setQuestionsActiveMode}
              aiPending={aiPending} setAiPending={setAiPending}
              aiUploadedSources={aiUploadedSources} setAiUploadedSources={setAiUploadedSources}
              draftId={draftId}
            />
          )}
          {currentStep === 4 && (
            <>
              {publishError && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    background: 'var(--k-error-bg, #fef2f2)',
                    borderColor: 'var(--k-error, #dc2626)',
                    color: 'var(--k-error, #dc2626)',
                  }}
                >
                  <strong className="font-semibold">Yayın başarısız:</strong> {publishError}
                </div>
              )}
              <AssignStep
                selectedDepts={selectedDepts} setSelectedDepts={setSelectedDepts}
                excludedStaff={excludedStaff} setExcludedStaff={setExcludedStaff}
                expandedDept={expandedDept} setExpandedDept={setExpandedDept}
                deptSearch={deptSearch} setDeptSearch={setDeptSearch}
                trainingSummary={trainingSummary}
              />
            </>
          )}
        </div>

        <div className="flex justify-between items-center rounded-2xl px-6 py-4"
          style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, boxShadow: K.SHADOW_CARD }}>
          <Button variant="outline"
            onClick={() => (currentStep > 1 ? setCurrentStep(currentStep - 1) : router.push('/admin/trainings'))}
            className="gap-2 h-11 rounded-xl"
            style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}>
            <ArrowLeft className="h-4 w-4" />
            {currentStep === 1 ? 'Listeye Dön' : 'Önceki Adım'}
          </Button>

          <div className="flex items-center gap-1.5">
            {steps.map((step) => (
              <div key={step.id} className="h-1.5 rounded-full"
                style={{ width: step.id === currentStep ? '24px' : '8px', background: step.id <= currentStep ? K.PRIMARY : K.BORDER }} />
            ))}
          </div>

          {currentStep < 4 ? (
            <Button onClick={goToNextStep} className="gap-2 h-11 rounded-xl font-semibold text-white"
              style={{ background: K.PRIMARY, boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)' }}>
              Sonraki Adım <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button disabled={publishing || activeUploadCount > 0} onClick={handlePublish}
              className="gap-2 h-11 rounded-xl font-semibold text-white"
              style={{ background: K.PRIMARY, boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)' }}>
              <Sparkles className="h-4 w-4" /> {activeUploadCount > 0 ? 'Yükleme bekleniyor…' : 'Eğitimi Yayınla'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveStatusBadge({ saving, savedAt }: { saving: boolean; savedAt: Date | null }) {
  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: K.TEXT_MUTED }}>
        <CloudUpload size={12} className="animate-pulse" /> Kaydediliyor…
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: K.SUCCESS }}>
        <Check size={12} /> Kaydedildi
      </span>
    );
  }
  return null;
}

// Hint TS that UploadItem is used (helps tree-shaking analyzers).
export type { UploadItem };
