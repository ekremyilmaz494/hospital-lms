'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, CheckCircle, Lock, ArrowRight, AlertTriangle, SkipForward, FileText } from 'lucide-react';
import dynamic from 'next/dynamic';

const PdfViewer = dynamic(
  () => import('@/components/exam/pdf-viewer').then(m => ({ default: m.PdfViewer })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-64"><div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> }
);

const AudioPlayer = dynamic(
  () => import('@/components/exam/audio-player').then(m => ({ default: m.AudioPlayer })),
  { ssr: false, loading: () => <div className="flex items-center justify-center h-64"><div className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} /></div> }
);
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

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

  // Ensure an active exam attempt exists BEFORE fetching videos (prevents race condition
  // where GET /videos resolves before POST /start, finding a completed attempt and redirecting away)
  const [startReady, setStartReady] = useState(false);
  const startCalled = useRef(false);
  useEffect(() => {
    if (!id || startCalled.current) return;
    startCalled.current = true;
    fetch(`/api/exam/${id}/start`, { method: 'POST' })
      .then(() => setStartReady(true))
      .catch(() => setStartReady(true));
  }, [id]);

  const { data, isLoading, error, refetch } = useFetch<VideosResponse>(startReady ? `/api/exam/${id}/videos` : null);

  const rawVideos = data?.videos ?? [];
  const trainingTitle = data?.trainingTitle ?? '';

  // Local completed tracking — so UI updates without refetch
  const [localCompleted, setLocalCompleted] = useState<Set<string>>(new Set());
  const videosData = rawVideos.map(v => ({
    ...v,
    completed: v.completed || localCompleted.has(v.id),
  }));
  const videosRef = useRef(videosData);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const lastAllowedTime = useRef(0);

  // All video switches go through this — resets playback state in one place
  const changeVideo = useCallback((idx: number) => {
    setCurrentVideoIdx(idx);
    lastAllowedTime.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setVideoError(false);
  }, []);

  // Keep videosRef in sync
  useEffect(() => { videosRef.current = videosData; }, [videosData]);

  // Set initial video index when data loads (render-time derived state)
  if (videosData.length > 0 && currentVideoIdx === -1) {
    const firstIncomplete = videosData.findIndex((v) => !v.completed);
    setCurrentVideoIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
  }

  const currentVideo = videosData[currentVideoIdx >= 0 ? currentVideoIdx : 0];
  const allCompleted = videosData.length > 0 && videosData.every((v) => v.completed);
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, []);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  // Prevent fast-forward: if user seeks ahead, snap back
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    // Allow up to 2 seconds ahead of last allowed time (for normal buffering)
    if (video.currentTime > lastAllowedTime.current + 2) {
      video.currentTime = lastAllowedTime.current;
    } else {
      lastAllowedTime.current = Math.max(lastAllowedTime.current, video.currentTime);
    }
    setCurrentTime(video.currentTime);
  }, []);

  // Auto-advance to next video
  const goToNextVideo = useCallback(() => {
    if (currentVideoIdx < videosData.length - 1) {
      changeVideo(currentVideoIdx + 1);
    }
  }, [currentVideoIdx, videosData.length, changeVideo]);

  // Heartbeat error counter — declared before handleVideoEnded to avoid access-before-declare
  const [heartbeatErrors, setHeartbeatErrors] = useState(0);

  // When video ends, mark as completed
  const [showPostExamPrompt, setShowPostExamPrompt] = useState(false);
  const handleVideoEnded = useCallback(() => { // eslint-disable-line
    setIsPlaying(false);
    if (!currentVideo) return;

    // Use ref for fresh data (avoids stale closure)
    const vids = videosRef.current;
    const isLastVideo = currentVideoIdx >= vids.length - 1;
    const remainingIncomplete = vids.filter(v => !v.completed && v.id !== currentVideo.id).length;

    // Optimistic update first for instant UI feedback
    setLocalCompleted(prev => new Set(prev).add(currentVideo.id));
    videosRef.current = vids.map(v => v.id === currentVideo.id ? { ...v, completed: true } : v);

    // Mark video as completed on server — rollback on failure
    fetch(`/api/exam/${id}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: currentVideo.id, watchedTime: duration, position: duration, completed: true }),
    }).then(res => {
      if (!res.ok) throw new Error('Server error');
    }).catch(() => {
      // Rollback optimistic update
      setLocalCompleted(prev => { const next = new Set(prev); next.delete(currentVideo.id); return next; });
      videosRef.current = vids;
      setHeartbeatErrors(prev => prev + 1);
    });

    // Last incomplete video → redirect to transition page (60s countdown)
    if (remainingIncomplete === 0 || (isLastVideo && vids.filter(v => !v.completed).length <= 1)) {
      setTimeout(() => router.push(`/exam/${id}/transition?from=videos`), 800);
    } else if (!isLastVideo) {
      setTimeout(() => goToNextVideo(), 1500);
    }
  }, [currentVideo, id, duration, currentVideoIdx, goToNextVideo, router]);

  // Heartbeat every 15 seconds
  useEffect(() => {
    if (!isPlaying || !currentVideo) return;
    const heartbeat = setInterval(() => {
      fetch(`/api/exam/${id}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: currentVideo.id, watchedTime: currentTime, position: currentTime }),
      }).catch(() => {
        setHeartbeatErrors(prev => prev + 1);
      });
    }, 15000);
    return () => clearInterval(heartbeat);
  }, [isPlaying, currentVideo?.id, currentTime, id]);

  // Video degistiginde currentTime'i lastPosition ile baslat
  useEffect(() => {
    const pos = currentVideo?.lastPosition ?? 0;
    // queueMicrotask: avoid synchronous setState in effect (react-compiler rule)
    queueMicrotask(() => setCurrentTime(pos > 0 ? pos : 0));
  }, [currentVideo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sayfa kapanirken son pozisyonu kaydet (beforeunload)
  useEffect(() => {
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
    window.addEventListener('beforeunload', saveOnExit);
    return () => window.removeEventListener('beforeunload', saveOnExit);
  }, [currentVideo?.id, currentTime, id]);

  // Phase guard: redirect based on attempt status (must be before early returns but after all hooks)
  useEffect(() => {
    if (data?.attemptStatus === 'pre_exam') router.replace(`/exam/${id}/pre-exam`);
    else if (data?.attemptStatus === 'post_exam') router.replace(`/exam/${id}/post-exam`);
    else if (data?.attemptStatus === 'completed') router.replace('/staff/my-trainings');
  }, [data?.attemptStatus, id, router]);

  // Show loading while start is pending OR video data is loading
  if (!startReady || isLoading) return <PageLoading />;
  if (error) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  if (data?.attemptStatus === 'pre_exam' || data?.attemptStatus === 'completed') return <PageLoading />;

  if (videosData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="text-center space-y-4 max-w-md mx-auto p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: 'var(--color-primary-light)' }}>
            <Play className="h-8 w-8" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h2 className="text-lg font-bold">Bu eğitimde video bulunmuyor</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Eğitim videoları henüz eklenmemiş. Doğrudan son sınava geçebilirsiniz.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button variant="outline" onClick={() => router.back()} className="gap-2" style={{ borderColor: 'var(--color-border)' }}>
              <ArrowLeft className="h-4 w-4" /> Geri Dön
            </Button>
            <Button onClick={() => router.push(`/exam/${id}/transition?from=videos`)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
              Son Sınava Geç <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentVideo) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* All videos completed overlay */}
      {showPostExamPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="mx-4 max-w-md w-full rounded-2xl p-8 text-center" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
            </div>
            <h2 className="text-xl font-bold mb-2">Tüm Videolar Tamamlandı!</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
              Eğitim videolarını başarıyla izlediniz. Şimdi son sınava geçebilirsiniz.
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => router.push(`/exam/${id}/transition?from=videos`)}
                className="w-full gap-2 py-3 font-semibold text-white rounded-xl"
                style={{ background: 'var(--color-primary)' }}
              >
                Son Sınava Geç <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPostExamPrompt(false)}
                className="w-full rounded-xl"
                style={{ borderColor: 'var(--color-border)' }}
              >
                Videoları Tekrar İzle
              </Button>
            </div>
          </div>
        </div>
      )}
      {heartbeatErrors >= 3 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-medium text-white" style={{ background: 'var(--color-error)', boxShadow: 'var(--shadow-lg)' }}>
          Bağlantı sorunu: İlerlemeniz kaydedilemeyebilir. İnternet bağlantınızı kontrol edin.
        </div>
      )}
      {/* Header */}
      <div className="border-b px-6 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h3 className="text-sm font-bold">{trainingTitle}</h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>İçerik {currentVideoIdx + 1} / {videosData.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentVideo?.contentType !== 'pdf' && (
              <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ background: 'var(--color-warning-bg)' }}>
                <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--color-warning)' }} />
                <span className="text-[11px] font-semibold" style={{ color: 'var(--color-warning)' }}>Hızlandırma Engelli</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Content Player Area */}
          <div className="lg:col-span-3">
            {currentVideo.contentType === 'audio' ? (
              /* ── Audio Player ── */
              <div className="rounded-xl border overflow-hidden p-6" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <AudioPlayer
                  src={currentVideo.url}
                  documentUrl={currentVideo.documentUrl}
                  title={currentVideo.title}
                  duration={currentVideo.duration}
                  lastPosition={currentVideo.lastPosition}
                  onProgress={(watchedTime, position) => {
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

                    fetch(`/api/exam/${id}/videos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: currentVideo.id, watchedTime: currentVideo.duration, position: currentVideo.duration, completed: true }),
                    }).then(async res => {
                      if (!res.ok) throw new Error('Server error');
                      const data = await res.json();
                      if (data.allVideosCompleted) {
                        setTimeout(() => router.push(`/exam/${id}/transition?from=videos`), 800);
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
              /* ── PDF Viewer ── */
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)', height: 'calc(100vh - 180px)' }}>
                <PdfViewer
                  url={currentVideo.url}
                  pageCount={currentVideo.pageCount}
                  onPageChange={(page, total) => {
                    // Heartbeat: sayfa değişimlerini kaydet
                    fetch(`/api/exam/${id}/videos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: currentVideo.id, currentPage: page }),
                    }).catch(() => setHeartbeatErrors(prev => prev + 1));
                  }}
                  onComplete={() => {
                    // Optimistic update
                    const vids = videosRef.current;
                    setLocalCompleted(prev => new Set(prev).add(currentVideo.id));
                    videosRef.current = vids.map(v => v.id === currentVideo.id ? { ...v, completed: true } : v);

                    fetch(`/api/exam/${id}/videos`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ videoId: currentVideo.id, currentPage: currentVideo.pageCount ?? 1, completed: true }),
                    }).then(async res => {
                      if (!res.ok) throw new Error('Server error');
                      const data = await res.json();
                      if (data.allVideosCompleted) {
                        setTimeout(() => router.push(`/exam/${id}/transition?from=videos`), 800);
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
              /* ── Video Player ── */
              <>
                <div className="relative aspect-video rounded-xl overflow-hidden" style={{ background: '#0c0f14' }}
                  onContextMenu={(e) => e.preventDefault()}>
                  {videoError ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center space-y-3">
                        <AlertTriangle className="mx-auto h-12 w-12" style={{ color: 'var(--color-warning)' }} />
                        <p className="text-sm text-white font-medium">Video yüklenemedi</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          Video dosyası bulunamadı veya erişim izni yok.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setVideoError(false); videoRef.current?.load(); }}
                          className="mt-2 text-white border-white/30"
                        >
                          Tekrar Dene
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <video
                      ref={videoRef}
                      key={currentVideo.id}
                      src={currentVideo.url}
                      className="absolute inset-0 w-full h-full object-contain"
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
                        const video = videoRef.current;
                        if (video && video.currentTime > lastAllowedTime.current + 2) {
                          video.currentTime = lastAllowedTime.current;
                        }
                      }}
                    />
                  )}
                  {!videoError && !isPlaying && (
                    <button
                      onClick={togglePlay}
                      className="absolute inset-0 flex items-center justify-center bg-black/20"
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                        <Play className="h-8 w-8 text-white ml-1" />
                      </div>
                    </button>
                  )}
                </div>

                {/* Custom Controls */}
                <div className="mt-3 rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <div className="mb-3 h-1.5 w-full rounded-full cursor-not-allowed" style={{ background: 'var(--color-border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--color-primary)', transition: 'width 0.3s linear' }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlay} className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--color-primary)' }}>
                        {isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
                      </button>
                      <button onClick={toggleMute} className="rounded-md p-2" style={{ color: 'var(--color-text-secondary)' }}>
                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                      </button>
                      <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                        {formatTime(currentTime)} / {formatTime(duration || currentVideo.duration)}
                      </span>
                      {currentVideo.completed && currentVideoIdx < videosData.length - 1 && (
                        <button onClick={goToNextVideo} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                          <SkipForward className="h-3.5 w-3.5" /> Sonraki
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Lock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                      <span style={{ color: 'var(--color-text-muted)' }}>1.0x (sabit)</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>•</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>İleri sarma kapalı</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>•</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>İndirme kapalı</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Video List Sidebar */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold">İçerik Listesi</h4>
            <div className="space-y-2">
              {videosData.map((v, i) => {
                const isCurrent = i === currentVideoIdx;
                const isLocked = !v.completed && i > (videosData.findIndex(x => !x.completed));
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (!isLocked) {
                        changeVideo(i);
                      }
                    }}
                    disabled={isLocked}
                    className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left"
                    style={{
                      background: isCurrent ? 'var(--color-primary-light)' : 'transparent',
                      borderLeft: isCurrent ? '3px solid var(--color-primary)' : '3px solid transparent',
                      opacity: isLocked ? 0.5 : 1,
                      transition: 'background var(--transition-fast)',
                    }}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: v.completed ? 'var(--color-success)' : isCurrent ? 'var(--color-primary)' : 'var(--color-border)' }}>
                      {v.completed ? <CheckCircle className="h-4 w-4 text-white" /> : isLocked ? <Lock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} /> : v.contentType === 'pdf' ? <FileText className="h-3.5 w-3.5" style={{ color: isCurrent ? 'white' : 'var(--color-text-muted)' }} /> : v.contentType === 'audio' ? <Volume2 className="h-3.5 w-3.5" style={{ color: isCurrent ? 'white' : 'var(--color-text-muted)' }} /> : <Play className="h-3.5 w-3.5" style={{ color: isCurrent ? 'white' : 'var(--color-text-muted)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium" style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{v.title}</p>
                      <p className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                        {v.contentType === 'pdf' ? `${v.pageCount ?? '?'} sayfa` : (isCurrent && duration > 0 ? formatTime(duration) : formatTime(v.duration))}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Next Action */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              {allCompleted ? (
                <Button onClick={() => router.push(`/exam/${id}/transition?from=videos`)} className="w-full gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)' }}>
                  Son Sınava Git <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-hover)' }}>
                  <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Tüm içerikleri tamamlayınca son sınav açılır
                  </p>
                  <p className="text-xs text-center mt-1 font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                    {videosData.filter(v => v.completed).length}/{videosData.length} tamamlandı
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
