'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, CheckCircle, Lock, ArrowRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const videosData = [
  { id: '1', title: 'İSG Temel Kavramlar', duration: 900, completed: true },
  { id: '2', title: 'Risk Değerlendirme', duration: 1200, completed: true },
  { id: '3', title: 'Kişisel Koruyucu Donanım', duration: 720, completed: false },
  { id: '4', title: 'Acil Durum Prosedürleri', duration: 1080, completed: false },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoPlayerPage() {
  const router = useRouter();
  const [currentVideoIdx, setCurrentVideoIdx] = useState(
    videosData.findIndex((v) => !v.completed)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [watchedTime, setWatchedTime] = useState(0);

  const currentVideo = videosData[currentVideoIdx >= 0 ? currentVideoIdx : 0];
  const allCompleted = videosData.every((v) => v.completed);
  const progress = currentVideo ? (currentTime / currentVideo.duration) * 100 : 0;

  // Simulate video playback
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= currentVideo.duration) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
      setWatchedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, currentVideo.duration]);

  // Simulated heartbeat every 10 seconds
  useEffect(() => {
    if (!isPlaying) return;
    const heartbeat = setInterval(() => {
      console.log(`[Heartbeat] Video: ${currentVideo.id}, watched: ${watchedTime}s, position: ${currentTime}s`);
    }, 10000);
    return () => clearInterval(heartbeat);
  }, [isPlaying, currentVideo.id, watchedTime, currentTime]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <div className="border-b px-6 py-3" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} style={{ color: 'var(--color-text-secondary)' }}><ArrowLeft className="h-5 w-5" /></Button>
            <div>
              <h3 className="text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>İş Güvenliği Temel Eğitim</h3>
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
            {/* Video Display */}
            <div className="relative aspect-video rounded-xl overflow-hidden" style={{ background: '#0c0f14' }}
              onContextMenu={(e) => e.preventDefault()}>
              {/* Simulated video area */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Play className="mx-auto h-16 w-16 mb-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <p className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>{currentVideo.title}</p>
                  <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-mono)' }}>
                    {formatTime(currentTime)} / {formatTime(currentVideo.duration)}
                  </p>
                  <p className="text-xs mt-4 px-4 py-2 rounded-lg inline-block" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>
                    Video oynatıcı simülasyonu — Gerçek projede HLS streaming kullanılacak
                  </p>
                </div>
              </div>
            </div>

            {/* Custom Controls */}
            <div className="mt-3 rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              {/* Progress Bar (no seeking allowed) */}
              <div className="mb-3 h-1.5 w-full rounded-full cursor-not-allowed" style={{ background: 'var(--color-border)' }}>
                <div className="h-full rounded-full" style={{ width: `${progress}%`, background: 'var(--color-primary)', transition: 'width 1s linear' }} />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setIsPlaying(!isPlaying)} className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}>
                    {isPlaying ? <Pause className="h-5 w-5 text-white" /> : <Play className="h-5 w-5 text-white ml-0.5" />}
                  </button>
                  <button onClick={() => setIsMuted(!isMuted)} className="rounded-md p-2" style={{ color: 'var(--color-text-secondary)', transition: 'color var(--transition-fast)' }}>
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
                    {formatTime(currentTime)} / {formatTime(currentVideo.duration)}
                  </span>
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
            <h4 className="mb-3 text-sm font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)' }}>Video Listesi</h4>
            <div className="space-y-2">
              {videosData.map((v, i) => {
                const isCurrent = i === currentVideoIdx;
                const isLocked = !v.completed && i > (videosData.findIndex(x => !x.completed));
                return (
                  <button
                    key={v.id}
                    onClick={() => !isLocked && setCurrentVideoIdx(i)}
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
                <Button onClick={() => router.push('/exam/1/post-exam')} className="w-full gap-2 font-semibold text-white" style={{ background: 'var(--color-accent)', transition: 'background var(--transition-fast)' }}>
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
