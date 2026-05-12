'use client';

/**
 * UploadManagerWidget — sağ-altta sabit floating panel.
 *
 * Görev: kullanıcı wizard sayfasından çıksa bile arkada devam eden upload'ların
 * progress'ini görmesi ve gerekirse iptal etmesi için her admin sayfasında görünür
 * kalır. Aktif upload yoksa hiçbir şey render etmez (DOM kirletmez).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, FileText, Music, Upload, Video, X } from 'lucide-react';
import { useUploadManager } from './upload-manager';

export function UploadManagerWidget() {
  const router = useRouter();
  const { uploads, cancel, dismiss } = useUploadManager();
  const [expanded, setExpanded] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);

  const active = uploads.filter(u => u.status === 'uploading' || u.status === 'pending');
  const completed = uploads.filter(u => u.status === 'done' || u.status === 'error' || u.status === 'canceled');

  // Tüm upload'lar tamamlandığında 4 sn sonra widget'ı otomatik gizle
  useEffect(() => {
    if (active.length === 0 && completed.length > 0 && !hideCompleted) {
      const t = setTimeout(() => setHideCompleted(true), 4000);
      return () => clearTimeout(t);
    }
    // Yeni upload geldiyse temizleme efektini sıfırla
    if (active.length > 0) setHideCompleted(false);
  }, [active.length, completed.length, hideCompleted]);

  if (uploads.length === 0 || hideCompleted) return null;

  const totalProgress = active.length > 0
    ? Math.round(active.reduce((acc, u) => acc + u.progress, 0) / active.length)
    : 100;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border bg-white shadow-2xl"
      style={{
        borderColor: '#c9c4be',
        boxShadow: '0 10px 40px rgba(15, 23, 42, 0.15), 0 4px 12px rgba(15, 23, 42, 0.08)',
      }}
      aria-live="polite"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center justify-between rounded-t-2xl px-4 py-3"
        style={{ background: '#fafaf9', borderBottom: expanded ? '1px solid #e7e5e0' : 'none' }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            style={{ background: active.length > 0 ? '#d1fae5' : '#f5f4f1' }}
          >
            <Upload size={15} style={{ color: active.length > 0 ? '#0d9668' : '#78716c' }} />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-[13px] font-semibold truncate" style={{ color: '#1c1917' }}>
              {active.length > 0
                ? `${active.length} dosya yükleniyor (${totalProgress}%)`
                : `${completed.length} dosya tamamlandı`}
            </p>
            <p className="text-[11px]" style={{ color: '#78716c' }}>
              {active.length > 0 ? 'Sayfadan ayrılırsanız da devam eder' : 'Yükleme tamamlandı'}
            </p>
          </div>
        </div>
        {expanded ? <ChevronDown size={16} style={{ color: '#78716c' }} /> : <ChevronUp size={16} style={{ color: '#78716c' }} />}
      </button>

      {expanded && (
        <ul className="max-h-[280px] overflow-y-auto py-1">
          {uploads.map(u => (
            <li
              key={u.uploadId}
              className="flex items-center gap-2.5 px-4 py-2.5"
              style={{ borderTop: '1px solid #f5f4f1' }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: '#f5f4f1' }}>
                {u.kind === 'video' && <Video size={13} style={{ color: '#3b82f6' }} />}
                {u.kind === 'pdf' && <FileText size={13} style={{ color: '#ef4444' }} />}
                {u.kind === 'audio' && <Music size={13} style={{ color: '#a855f7' }} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-medium truncate" style={{ color: '#1c1917' }} title={u.fileName}>
                  {u.fileName}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full" style={{ background: '#e7e5e0' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${u.progress}%`,
                        background:
                          u.status === 'error' ? '#ef4444'
                          : u.status === 'canceled' ? '#78716c'
                          : u.status === 'done' ? '#10b981'
                          : '#0d9668',
                        transition: 'width 200ms ease',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-mono shrink-0" style={{ color: '#78716c' }}>
                    {u.status === 'error' ? 'Hata'
                      : u.status === 'canceled' ? 'İptal'
                      : u.status === 'done' ? '✓'
                      : `${u.progress}%`}
                  </span>
                </div>
                {u.status === 'error' && u.errorMessage && (
                  <p className="mt-0.5 text-[10px]" style={{ color: '#ef4444' }}>{u.errorMessage}</p>
                )}
              </div>
              {(u.status === 'uploading' || u.status === 'pending') ? (
                <button
                  type="button"
                  onClick={() => cancel(u.uploadId)}
                  className="rounded-md p-1 hover:bg-stone-100"
                  aria-label="Yüklemeyi iptal et"
                >
                  <X size={13} style={{ color: '#78716c' }} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => dismiss(u.uploadId)}
                  className="rounded-md p-1 hover:bg-stone-100"
                  aria-label="Bildirimi kapat"
                >
                  <X size={13} style={{ color: '#78716c' }} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Wizard'a hızlı dönüş — birden fazla draft'ta upload varsa ilk active'in draftId'sine git */}
      {expanded && active.length > 0 && (
        <button
          type="button"
          onClick={() => router.push(`/admin/trainings/new/${active[0].draftId}`)}
          className="w-full rounded-b-2xl px-4 py-2 text-[11px] font-semibold"
          style={{ background: '#fafaf9', color: '#0d9668', borderTop: '1px solid #e7e5e0' }}
        >
          Wizard'a Dön →
        </button>
      )}
    </div>
  );
}
