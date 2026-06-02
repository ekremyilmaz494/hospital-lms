'use client';

import './videos.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  CheckCircle2,
  Lock,
  ArrowRight,
  AlertTriangle,
  SkipForward,
  FileText,
  Maximize2,
  Minimize2,
  Shield,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(
  () => import('@/components/exam/pdf-viewer').then((m) => ({ default: m.PdfViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="vd-spin-wrap">
        <span className="vd-spin" />
      </div>
    ),
  }
);

const AudioPlayer = dynamic(
  () => import('@/components/exam/audio-player').then((m) => ({ default: m.AudioPlayer })),
  {
    ssr: false,
    loading: () => (
      <div className="vd-spin-wrap">
        <span className="vd-spin" />
      </div>
    ),
  }
);
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { attemptPhaseRedirect, type AttemptStatus } from '@/lib/exam-state-machine';
import { postWithRetry, type ExamPostResult, type ExamPostResultKind } from '@/lib/exam-fetch';
import { useToast } from '@/components/shared/toast';

interface VideoItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  contentType?: 'video' | 'pdf' | 'audio';
  pageCount?: number | null;
  documentUrl?: string;
  completed: boolean;
  lastPosition?: number;
  /** Gerçekte izlenen toplam süre (saniye) — mobil resume sayacı için. Web kullanmaz. */
  watchedSeconds?: number;
}

interface VideosResponse {
  trainingTitle?: string;
  videos: VideoItem[];
  attemptStatus?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const isReview = searchParams.get('mode') === 'review';
  const { toast } = useToast();

  const [startReady, setStartReady] = useState(isReview);
  const [startError, setStartError] = useState<string | null>(null);
  const startCalled = useRef(false);
  useEffect(() => {
    if (isReview || !id || startCalled.current) return;
    // Transition page son 5 saniye icinde start cagirdiysa skip et (cift POST onle)
    const recentStart = sessionStorage.getItem(`exam-start-${id}`);
    if (recentStart && Date.now() - Number(recentStart) < 5000) {
      startCalled.current = true;
      setStartReady(true);
      return;
    }
    startCalled.current = true;
    fetch(`/api/exam/${id}/start`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        // Zorunlu geri bildirim kilidi — bekleyen feedback varsa kullanıcıya bildir ve feedback sayfasına gönder.
        if (res.status === 423 && data?.pendingFeedback) {
          const { trainingId, trainingTitle, attemptId: pendingAttemptId } = data.pendingFeedback;
          toast(
            `"${trainingTitle}" eğitiminin zorunlu geri bildirimini doldurmadan başka eğitime başlayamazsınız.`,
            'warning'
          );
          router.replace(`/exam/${trainingId}/feedback?attemptId=${pendingAttemptId}`);
          return;
        }
        if (!res.ok) {
          setStartError(data?.error || 'Sınav başlatılamadı');
          return;
        }
        sessionStorage.setItem(`exam-start-${id}`, String(Date.now()));
        setStartReady(true);
      })
      .catch(() => setStartError('Sınav başlatılamadı. Lütfen tekrar deneyin.'));
  }, [id, isReview, router, toast]);

  const videosUrl = startReady ? `/api/exam/${id}/videos${isReview ? '?mode=review' : ''}` : null;
  // noStore ZORUNLU: video ilerlemesi (lastPosition) her mount'ta sunucudan taze gelmeli.
  // useFetch'in modül-level cache'i SPA geri dönüşünde (geri tuşu → tekrar "Videoları İzle")
  // bayat lastPosition=0 servis ediyordu; onLoadedMetadata'daki resume seek'i atlanıyor ve
  // video baştan başlıyordu ("kaldığım yerden devam etmiyor" şikayeti — Haziran 2026).
  // Sunucu yanıtı zaten Cache-Control: private, no-store (route.ts) — client tarafı da uyar.
  const { data, isLoading, error } = useFetch<VideosResponse>(videosUrl, { noStore: true });

  const rawVideos = data?.videos ?? [];
  const trainingTitle = data?.trainingTitle ?? '';

  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const videosData = rawVideos.map((v) => ({
    ...v,
    completed: v.completed || localCompleted.has(v.id),
  }));
  const videosRef = useRef(videosData);

  const mediaItems = videosData.filter((v) => v.contentType !== 'pdf');
  const pdfItems = videosData.filter((v) => v.contentType === 'pdf');
  const isMixed = mediaItems.length > 0 && pdfItems.length > 0;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(-1);
  const [currentMediaIdx, setCurrentMediaIdx] = useState(-1);
  const [currentPdfIdx, setCurrentPdfIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const lastAllowedTime = useRef(0);
  const [orientationHintDismissed, setOrientationHintDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = sessionStorage.getItem('vd-orientation-hint-dismissed') === '1';
    setOrientationHintDismissed(dismissed);
  }, []);

  const dismissOrientationHint = useCallback(() => {
    setOrientationHintDismissed(true);
    try {
      sessionStorage.setItem('vd-orientation-hint-dismissed', '1');
    } catch {}
  }, []);

  const changeVideo = useCallback((idx: number) => {
    setCurrentVideoIdx(idx);
    lastAllowedTime.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setVideoError(false);
    setIsBuffering(false);
  }, []);

  useEffect(() => {
    videosRef.current = videosData;
  }, [videosData]);

  useEffect(() => {
    if (videosData.length > 0 && currentVideoIdx === -1) {
      const firstIncomplete = videosData.findIndex((v) => !v.completed);
      setCurrentVideoIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
    if (mediaItems.length > 0 && currentMediaIdx === -1) {
      const firstIncomplete = mediaItems.findIndex((v) => !v.completed);
      setCurrentMediaIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
    if (pdfItems.length > 0 && currentPdfIdx === -1) {
      const firstIncomplete = pdfItems.findIndex((v) => !v.completed);
      setCurrentPdfIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    videosData.length,
    mediaItems.length,
    pdfItems.length,
    currentVideoIdx,
    currentMediaIdx,
    currentPdfIdx,
  ]);

  const singleCurrent = videosData[currentVideoIdx >= 0 ? currentVideoIdx : 0];
  const activeMedia = mediaItems[currentMediaIdx >= 0 ? currentMediaIdx : 0];
  const activePdf = pdfItems[currentPdfIdx >= 0 ? currentPdfIdx : 0];
  const currentVideo = isMixed ? activeMedia : singleCurrent;
  // O5: PDF içerikleri son sınava geçiş için OPSİYONEL — sunucu da öyle sayıyor.
  // "Son Sınava Git" gating'i yalnız video/ses içeriğine (mediaItems) bağlı.
  // Boş mediaItems → every() true döner (yalnızca PDF olan eğitimde sınav açık).
  const allCompleted = mediaItems.every((v) => v.completed);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

  // Telemetry — playback anomaly event'lerini server'a yazar (best-effort, sessiz fail).
  // Plan: idm-aws-taraf-nda-bir-dynamic-wirth.md Faz 1. Network metrikleri ile birlikte
  // "video duraklıyor" şikayetinin gerçek root cause'unu (buffer underrun, CDN MISS,
  // MEDIA_ERR_NETWORK, vs.) ölçmek için. currentVideo bu satıra göre yukarıda tanımlı.
  const reportVideoEvent = useCallback(
    (event: string, extra: Record<string, unknown> = {}) => {
      const v = videoRef.current;
      const conn = (
        navigator as unknown as {
          connection?: { effectiveType?: string; downlink?: number; rtt?: number };
        }
      ).connection;
      const payload = {
        event,
        videoId: currentVideo?.id ?? null,
        currentTime: v?.currentTime ?? null,
        duration: v?.duration ?? null,
        readyState: v?.readyState ?? null,
        networkState: v?.networkState ?? null,
        bufferedEnd: v?.buffered?.length ? v.buffered.end(v.buffered.length - 1) : null,
        effectiveType: conn?.effectiveType ?? null,
        downlink: conn?.downlink ?? null,
        rtt: conn?.rtt ?? null,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        timestamp: Date.now(),
        ...extra,
      };
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        // sendBeacon: oynatma kesilse bile (örn. sekme kapanması) garantili teslimat
        if (navigator.sendBeacon?.('/api/telemetry/video-event', blob)) return;
      } catch {
        /* sendBeacon yoksa fetch'e düş */
      }
      fetch('/api/telemetry/video-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {
        /* telemetry best-effort */
      });
    },
    [currentVideo?.id]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.muted || volume === 0) {
      const restored = volume === 0 ? 0.7 : volume;
      video.muted = false;
      video.volume = restored;
      setVolume(restored);
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
  }, [volume]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    video.muted = val === 0;
    setVolume(val);
    setIsMuted(val === 0);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) await playerContainerRef.current?.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      /* fullscreen not supported */
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isReview) {
      setCurrentTime(video.currentTime);
      return;
    }
    if (video.currentTime > lastAllowedTime.current + 2) {
      video.currentTime = lastAllowedTime.current;
    } else {
      lastAllowedTime.current = Math.max(lastAllowedTime.current, video.currentTime);
    }
    setCurrentTime(video.currentTime);
  }, [isReview]);

  const goToNextVideo = useCallback(() => {
    if (isMixed) {
      if (currentMediaIdx < mediaItems.length - 1) {
        setCurrentMediaIdx(currentMediaIdx + 1);
        lastAllowedTime.current = 0;
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setVideoError(false);
      }
    } else if (currentVideoIdx < videosData.length - 1) {
      changeVideo(currentVideoIdx + 1);
    }
  }, [
    isMixed,
    currentMediaIdx,
    mediaItems.length,
    currentVideoIdx,
    videosData.length,
    changeVideo,
  ]);

  // Kayıt durumu: 'idle' = sorun yok, 'error' = retry'lar tükendi (ilerleme kaydedilemiyor).
  const [saveStatus, setSaveStatus] = useState<'idle' | 'error'>('idle');
  // Kalıcı hata (eğitim/içerik silinmiş, oturum bitmiş) — tam ekran modal tetikler.
  const [fatalError, setFatalError] = useState<{ title: string; message: string } | null>(null);
  const fatalHandledRef = useRef(false);

  // Çevrimiçi durumu — kayıt hatası banner'ının metnini belirler. "İnternetini
  // kontrol et" suçlaması YALNIZ tarayıcı kesin offline (navigator.onLine === false)
  // iken gösterilir; aksi halde arıza sunucu/geçici olabilir, kullanıcıyı suçlama.
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const sync = () => setIsOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  /**
   * Video POST'unun kalıcı (retry edilemez) hatalarını tek noktada karşılar:
   * oturum bitti → login; faz geçersiz/içerik silinmiş → tam ekran bilgilendirme.
   */
  const handleVideoPostFailure = useCallback((kind: ExamPostResultKind) => {
    if (fatalHandledRef.current) return;
    fatalHandledRef.current = true;
    videoRef.current?.pause();
    if (kind === 'session-expired') {
      // Oturum doldu — use-fetch.ts ile aynı loop-guard'lı login redirect.
      if (typeof window !== 'undefined') {
        const now = Date.now();
        const last = Number(sessionStorage.getItem('auth_redirect_at') || '0');
        const count = Number(sessionStorage.getItem('auth_redirect_count') || '0');
        if (now - last < 30000 && count >= 1) {
          sessionStorage.removeItem('auth_redirect_count');
          setFatalError({
            title: 'Oturum doğrulanamadı',
            message: 'Lütfen sayfayı yenileyip tekrar giriş yapın.',
          });
          return;
        }
        sessionStorage.setItem('auth_redirect_count', String(now - last < 30000 ? count + 1 : 1));
        sessionStorage.setItem('auth_redirect_at', String(now));
        window.location.href = '/auth/login?reason=session_expired';
      }
      return;
    }
    if (kind === 'content-gone') {
      setFatalError({
        title: 'İçerik bulunamadı',
        message: 'Bu eğitim içeriği artık mevcut değil. Lütfen eğitim sayfasına dönün.',
      });
    } else {
      // phase-invalid (400) + locked (423): attempt artık video izleme fazında değil.
      setFatalError({
        title: 'Eğitim oturumu geçersiz',
        message:
          'Bu eğitim oturumu artık geçerli değil. Eğitim güncellenmiş veya süresi dolmuş olabilir.',
      });
    }
  }, []);

  /**
   * Tüm video ilerleme POST'larının tek geçiş noktası: backoff'lu retry (geçici hata),
   * HTTP kodu sınıflandırması ve kayıt durumu göstergesi burada toplanır.
   */
  const postVideoProgress = useCallback(
    async (
      body: Record<string, unknown>,
      opts?: { signal?: AbortSignal }
    ): Promise<ExamPostResult<{ allVideosCompleted?: boolean }>> => {
      const result = await postWithRetry<{ allVideosCompleted?: boolean }>(
        `/api/exam/${id}/videos`,
        body,
        { signal: opts?.signal }
      );
      if (result.kind === 'ok') {
        setSaveStatus('idle');
      } else if (result.kind === 'aborted') {
        // İstek iptal edildi: video duraklatma, sonraki içeriğe geçiş veya sayfa
        // değişimi. Bu bir KAYIT HATASI DEĞİL — DevTools'ta `(canceled)` görünür.
        // İlerleme bir sonraki heartbeat ya da lastPosition koruması ile yine
        // yazılır. saveStatus'a dokunma: yanlış "internet" banner'ını tetikleme.
      } else if (result.kind === 'transient') {
        setSaveStatus('error');
      } else {
        handleVideoPostFailure(result.kind);
      }
      return result;
    },
    [id, handleVideoPostFailure]
  );

  /** Video duraklatıldığında mevcut pozisyonu hemen kaydeder (A-2: pause + uyku kaybı). */
  const flushVideoPosition = useCallback(() => {
    if (isReview || fatalHandledRef.current) return;
    const video = videoRef.current;
    const time = video?.currentTime ?? 0;
    // Doğal bitişte handleVideoEnded zaten POST atıyor; video değiştirirken time=0
    // gelen pause'u da ele — çift POST ve sıfır pozisyon yazımı önlenir.
    if (!currentVideo || time <= 0 || video?.ended) return;
    postVideoProgress({ videoId: currentVideo.id, watchedTime: time, position: time });
  }, [isReview, currentVideo, postVideoProgress]);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (!currentVideo) return;

    const vids = videosRef.current;
    const activeIdx = isMixed ? vids.findIndex((v) => v.id === currentVideo.id) : currentVideoIdx;
    const isLastVideo = isMixed
      ? currentMediaIdx >= mediaItems.length - 1
      : activeIdx >= vids.length - 1;
    const remainingIncomplete = vids.filter((v) => !v.completed && v.id !== currentVideo.id).length;

    setLocalCompleted((prev) => new Set(prev).add(currentVideo.id));
    videosRef.current = vids.map((v) => (v.id === currentVideo.id ? { ...v, completed: true } : v));

    if (isReview) {
      if (!isLastVideo) setTimeout(() => goToNextVideo(), 1500);
      return;
    }

    postVideoProgress({
      videoId: currentVideo.id,
      watchedTime: duration,
      position: duration,
      completed: true,
    }).then((result) => {
      if (result.kind === 'ok') {
        // Navigasyon yalnızca başarılı kayıttan sonra — kalıcı hatada modal açılır.
        if (
          remainingIncomplete === 0 ||
          (isLastVideo && vids.filter((v) => !v.completed).length <= 1)
        ) {
          setTimeout(() => router.replace(`/exam/${id}/transition?from=videos`), 800);
        } else if (!isLastVideo) {
          setTimeout(() => goToNextVideo(), 1500);
        }
      } else if (result.kind === 'transient') {
        // Geçici hata — iyimser tamamlamayı geri al, kullanıcı tekrar deneyebilsin.
        setLocalCompleted((prev) => {
          const next = new Set(prev);
          next.delete(currentVideo.id);
          return next;
        });
        videosRef.current = vids;
      }
    });
  }, [
    currentVideo,
    id,
    duration,
    currentVideoIdx,
    goToNextVideo,
    router,
    isMixed,
    currentMediaIdx,
    mediaItems.length,
    isReview,
    postVideoProgress,
  ]);

  useEffect(() => {
    if (isReview || !isPlaying || !currentVideo) return;
    // Deps'e ne `currentTime` ne de `currentVideo` (obje) EKLENMEZ:
    //   - `currentTime` 250ms'de bir setState ile değişir.
    //   - `currentVideo` her render'da `videosData = rawVideos.map(...)` çıktısından
    //     yeni obje referansı alır (içeriği aynı olsa bile).
    // Her ikisi de interval'i sürekli resetler → 15sn timer hiç ateşlenmez,
    // server lastPosition güncellenemez (PR #137 yarım kalmıştı). Sadece kararlı
    // değişkenleri (id, isPlaying) deps'e koy; çalışma zamanı pozisyonunu
    // canlı kaynaktan (videoRef) oku.
    const videoId = currentVideo.id;
    // AbortController: video duraklatılınca/unmount olunca bekleyen retry'lar iptal olur.
    const controller = new AbortController();
    const heartbeat = setInterval(() => {
      const time = videoRef.current?.currentTime ?? 0;
      postVideoProgress(
        { videoId, watchedTime: time, position: time },
        { signal: controller.signal }
      );
    }, 15000);
    return () => {
      clearInterval(heartbeat);
      controller.abort();
    };
    // currentVideo (obje) deps'e EKLENMEZ — her render yeni ref üretir, 15sn timer
    // hiç ateşlenmez. postVideoProgress useCallback ile stabil, churn yaratmaz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, currentVideo?.id, id, isReview, postVideoProgress]);

  useEffect(() => {
    const flushPosition = () => {
      const video = videoRef.current;
      if (video && !video.paused) video.pause();
      // Pozisyonu canlı kaynaktan oku; `currentTime` state'i deps'e konursa
      // 250ms'de bir listener re-mount olur, gereksiz GC + listener trashing.
      const time = video?.currentTime ?? 0;
      if (isReview || !currentVideo || time <= 0) return;
      const payload = JSON.stringify({
        videoId: currentVideo.id,
        watchedTime: time,
        position: time,
      });
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(`/api/exam/${id}/videos`, blob);
    };
    const handleVisibility = () => {
      if (!document.hidden) return;
      // Sekme gizlendi: önce video'yu durdur, sonra pozisyonu hemen flush et.
      flushPosition();
    };
    // iOS Safari `pagehide` arka plana atılmada visibilitychange'den önce/yerine
    // tetiklenebilir; bfcache uyumlu redundant flush noktası.
    const handlePageHide = () => flushPosition();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
    // `currentVideo` (obje) deps'e EKLENMEZ — videosData.map() her render yeni ref
    // üretir, listener'lar gereksiz yere add/remove edilir. .id stabil string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id, id, isReview]);

  useEffect(() => {
    const pos = currentVideo?.lastPosition ?? 0;
    queueMicrotask(() => setCurrentTime(pos > 0 ? pos : 0));
  }, [currentVideo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isReview) return;
    const saveOnExit = () => {
      const time = videoRef.current?.currentTime ?? 0;
      if (currentVideo && time > 0) {
        const payload = JSON.stringify({
          videoId: currentVideo.id,
          watchedTime: time,
          position: time,
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`/api/exam/${id}/videos`, blob);
      }
    };
    // D1: `pagehide` flush'ı yukarıdaki effect'te (handlePageHide → flushPosition)
    // zaten kayıtlı — burada tekrar kaydetmek mükerrer sendBeacon yaratırdı.
    // Burada yalnız `beforeunload` ve SPA-unmount cleanup flush'ı kalır.
    window.addEventListener('beforeunload', saveOnExit);
    return () => {
      // SPA navigation (router.back / router.push / Link tıkı) pagehide veya
      // beforeunload tetiklemez — sadece component unmount fırlar. Heartbeat
      // de devre dışı kaldığı sürece (bkz. dep churn yorumu) flush'sız çıkış
      // kullanıcının tüm ilerlemesini sıfırlar. Cleanup içinde bir kez daha
      // sendBeacon at; server tarafı lastPositionSeconds geri-gitme koruması
      // sayesinde tekrar yazım sorun çıkarmaz.
      saveOnExit();
      window.removeEventListener('beforeunload', saveOnExit);
    };
    // `currentVideo` (obje) deps'e EKLENMEZ — yeni ref'le re-mount listener trashing yapar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVideo?.id, id, isReview]);

  useEffect(() => {
    if (isReview) return;
    if (!data?.attemptStatus) return;
    const redirect = attemptPhaseRedirect(data.attemptStatus as AttemptStatus, 'videos');
    if (redirect) {
      const path =
        redirect === 'my-trainings'
          ? '/staff/my-trainings'
          : redirect === 'my-training-detail'
            ? `/staff/my-trainings/${id}`
            : `/exam/${id}/${redirect}`;
      router.replace(path);
    }
  }, [data?.attemptStatus, id, router, isReview]);

  if ((!startReady && !startError) || isLoading) return <PageLoading />;

  if (startError || error) {
    return (
      <div className="vd-page-empty">
        <div className="vd-page-empty-icon">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2>İçerik yüklenemedi</h2>
        <p>{startError || error}</p>
        <button onClick={() => router.back()} className="vd-page-empty-link">
          ← Geri Dön
        </button>
        <style>{`
          .vd-page-empty { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 10px; max-width: 420px; margin: 0 auto; }
          .vd-page-empty-icon { width: 56px; height: 56px; border-radius: 4px; background: var(--k-error-bg); color: var(--k-error); display: flex; align-items: center; justify-content: center; }
          .vd-page-empty h2 { font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; font-size: 20px; color: var(--ed-ink); margin: 0; }
          .vd-page-empty p { font-size: 13px; color: var(--ed-ink-soft); margin: 0; }
          .vd-page-empty-link { background: none; border: none; color: var(--ed-ink); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        `}</style>
      </div>
    );
  }

  // Çalışma anında kalıcı hata (eğitim/içerik silinmiş, oturum bitmiş) — POST 4xx döndü.
  if (fatalError) {
    return (
      <div className="vd-page-empty">
        <div className="vd-page-empty-icon">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2>{fatalError.title}</h2>
        <p>{fatalError.message}</p>
        <button
          onClick={() => router.replace(`/staff/my-trainings/${id}`)}
          className="vd-page-empty-link"
        >
          ← Eğitim Sayfasına Dön
        </button>
        <style>{`
          .vd-page-empty { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 10px; max-width: 420px; margin: 0 auto; }
          .vd-page-empty-icon { width: 56px; height: 56px; border-radius: 4px; background: var(--k-error-bg); color: var(--k-error); display: flex; align-items: center; justify-content: center; }
          .vd-page-empty h2 { font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; font-size: 20px; color: var(--ed-ink); margin: 0; }
          .vd-page-empty p { font-size: 13px; color: var(--ed-ink-soft); margin: 0; }
          .vd-page-empty-link { background: none; border: none; color: var(--ed-ink); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        `}</style>
      </div>
    );
  }

  // attemptPhaseRedirect bu status'lerde redirect tetikliyor — bir tick boyunca
  // boş içerik yerine loading göster; aksi halde "render → effect → replace"
  // arasında 1-2 frame video player iskeleti flash ediyor.
  if (
    !isReview &&
    (data?.attemptStatus === 'pre_exam' ||
      data?.attemptStatus === 'post_exam' ||
      data?.attemptStatus === 'completed' ||
      data?.attemptStatus === 'expired')
  )
    return <PageLoading />;

  if (videosData.length === 0) {
    return (
      <div className="vd-empty">
        <div className="vd-empty-icon">
          <Play className="h-6 w-6" />
        </div>
        <h2>Bu eğitimde içerik bulunmuyor</h2>
        <p>Eğitim videoları henüz eklenmemiş. Doğrudan son sınava geçebilirsiniz.</p>
        <div className="vd-empty-actions">
          <button onClick={() => router.back()} className="vd-btn vd-btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            <span>Geri Dön</span>
          </button>
          <button
            onClick={() => router.replace(`/exam/${id}/transition?from=videos`)}
            className="vd-btn vd-btn-primary"
          >
            <span>Son Sınava Geç</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <style>{`
          .vd-empty { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 12px; max-width: 440px; margin: 0 auto; }
          .vd-empty-icon { width: 64px; height: 64px; border-radius: 4px; background: var(--ed-cream); color: var(--ed-ink); display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
          .vd-empty h2 { font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; font-size: 22px; font-weight: 500; color: var(--ed-ink); margin: 0; }
          .vd-empty p { font-size: 13px; color: var(--ed-ink-soft); margin: 0; }
          .vd-empty-actions { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }
          .vd-btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 4px; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 600; border: 1px solid transparent; cursor: pointer; text-decoration: none; }
          .vd-btn-ghost { background: transparent; color: var(--ed-ink-soft); border-color: var(--ed-rule); }
          .vd-btn-ghost:hover { border-color: var(--ed-ink); color: var(--ed-ink); }
          .vd-btn-primary { background: var(--ed-ink); color: var(--ed-cream); border-color: var(--ed-ink); }
        .vd-btn-primary :global(svg) { color: var(--ed-cream); }
          .vd-btn-primary:hover { background: var(--ed-olive); }
        `}</style>
      </div>
    );
  }

  if (!currentVideo) return null;

  // Y2: resolveTrainingVideoUrl() S3/CloudFront imzalama hatası veya eksik
  // videoKey durumunda '' döner. Boş `src` ile <video>/<AudioPlayer>/<PdfViewer>
  // render edilirse: boş src `error` event'i fırlatmaz → onError çalışmaz →
  // hata UI'ı görünmez → onLoadedMetadata hiç tetiklenmez → personel kalıcı takılır.
  // Oynatıcıyı render etmeden ÖNCE açık bir hata durumu göster.
  // PDF'in ayrı `documentUrl`'üne dokunulmaz — yalnız ana `url` boşsa engellenir.
  if (!currentVideo.url) {
    return (
      <div className="vd-page-empty">
        <div className="vd-page-empty-icon">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2>İçerik şu anda yüklenemiyor</h2>
        <p>Bu içeriğe şu anda erişilemiyor. Lütfen daha sonra tekrar deneyin.</p>
        <button onClick={() => router.back()} className="vd-page-empty-link">
          ← Geri Dön
        </button>
        <style>{`
          .vd-page-empty { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 10px; max-width: 420px; margin: 0 auto; }
          .vd-page-empty-icon { width: 56px; height: 56px; border-radius: 4px; background: var(--k-error-bg); color: var(--k-error); display: flex; align-items: center; justify-content: center; }
          .vd-page-empty h2 { font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; font-size: 20px; color: var(--ed-ink); margin: 0; }
          .vd-page-empty p { font-size: 13px; color: var(--ed-ink-soft); margin: 0; }
          .vd-page-empty-link { background: none; border: none; color: var(--ed-ink); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        `}</style>
      </div>
    );
  }

  const completedCount = videosData.filter((v) => v.completed).length;

  return (
    <div className="vd-root">
      {saveStatus === 'error' && (
        <div className="vd-heartbeat-err">
          {isOnline
            ? 'İlerlemen kaydedilirken bir gecikme oldu — otomatik yeniden denenecek, sayfada kalman yeterli.'
            : 'İlerlemen kaydedilemiyor — internet bağlantını kontrol et. Bağlantı gelince otomatik kaydedilir.'}
        </div>
      )}
      {!orientationHintDismissed && (
        <div className="vd-orient-hint" role="status">
          <span className="vd-orient-hint-text">Daha iyi deneyim için telefonu yatay tutun.</span>
          <button
            type="button"
            onClick={dismissOrientationHint}
            className="vd-orient-hint-close"
            aria-label="Bildirimi kapat"
          >
            ×
          </button>
        </div>
      )}

      {/* ═══════ Header ═══════ */}
      <header className="vd-header">
        <div className="vd-header-left">
          <button onClick={() => router.back()} className="vd-back" aria-label="Geri">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="vd-header-title">
            <span className="vd-header-eyebrow">{isReview ? 'İnceleme' : 'Eğitim İçeriği'}</span>
            <h1>{trainingTitle}</h1>
            <p>
              {isMixed
                ? `${completedCount}/${videosData.length} tamamlandı`
                : `İçerik ${currentVideoIdx + 1}/${videosData.length}`}
            </p>
          </div>
        </div>
        <div className="vd-header-right">
          {isReview ? (
            <span className="vd-chip vd-chip-ink">
              <Shield className="h-3.5 w-3.5" />
              <span>İnceleme Modu</span>
            </span>
          ) : (
            currentVideo?.contentType !== 'pdf' && (
              <span className="vd-chip vd-chip-amber">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span>Hızlandırma Engelli</span>
              </span>
            )
          )}
        </div>
      </header>

      {/* ═══════ Body ═══════ */}
      <div className="vd-body">
        <div className={`vd-main ${isMixed ? 'vd-main-mixed' : ''}`}>
          {isMixed && activePdf && (
            <div className="vd-pdf-wrap vd-pdf-wrap-mixed">
              <PdfViewer
                key={activePdf.id}
                url={activePdf.url}
                pageCount={activePdf.pageCount}
                onPageChange={(page) => {
                  if (isReview) return;
                  postVideoProgress({ videoId: activePdf.id, currentPage: page });
                }}
                onComplete={() => {
                  const vids = videosRef.current;
                  setLocalCompleted((prev) => new Set(prev).add(activePdf.id));
                  videosRef.current = vids.map((v) =>
                    v.id === activePdf.id ? { ...v, completed: true } : v
                  );
                  if (isReview) return;
                  postVideoProgress({
                    videoId: activePdf.id,
                    currentPage: activePdf.pageCount ?? 1,
                    completed: true,
                  }).then((result) => {
                    if (result.kind === 'ok') {
                      if (result.data?.allVideosCompleted) {
                        setTimeout(() => router.replace(`/exam/${id}/transition?from=videos`), 800);
                      } else if (currentPdfIdx < pdfItems.length - 1) {
                        setTimeout(() => setCurrentPdfIdx(currentPdfIdx + 1), 1200);
                      }
                    } else if (result.kind === 'transient') {
                      setLocalCompleted((prev) => {
                        const next = new Set(prev);
                        next.delete(activePdf.id);
                        return next;
                      });
                      videosRef.current = vids;
                    }
                  });
                }}
              />
            </div>
          )}

          <div className={isMixed ? 'vd-media-col' : ''}>
            {currentVideo.contentType === 'audio' ? (
              <div className="vd-audio-wrap">
                <AudioPlayer
                  key={currentVideo.id}
                  src={currentVideo.url}
                  documentUrl={currentVideo.documentUrl}
                  title={currentVideo.title}
                  duration={currentVideo.duration}
                  lastPosition={currentVideo.lastPosition}
                  onProgress={(watchedTime, position) => {
                    if (isReview) return;
                    postVideoProgress({ videoId: currentVideo.id, watchedTime, position });
                  }}
                  onComplete={() => {
                    const vids = videosRef.current;
                    setLocalCompleted((prev) => new Set(prev).add(currentVideo.id));
                    videosRef.current = vids.map((v) =>
                      v.id === currentVideo.id ? { ...v, completed: true } : v
                    );
                    if (isReview) return;
                    postVideoProgress({
                      videoId: currentVideo.id,
                      watchedTime: currentVideo.duration,
                      position: currentVideo.duration,
                      completed: true,
                    }).then((result) => {
                      if (result.kind === 'ok') {
                        if (result.data?.allVideosCompleted) {
                          setTimeout(
                            () => router.replace(`/exam/${id}/transition?from=videos`),
                            800
                          );
                        }
                      } else if (result.kind === 'transient') {
                        setLocalCompleted((prev) => {
                          const next = new Set(prev);
                          next.delete(currentVideo.id);
                          return next;
                        });
                        videosRef.current = vids;
                      }
                    });
                  }}
                />
              </div>
            ) : currentVideo.contentType === 'pdf' ? (
              <div className="vd-pdf-wrap vd-pdf-wrap-full">
                <PdfViewer
                  url={currentVideo.url}
                  pageCount={currentVideo.pageCount}
                  onPageChange={(page) => {
                    if (isReview) return;
                    postVideoProgress({ videoId: currentVideo.id, currentPage: page });
                  }}
                  onComplete={() => {
                    const vids = videosRef.current;
                    setLocalCompleted((prev) => new Set(prev).add(currentVideo.id));
                    videosRef.current = vids.map((v) =>
                      v.id === currentVideo.id ? { ...v, completed: true } : v
                    );
                    if (isReview) return;
                    postVideoProgress({
                      videoId: currentVideo.id,
                      currentPage: currentVideo.pageCount ?? 1,
                      completed: true,
                    }).then((result) => {
                      if (result.kind === 'ok') {
                        if (result.data?.allVideosCompleted) {
                          setTimeout(
                            () => router.replace(`/exam/${id}/transition?from=videos`),
                            800
                          );
                        }
                      } else if (result.kind === 'transient') {
                        setLocalCompleted((prev) => {
                          const next = new Set(prev);
                          next.delete(currentVideo.id);
                          return next;
                        });
                        videosRef.current = vids;
                      }
                    });
                  }}
                />
              </div>
            ) : (
              /* ── Video player ── */
              <div ref={playerContainerRef} className="vd-player">
                <div className="vd-player-viewport" onContextMenu={(e) => e.preventDefault()}>
                  {videoError ? (
                    <div className="vd-player-error">
                      <AlertTriangle className="h-10 w-10" />
                      <h3>Video yüklenemedi</h3>
                      <p>Video dosyası bulunamadı veya erişim izni yok.</p>
                      <button
                        onClick={() => {
                          setVideoError(false);
                          videoRef.current?.load();
                        }}
                      >
                        Tekrar Dene
                      </button>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      key={currentVideo.id}
                      src={currentVideo.url}
                      className="vd-video"
                      controlsList="nodownload noplaybackrate"
                      disablePictureInPicture
                      playsInline
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={() => {
                        const video = videoRef.current;
                        if (video) {
                          setDuration(video.duration);
                          if (currentVideo.lastPosition && currentVideo.lastPosition > 0) {
                            video.currentTime = currentVideo.lastPosition;
                            lastAllowedTime.current = currentVideo.lastPosition;
                          }
                        }
                      }}
                      onPlay={() => {
                        setIsPlaying(true);
                        setIsBuffering(false);
                      }}
                      onPause={() => {
                        setIsPlaying(false);
                        flushVideoPosition();
                      }}
                      onPlaying={() => setIsBuffering(false)}
                      onEnded={handleVideoEnded}
                      onWaiting={() => {
                        // Browser buffer'ı bekliyor — donmuş değil, yükleniyor.
                        // "Duraklıyor" şikayetlerinin en yaygın nedeni: kullanıcıya görsel
                        // geri bildirim yoktu. Plan: idm-aws-taraf-nda-bir-dynamic-wirth.md
                        setIsBuffering(true);
                        reportVideoEvent('waiting');
                      }}
                      onCanPlay={() => {
                        setIsBuffering(false);
                        reportVideoEvent('canplay');
                      }}
                      onStalled={() => reportVideoEvent('stalled')}
                      onSuspend={() => reportVideoEvent('suspend')}
                      onAbort={() => reportVideoEvent('abort')}
                      onError={(e) => {
                        const err = (e.target as HTMLVideoElement).error;
                        // MEDIA_ERR code'ları: 1=ABORTED, 2=NETWORK, 3=DECODE, 4=SRC_NOT_SUPPORTED.
                        // Telemetry'de ayrı tutulur ki "video dosyası bozuk" (3) ile
                        // "byte-range fetch fail" (2) karışmasın.
                        reportVideoEvent('error', {
                          errorCode: err?.code ?? null,
                          errorMessage: err?.message ?? null,
                        });
                        setIsBuffering(false);
                        setVideoError(true);
                      }}
                      onSeeking={() => {
                        if (isReview) return;
                        const video = videoRef.current;
                        if (video && video.currentTime > lastAllowedTime.current + 2) {
                          video.currentTime = lastAllowedTime.current;
                        }
                      }}
                    />
                  )}
                  {!videoError && !isPlaying && !isBuffering && (
                    <button onClick={togglePlay} className="vd-play-overlay" aria-label="Oynat">
                      <span>
                        <Play className="h-8 w-8" fill="currentColor" />
                      </span>
                    </button>
                  )}
                  {!videoError && isBuffering && (
                    <div className="vd-buffer-overlay" role="status" aria-live="polite">
                      <span className="vd-buffer-spinner" aria-hidden="true" />
                      <span className="vd-buffer-text">Video yükleniyor…</span>
                    </div>
                  )}
                </div>

                <div className={`vd-controls ${isFullscreen ? 'vd-controls-fs' : ''}`}>
                  <div className="vd-progress-track">
                    <div className="vd-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="vd-controls-row">
                    <div className="vd-controls-left">
                      <button
                        onClick={togglePlay}
                        className="vd-play-btn"
                        aria-label={isPlaying ? 'Duraklat' : 'Oynat'}
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" fill="currentColor" />
                        )}
                      </button>
                      <button
                        onClick={toggleMute}
                        className="vd-ctrl-btn"
                        aria-label={isMuted ? 'Sesi aç' : 'Sessiz'}
                      >
                        {isMuted || volume === 0 ? (
                          <VolumeX className="h-4 w-4" />
                        ) : (
                          <Volume2 className="h-4 w-4" />
                        )}
                      </button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="vd-volume"
                      />
                      <span className="vd-time">
                        {formatTime(currentTime)} / {formatTime(duration || currentVideo.duration)}
                      </span>
                    </div>
                    <div className="vd-controls-right">
                      {currentVideo.completed &&
                        (isMixed
                          ? currentMediaIdx < mediaItems.length - 1
                          : currentVideoIdx < videosData.length - 1) && (
                          <button onClick={goToNextVideo} className="vd-next-btn">
                            <SkipForward className="h-3.5 w-3.5" />
                            <span>Sonraki</span>
                          </button>
                        )}
                      <button
                        onClick={toggleFullscreen}
                        className="vd-ctrl-btn"
                        aria-label={isFullscreen ? 'Pencere' : 'Tam ekran'}
                      >
                        {isFullscreen ? (
                          <Minimize2 className="h-4 w-4" />
                        ) : (
                          <Maximize2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {!isFullscreen && (
                    <div className="vd-notes">
                      <Lock className="h-3 w-3" />
                      <span>1.0x sabit</span>
                      <span className="vd-notes-sep">·</span>
                      <span>İleri sarma kapalı</span>
                      <span className="vd-notes-sep">·</span>
                      <span>İndirme kapalı</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ═══════ Sidebar — content list ═══════ */}
        <aside className="vd-sidebar">
          <header className="vd-sidebar-head">
            <h2>İçerik Listesi</h2>
            <span className="vd-sidebar-count">
              <strong>{completedCount.toString().padStart(2, '0')}</strong>/
              <strong>{videosData.length.toString().padStart(2, '0')}</strong>
            </span>
          </header>

          {isMixed ? (
            <div className="vd-list-groups">
              <div>
                <h3 className="vd-list-group-title">Videolar & Ses</h3>
                <div className="vd-list">
                  {mediaItems.map((v, i) => {
                    const firstIncomplete = mediaItems.findIndex((x) => !x.completed);
                    const isLocked = !v.completed && firstIncomplete >= 0 && i > firstIncomplete;
                    return renderItem(v, {
                      isCurrent: i === currentMediaIdx,
                      isLocked,
                      duration: i === currentMediaIdx ? duration : 0,
                      onSelect: () => {
                        setCurrentMediaIdx(i);
                        lastAllowedTime.current = 0;
                        setCurrentTime(0);
                        setDuration(0);
                        setIsPlaying(false);
                        setVideoError(false);
                      },
                    });
                  })}
                </div>
              </div>
              <div>
                <h3 className="vd-list-group-title">Dokümanlar</h3>
                <div className="vd-list">
                  {pdfItems.map((v, i) => {
                    const firstIncomplete = pdfItems.findIndex((x) => !x.completed);
                    const isLocked = !v.completed && firstIncomplete >= 0 && i > firstIncomplete;
                    return renderItem(v, {
                      isCurrent: i === currentPdfIdx,
                      isLocked,
                      duration: 0,
                      onSelect: () => setCurrentPdfIdx(i),
                    });
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="vd-list">
              {videosData.map((v, i) => {
                const isCurrent = i === currentVideoIdx;
                const isLocked = !v.completed && i > videosData.findIndex((x) => !x.completed);
                return renderItem(v, {
                  isCurrent,
                  isLocked,
                  duration: isCurrent ? duration : 0,
                  onSelect: () => changeVideo(i),
                });
              })}
            </div>
          )}

          <footer className="vd-sidebar-foot">
            {isReview ? (
              <button
                onClick={() => router.push('/staff/my-trainings')}
                className="vd-btn vd-btn-primary vd-btn-full"
              >
                <span>Eğitimi Kapat</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : allCompleted ? (
              <button
                onClick={() => router.replace(`/exam/${id}/transition?from=videos`)}
                className="vd-btn vd-btn-amber vd-btn-full"
              >
                <span>Son Sınava Git</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="vd-sidebar-progress">
                <p>Tüm içerikleri tamamlayınca son sınav açılır</p>
                <div className="vd-sidebar-bar">
                  <div
                    className="vd-sidebar-bar-fill"
                    style={{ width: `${(completedCount / videosData.length) * 100}%` }}
                  />
                </div>
                <span className="vd-sidebar-progress-num">
                  <strong>{completedCount}</strong>/<strong>{videosData.length}</strong> tamamlandı
                </span>
              </div>
            )}
          </footer>
        </aside>
      </div>
    </div>
  );
}

function renderItem(
  v: VideoItem,
  opts: { isCurrent: boolean; isLocked: boolean; duration: number; onSelect: () => void }
) {
  const Icon = v.contentType === 'pdf' ? FileText : v.contentType === 'audio' ? Volume2 : Play;
  const displayDuration =
    opts.isCurrent && opts.duration > 0 ? formatTime(opts.duration) : formatTime(v.duration);
  const durationText = v.contentType === 'pdf' ? `${v.pageCount ?? '?'} sayfa` : displayDuration;

  return (
    <button
      key={v.id}
      onClick={() => {
        if (!opts.isLocked) opts.onSelect();
      }}
      disabled={opts.isLocked}
      className={`vi-item ${opts.isCurrent ? 'vi-item-current' : ''} ${opts.isLocked ? 'vi-item-locked' : ''} ${v.completed ? 'vi-item-done' : ''}`}
    >
      <span className="vi-item-num">
        {v.completed ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : opts.isLocked ? (
          <Lock className="h-3.5 w-3.5" />
        ) : (
          <Icon className="h-3.5 w-3.5" />
        )}
      </span>
      <span className="vi-item-body">
        <span className="vi-item-title">{v.title}</span>
        <span className="vi-item-meta">{durationText}</span>
      </span>
    </button>
  );
}
