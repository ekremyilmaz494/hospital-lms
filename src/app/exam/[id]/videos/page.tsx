'use client';

import './videos.css';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, CheckCircle2, Lock, ArrowRight, AlertTriangle, SkipForward, FileText, Maximize2, Minimize2, Shield } from 'lucide-react';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(
  () => import('@/components/exam/pdf-viewer').then(m => ({ default: m.PdfViewer })),
  { ssr: false, loading: () => <div className="vd-spin-wrap"><span className="vd-spin" /></div> }
);

const AudioPlayer = dynamic(
  () => import('@/components/exam/audio-player').then(m => ({ default: m.AudioPlayer })),
  { ssr: false, loading: () => <div className="vd-spin-wrap"><span className="vd-spin" /></div> }
);
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { attemptPhaseRedirect, type AttemptStatus } from '@/lib/exam-state-machine';

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
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setStartError(data?.error || 'Sınav başlatılamadı');
          return;
        }
        sessionStorage.setItem(`exam-start-${id}`, String(Date.now()));
        setStartReady(true);
      })
      .catch(() => setStartError('Sınav başlatılamadı. Lütfen tekrar deneyin.'));
  }, [id, isReview]);

  const videosUrl = startReady ? `/api/exam/${id}/videos${isReview ? '?mode=review' : ''}` : null;
  const { data, isLoading, error } = useFetch<VideosResponse>(videosUrl);

  const rawVideos = data?.videos ?? [];
  const trainingTitle = data?.trainingTitle ?? '';

  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const videosData = rawVideos.map(v => ({
    ...v,
    completed: v.completed || localCompleted.has(v.id),
  }));
  const videosRef = useRef(videosData);

  const mediaItems = videosData.filter(v => v.contentType !== 'pdf');
  const pdfItems = videosData.filter(v => v.contentType === 'pdf');
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
  const lastAllowedTime = useRef(0);

  const changeVideo = useCallback((idx: number) => {
    setCurrentVideoIdx(idx);
    lastAllowedTime.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setVideoError(false);
  }, []);

  useEffect(() => { videosRef.current = videosData; }, [videosData]);

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
  }, [videosData.length, mediaItems.length, pdfItems.length, currentVideoIdx, currentMediaIdx, currentPdfIdx]);

  const singleCurrent = videosData[currentVideoIdx >= 0 ? currentVideoIdx : 0];
  const activeMedia = mediaItems[currentMediaIdx >= 0 ? currentMediaIdx : 0];
  const activePdf = pdfItems[currentPdfIdx >= 0 ? currentPdfIdx : 0];
  const currentVideo = isMixed ? activeMedia : singleCurrent;
  const allCompleted = videosData.length > 0 && videosData.every((v) => v.completed);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }, []);

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
    } catch { /* fullscreen not supported */ }
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
  }, [isMixed, currentMediaIdx, mediaItems.length, currentVideoIdx, videosData.length, changeVideo]);

  const [heartbeatErrors, setHeartbeatErrors] = useState(0);

  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (!currentVideo) return;

    const vids = videosRef.current;
    const activeIdx = isMixed
      ? vids.findIndex(v => v.id === currentVideo.id)
      : currentVideoIdx;
    const isLastVideo = isMixed
      ? currentMediaIdx >= mediaItems.length - 1
      : activeIdx >= vids.length - 1;
    const remainingIncomplete = vids.filter(v => !v.completed && v.id !== currentVideo.id).length;

    setLocalCompleted(prev => new Set(prev).add(currentVideo.id));
    videosRef.current = vids.map(v => v.id === currentVideo.id ? { ...v, completed: true } : v);

    if (isReview) {
      if (!isLastVideo) setTimeout(() => goToNextVideo(), 1500);
      return;
    }

    fetch(`/api/exam/${id}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: currentVideo.id, watchedTime: duration, position: duration, completed: true }),
    }).then(res => {
      if (!res.ok) throw new Error('Server error');
    }).catch(() => {
      setLocalCompleted(prev => { const next = new Set(prev); next.delete(currentVideo.id); return next; });
      videosRef.current = vids;
      setHeartbeatErrors(prev => prev + 1);
    });

    if (remainingIncomplete === 0 || (isLastVideo && vids.filter(v => !v.completed).length <= 1)) {
      setTimeout(() => router.replace(`/exam/${id}/transition?from=videos`), 800);
    } else if (!isLastVideo) {
      setTimeout(() => goToNextVideo(), 1500);
    }
  }, [currentVideo, id, duration, currentVideoIdx, goToNextVideo, router, isMixed, currentMediaIdx, mediaItems.length, isReview]);

  useEffect(() => {
    if (isReview || !isPlaying || !currentVideo) return;
    const heartbeat = setInterval(() => {
      fetch(`/api/exam/${id}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: currentVideo.id, watchedTime: currentTime, position: currentTime }),
      }).catch(() => setHeartbeatErrors(prev => prev + 1));
    }, 15000);
    return () => clearInterval(heartbeat);
  }, [isPlaying, currentVideo?.id, currentTime, id, isReview, currentVideo]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!document.hidden) return;
      // Sekme gizlendi: önce video'yu durdur, sonra pozisyonu hemen flush et.
      // Eskiden sadece pause vardı → mobilde app arka plana atılıp killed olursa
      // 15 sn'lik heartbeat'e kadar olan ilerleme kayboluyordu.
      if (videoRef.current && !videoRef.current.paused) videoRef.current.pause();
      if (isReview || !currentVideo || currentTime <= 0) return;
      const payload = JSON.stringify({
        videoId: currentVideo.id,
        watchedTime: currentTime,
        position: currentTime,
      });
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(`/api/exam/${id}/videos`, blob);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentVideo, currentTime, id, isReview]);

  useEffect(() => {
    const pos = currentVideo?.lastPosition ?? 0;
    queueMicrotask(() => setCurrentTime(pos > 0 ? pos : 0));
  }, [currentVideo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isReview) return;
    const saveOnExit = () => {
      if (currentVideo && currentTime > 0) {
        const payload = JSON.stringify({
          videoId: currentVideo.id,
          watchedTime: currentTime,
          position: currentTime,
        });
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon(`/api/exam/${id}/videos`, blob);
      }
    };
    // iOS Safari'de beforeunload sıklıkla tetiklenmez; pagehide daha güvenilir.
    window.addEventListener('pagehide', saveOnExit);
    window.addEventListener('beforeunload', saveOnExit);
    return () => {
      window.removeEventListener('pagehide', saveOnExit);
      window.removeEventListener('beforeunload', saveOnExit);
    };
  }, [currentVideo?.id, currentTime, id, isReview, currentVideo]);

  useEffect(() => {
    if (isReview) return;
    if (!data?.attemptStatus) return;
    const redirect = attemptPhaseRedirect(data.attemptStatus as AttemptStatus, 'videos');
    if (redirect) {
      const path = redirect === 'my-trainings'
        ? '/staff/my-trainings'
        : `/exam/${id}/${redirect}`;
      router.replace(path);
    }
  }, [data?.attemptStatus, id, router, isReview]);

  if ((!startReady && !startError) || isLoading) return <PageLoading />;

  if (startError || error) {
    return (
      <div className="vd-page-empty">
        <div className="vd-page-empty-icon"><AlertTriangle className="h-6 w-6" /></div>
        <h2>İçerik yüklenemedi</h2>
        <p>{startError || error}</p>
        <button onClick={() => router.back()} className="vd-page-empty-link">← Geri Dön</button>
        <style>{`
          .vd-page-empty { min-height: 60vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 10px; max-width: 420px; margin: 0 auto; }
          .vd-page-empty-icon { width: 56px; height: 56px; border-radius: 999px; background: var(--k-error-bg); color: var(--k-error); display: flex; align-items: center; justify-content: center; }
          .vd-page-empty h2 { font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; font-size: 20px; color: var(--k-text-primary); margin: 0; }
          .vd-page-empty p { font-size: 13px; color: var(--k-text-muted); margin: 0; }
          .vd-page-empty-link { background: none; border: none; color: var(--k-text-primary); font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 600; cursor: pointer; margin-top: 8px; }
        `}</style>
      </div>
    );
  }

  if (!isReview && (data?.attemptStatus === 'pre_exam' || data?.attemptStatus === 'completed')) return <PageLoading />;

  if (videosData.length === 0) {
    return (
      <div className="vd-empty">
        <div className="vd-empty-icon"><Play className="h-6 w-6" /></div>
        <h2>Bu eğitimde içerik bulunmuyor</h2>
        <p>Eğitim videoları henüz eklenmemiş. Doğrudan son sınava geçebilirsiniz.</p>
        <div className="vd-empty-actions">
          <button onClick={() => router.back()} className="vd-btn vd-btn-ghost">
            <ArrowLeft className="h-4 w-4" />
            <span>Geri Dön</span>
          </button>
          <button onClick={() => router.replace(`/exam/${id}/transition?from=videos`)} className="vd-btn vd-btn-primary">
            <span>Son Sınava Geç</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        <style>{`
          .vd-empty { min-height: 80vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 12px; max-width: 440px; margin: 0 auto; }
          .vd-empty-icon { width: 64px; height: 64px; border-radius: 999px; background: var(--k-bg); color: var(--k-text-primary); display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
          .vd-empty h2 { font-family: var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif; font-size: 22px; font-weight: 500; color: var(--k-text-primary); margin: 0; }
          .vd-empty p { font-size: 13px; color: var(--k-text-muted); margin: 0; }
          .vd-empty-actions { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; justify-content: center; }
          .vd-btn { display: inline-flex; align-items: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 999px; font-family: var(--font-display, system-ui); font-size: 13px; font-weight: 600; border: 1px solid transparent; cursor: pointer; text-decoration: none; }
          .vd-btn-ghost { background: transparent; color: var(--k-text-muted); border-color: var(--k-border); }
          .vd-btn-ghost:hover { border-color: var(--k-text-primary); color: var(--k-text-primary); }
          .vd-btn-primary { background: var(--k-primary); color: var(--k-bg); border-color: var(--k-primary); }
        .vd-btn-primary :global(svg) { color: var(--k-bg); }
          .vd-btn-primary:hover { background: var(--k-primary-hover); }
        `}</style>
      </div>
    );
  }

  if (!currentVideo) return null;

  const completedCount = videosData.filter(v => v.completed).length;

  return (
    <div className="vd-root">
      {heartbeatErrors >= 3 && (
        <div className="vd-heartbeat-err">
          Bağlantı sorunu: İlerlemen kaydedilemeyebilir. İnternet bağlantını kontrol et.
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
            <p>{isMixed ? `${completedCount}/${videosData.length} tamamlandı` : `İçerik ${currentVideoIdx + 1}/${videosData.length}`}</p>
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
                  fetch(`/api/exam/${id}/videos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId: activePdf.id, currentPage: page }),
                  }).catch(() => setHeartbeatErrors(prev => prev + 1));
                }}
                onComplete={() => {
                  const vids = videosRef.current;
                  setLocalCompleted(prev => new Set(prev).add(activePdf.id));
                  videosRef.current = vids.map(v => v.id === activePdf.id ? { ...v, completed: true } : v);
                  if (isReview) return;
                  fetch(`/api/exam/${id}/videos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId: activePdf.id, currentPage: activePdf.pageCount ?? 1, completed: true }),
                  }).then(async res => {
                    if (!res.ok) throw new Error('Server error');
                    const data = await res.json();
                    if (data.allVideosCompleted) {
                      setTimeout(() => router.replace(`/exam/${id}/transition?from=videos`), 800);
                    } else if (currentPdfIdx < pdfItems.length - 1) {
                      setTimeout(() => setCurrentPdfIdx(currentPdfIdx + 1), 1200);
                    }
                  }).catch(() => {
                    setLocalCompleted(prev => { const next = new Set(prev); next.delete(activePdf.id); return next; });
                    videosRef.current = vids;
                    setHeartbeatErrors(prev => prev + 1);
                  });
                }}
              />
            </div>
          )}

          <div className={isMixed ? 'vd-media-col' : ''}>
            {currentVideo.contentType === 'audio' ? (
              <div className="vd-audio-wrap">
                <AudioPlayer
                  src={currentVideo.url}
                  documentUrl={currentVideo.documentUrl}
                  title={currentVideo.title}
                  duration={currentVideo.duration}
                  lastPosition={currentVideo.lastPosition}
                  onProgress={(watchedTime, position) => {
                    if (isReview) return;
                    fetch(`/api/exam/${id}/videos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: currentVideo.id, watchedTime, position }),
                    }).catch(() => setHeartbeatErrors(prev => prev + 1));
                  }}
                  onComplete={() => {
                    const vids = videosRef.current;
                    setLocalCompleted(prev => new Set(prev).add(currentVideo.id));
                    videosRef.current = vids.map(v => v.id === currentVideo.id ? { ...v, completed: true } : v);
                    if (isReview) return;
                    fetch(`/api/exam/${id}/videos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: currentVideo.id, watchedTime: currentVideo.duration, position: currentVideo.duration, completed: true }),
                    }).then(async res => {
                      if (!res.ok) throw new Error('Server error');
                      const data = await res.json();
                      if (data.allVideosCompleted) {
                        setTimeout(() => router.replace(`/exam/${id}/transition?from=videos`), 800);
                      }
                    }).catch(() => {
                      setLocalCompleted(prev => { const next = new Set(prev); next.delete(currentVideo.id); return next; });
                      videosRef.current = vids;
                      setHeartbeatErrors(prev => prev + 1);
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
                    fetch(`/api/exam/${id}/videos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: currentVideo.id, currentPage: page }),
                    }).catch(() => setHeartbeatErrors(prev => prev + 1));
                  }}
                  onComplete={() => {
                    const vids = videosRef.current;
                    setLocalCompleted(prev => new Set(prev).add(currentVideo.id));
                    videosRef.current = vids.map(v => v.id === currentVideo.id ? { ...v, completed: true } : v);
                    if (isReview) return;
                    fetch(`/api/exam/${id}/videos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: currentVideo.id, currentPage: currentVideo.pageCount ?? 1, completed: true }),
                    }).then(async res => {
                      if (!res.ok) throw new Error('Server error');
                      const data = await res.json();
                      if (data.allVideosCompleted) {
                        setTimeout(() => router.replace(`/exam/${id}/transition?from=videos`), 800);
                      }
                    }).catch(() => {
                      setLocalCompleted(prev => { const next = new Set(prev); next.delete(currentVideo.id); return next; });
                      videosRef.current = vids;
                      setHeartbeatErrors(prev => prev + 1);
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
                      <button onClick={() => { setVideoError(false); videoRef.current?.load(); }}>
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
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={handleVideoEnded}
                      onError={() => setVideoError(true)}
                      onSeeking={() => {
                        if (isReview) return;
                        const video = videoRef.current;
                        if (video && video.currentTime > lastAllowedTime.current + 2) {
                          video.currentTime = lastAllowedTime.current;
                        }
                      }}
                    />
                  )}
                  {!videoError && !isPlaying && (
                    <button onClick={togglePlay} className="vd-play-overlay" aria-label="Oynat">
                      <span>
                        <Play className="h-8 w-8" fill="currentColor" />
                      </span>
                    </button>
                  )}
                </div>

                <div className={`vd-controls ${isFullscreen ? 'vd-controls-fs' : ''}`}>
                  <div className="vd-progress-track">
                    <div className="vd-progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="vd-controls-row">
                    <div className="vd-controls-left">
                      <button onClick={togglePlay} className="vd-play-btn" aria-label={isPlaying ? 'Duraklat' : 'Oynat'}>
                        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="currentColor" />}
                      </button>
                      <button onClick={toggleMute} className="vd-ctrl-btn" aria-label={isMuted ? 'Sesi aç' : 'Sessiz'}>
                        {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                      </button>
                      <input
                        type="range" min="0" max="1" step="0.05"
                        value={isMuted ? 0 : volume}
                        onChange={handleVolumeChange}
                        className="vd-volume"
                      />
                      <span className="vd-time">
                        {formatTime(currentTime)} / {formatTime(duration || currentVideo.duration)}
                      </span>
                    </div>
                    <div className="vd-controls-right">
                      {currentVideo.completed && (isMixed ? currentMediaIdx < mediaItems.length - 1 : currentVideoIdx < videosData.length - 1) && (
                        <button onClick={goToNextVideo} className="vd-next-btn">
                          <SkipForward className="h-3.5 w-3.5" />
                          <span>Sonraki</span>
                        </button>
                      )}
                      <button onClick={toggleFullscreen} className="vd-ctrl-btn" aria-label={isFullscreen ? 'Pencere' : 'Tam ekran'}>
                        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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
              <strong>{completedCount.toString().padStart(2, '0')}</strong>/<strong>{videosData.length.toString().padStart(2, '0')}</strong>
            </span>
          </header>

          {isMixed ? (
            <div className="vd-list-groups">
              <div>
                <h3 className="vd-list-group-title">Videolar & Ses</h3>
                <div className="vd-list">
                  {mediaItems.map((v, i) => {
                    const firstIncomplete = mediaItems.findIndex(x => !x.completed);
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
                    const firstIncomplete = pdfItems.findIndex(x => !x.completed);
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
                const isLocked = !v.completed && i > (videosData.findIndex(x => !x.completed));
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
              <button onClick={() => router.push('/staff/my-trainings')} className="vd-btn vd-btn-primary vd-btn-full">
                <span>Eğitimi Kapat</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : allCompleted ? (
              <button onClick={() => router.replace(`/exam/${id}/transition?from=videos`)} className="vd-btn vd-btn-amber vd-btn-full">
                <span>Son Sınava Git</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <div className="vd-sidebar-progress">
                <p>Tüm içerikleri tamamlayınca son sınav açılır</p>
                <div className="vd-sidebar-bar">
                  <div className="vd-sidebar-bar-fill" style={{ width: `${(completedCount / videosData.length) * 100}%` }} />
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
  const displayDuration = opts.isCurrent && opts.duration > 0 ? formatTime(opts.duration) : formatTime(v.duration);
  const durationText = v.contentType === 'pdf' ? `${v.pageCount ?? '?'} sayfa` : displayDuration;

  return (
    <button
      key={v.id}
      onClick={() => { if (!opts.isLocked) opts.onSelect(); }}
      disabled={opts.isLocked}
      className={`vi-item ${opts.isCurrent ? 'vi-item-current' : ''} ${opts.isLocked ? 'vi-item-locked' : ''} ${v.completed ? 'vi-item-done' : ''}`}
    >
      <span className="vi-item-num">
        {v.completed ? <CheckCircle2 className="h-4 w-4" /> : opts.isLocked ? <Lock className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
      </span>
      <span className="vi-item-body">
        <span className="vi-item-title">{v.title}</span>
        <span className="vi-item-meta">{durationText}</span>
      </span>
    </button>
  );
}
