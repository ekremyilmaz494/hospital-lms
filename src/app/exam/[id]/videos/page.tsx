'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, CheckCircle, Lock, ArrowRight, AlertTriangle, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface VideoItem {
  id: string;
  title: string;
  url: string;
  duration: number;
  completed: boolean;
}

interface VideosResponse {
  trainingTitle?: string;
  videos: VideoItem[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayerPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useFetch<VideosResponse>(`/api/exam/${id}/videos`);

  const videosData = data?.videos ?? [];
  const trainingTitle = data?.trainingTitle ?? '';

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentVideoIdx, setCurrentVideoIdx] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const lastAllowedTime = useRef(0);

  // Set initial video index when data loads
  useEffect(() => {
    if (videosData.length > 0 && currentVideoIdx === -1) {
      const firstIncomplete = videosData.findIndex((v) => !v.completed);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentVideoIdx(firstIncomplete >= 0 ? firstIncomplete : 0);
    }
  }, [videosData, currentVideoIdx]);

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
      setCurrentVideoIdx(currentVideoIdx + 1);
      lastAllowedTime.current = 0;
      setCurrentTime(0);
      setDuration(0);
      setVideoError(false);
    }
  }, [currentVideoIdx, videosData.length]);

  // When video ends, mark as completed via heartbeat
  const [showPostExamPrompt, setShowPostExamPrompt] = useState(false);
  const handleVideoEnded = useCallback(() => {
    setIsPlaying(false);
    if (!currentVideo) return;
    fetch(`/api/exam/${id}/videos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: currentVideo.id, watchedTime: duration, position: duration, completed: true }),
    }).then(() => {
      refetch();
      const remainingIncomplete = videosData.filter(v => !v.completed && v.id !== currentVideo.id).length;
      if (remainingIncomplete === 0) {
        setShowPostExamPrompt(true);
      } else if (currentVideoIdx < videosData.length - 1) {
        setTimeout(() => goToNextVideo(), 1500);
      }
    }).catch(() => {});
  }, [currentVideo, id, duration, refetch, videosData, currentVideoIdx, goToNextVideo]);

  // Reset state when video changes
  useEffect(() => {
    lastAllowedTime.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setVideoError(false);
  }, [currentVideoIdx]);

  // Heartbeat every 15 seconds
  const [heartbeatErrors, setHeartbeatErrors] = useState(0);
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

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

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
            <Button onClick={() => router.push(`/exam/${id}/post-exam`)} className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
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
                onClick={() => router.push(`/exam/${id}/post-exam`)}
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
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Video {currentVideoIdx + 1} / {videosData.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ background: 'var(--color-warning-bg)' }}>
              <AlertTriangle className="h-3.5 w-3.5" style={{ color: 'var(--color-warning)' }} />
              <span className="text-[11px] font-semibold" style={{ color: 'var(--color-warning)' }}>Hızlandırma Engelli</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-6xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Video Player Area */}
          <div className="lg:col-span-3">
            {/* Real Video Element */}
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
                    if (video) setDuration(video.duration);
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleVideoEnded}
                  onError={() => setVideoError(true)}
                  onSeeking={() => {
                    // Prevent seeking forward
                    const video = videoRef.current;
                    if (video && video.currentTime > lastAllowedTime.current + 2) {
                      video.currentTime = lastAllowedTime.current;
                    }
                  }}
                />
              )}
              {/* Click to play/pause overlay */}
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
              {/* Progress Bar (no seeking allowed) */}
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
                  {/* Next video button when current is completed */}
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
          </div>

          {/* Video List Sidebar */}
          <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 className="mb-3 text-sm font-bold">Video Listesi</h4>
            <div className="space-y-2">
              {videosData.map((v, i) => {
                const isCurrent = i === currentVideoIdx;
                const isLocked = !v.completed && i > (videosData.findIndex(x => !x.completed));
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (!isLocked) {
                        setCurrentVideoIdx(i);
                        lastAllowedTime.current = 0;
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
                      {v.completed ? <CheckCircle className="h-4 w-4 text-white" /> : isLocked ? <Lock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} /> : <Play className="h-3.5 w-3.5" style={{ color: isCurrent ? 'white' : 'var(--color-text-muted)' }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium" style={{ color: isCurrent ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>{v.title}</p>
                      <p className="text-[10px]" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>{formatTime(v.duration)}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Next Action */}
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              {allCompleted ? (
                <Button onClick={() => router.push(`/exam/${id}/post-exam`)} className="w-full gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)' }}>
                  Son Sınava Git <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-hover)' }}>
                  <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Tüm videoları izleyince son sınav açılır
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
