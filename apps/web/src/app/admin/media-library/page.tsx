'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Library,
  Video,
  Music,
  Upload,
  Search,
  Trash2,
  Play,
  Clock,
  Loader2,
  HardDrive,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

interface MediaAssetItem {
  id: string;
  title: string;
  description: string | null;
  mediaType: 'video' | 'audio';
  s3Key: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  usageCount: number;
}

type Filter = 'all' | 'video' | 'audio';

const ACCEPT =
  'video/mp4,video/webm,.mp3,.wav,.m4a,.ogg,.aac,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,audio/ogg,audio/aac';

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return `${m}:${String(s).padStart(2, '0')} dk`;
  const h = Math.floor(m / 60);
  return `${h}sa ${m % 60}dk`;
}

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/** Video/ses dosyasının süresini client-side ölç (upload öncesi metadata). */
function measureDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const isAudio = file.type.startsWith('audio/');
    const el = document.createElement(isAudio ? 'audio' : 'video');
    el.preload = 'metadata';
    const url = URL.createObjectURL(file);
    const cleanup = () => URL.revokeObjectURL(url);
    el.onloadedmetadata = () => {
      const d = Number.isFinite(el.duration) ? Math.round(el.duration) : 0;
      cleanup();
      resolve(d);
    };
    el.onerror = () => {
      cleanup();
      resolve(0);
    };
    el.src = url;
  });
}

export default function MediaLibraryPage() {
  const { data, isLoading, error, refetch } = useFetch<{ items: MediaAssetItem[] }>(
    '/api/admin/media-library'
  );
  const { toast } = useToast();
  const items = useMemo(() => data?.items ?? [], [data]);

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [uploading, setUploading] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaAssetItem | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteItem, setDeleteItem] = useState<MediaAssetItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    const videoCount = items.filter((i) => i.mediaType === 'video').length;
    const audioCount = items.filter((i) => i.mediaType === 'audio').length;
    const totalBytes = items.reduce((s, i) => s + (i.fileSizeBytes ?? 0), 0);
    return { videoCount, audioCount, totalBytes };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (filter !== 'all' && it.mediaType !== filter) return false;
      if (q) {
        return (
          it.title.toLowerCase().includes(q) || (it.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [items, filter, search]);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, 20);
    setUploading(true);
    try {
      // 1) Süreleri ölç + presign payload hazırla.
      const metas = await Promise.all(
        files.map(async (f) => ({
          file: f,
          durationSeconds: await measureDuration(f),
        }))
      );

      // 2) Presign + DB kaydı oluştur.
      const res = await fetch('/api/admin/media-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: metas.map((m) => ({
            fileName: m.file.name,
            contentType: m.file.type,
            fileSize: m.file.size,
            durationSeconds: m.durationSeconds,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast(body.error || 'Yükleme başlatılamadı', 'error');
        return;
      }
      const { results } = (await res.json()) as {
        results: Array<{ fileName: string; uploadUrl?: string; error?: string }>;
      };

      // 3) Her dosyayı presigned URL'e PUT et (progress XHR ile).
      await Promise.all(
        results.map((r) => {
          const meta = metas.find((m) => m.file.name === r.fileName);
          if (r.error || !r.uploadUrl || !meta) {
            if (r.error) toast(`${r.fileName}: ${r.error}`, 'error');
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', r.uploadUrl!);
            xhr.setRequestHeader('Content-Type', meta.file.type);
            xhr.upload.onprogress = (e) => {
              if (e.lengthComputable) {
                setUploadProgress((prev) => ({
                  ...prev,
                  [r.fileName]: Math.round((e.loaded / e.total) * 100),
                }));
              }
            };
            xhr.onload = () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                toast(`${r.fileName} yüklendi`, 'success');
              } else {
                toast(`${r.fileName} S3'e yüklenemedi`, 'error');
              }
              resolve();
            };
            xhr.onerror = () => {
              toast(`${r.fileName} yüklenemedi — bağlantı hatası`, 'error');
              resolve();
            };
            xhr.send(meta.file);
          });
        })
      );

      setUploadProgress({});
      refetch();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openPreview = async (item: MediaAssetItem) => {
    setPreviewItem(item);
    setPreviewUrl('');
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/media-library/${item.id}/preview-url`);
      const body = await res.json().catch(() => ({}));
      setPreviewUrl(res.ok ? body.url || '' : '');
    } catch {
      setPreviewUrl('');
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/media-library/${deleteItem.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        toast(body.message || 'Silindi', 'success');
        setDeleteItem(null);
        refetch();
      } else {
        toast(body.error || 'Silinemedi', 'error');
      }
    } finally {
      setDeleting(false);
    }
  };

  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'video', label: 'Video' },
    { key: 'audio', label: 'Ses' },
  ];

  const uploadingNames = Object.keys(uploadProgress);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medya Kütüphanesi"
        subtitle="Yüklediğiniz video ve ses dosyaları — eğitim oluştururken seçilebilir"
        badge="Medya"
        action={{
          label: uploading ? 'Yükleniyor...' : 'Video/Ses Yükle',
          icon: Upload,
          onClick: () => fileInputRef.current?.click(),
          loading: uploading,
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Video" value={stats.videoCount} icon={Video} />
        <StatCard
          title="Ses"
          value={stats.audioCount}
          icon={Music}
          accentColor="var(--color-accent)"
        />
        <StatCard title="Toplam Boyut" value={formatSize(stats.totalBytes)} icon={HardDrive} />
      </div>

      {/* Upload progress */}
      {uploadingNames.length > 0 && (
        <div
          className="space-y-2 rounded-2xl border p-4"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          {uploadingNames.map((name) => (
            <div key={name} className="flex items-center gap-3">
              <span
                className="flex-1 truncate text-xs"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {name}
              </span>
              <div
                className="h-2 w-40 overflow-hidden rounded-full"
                style={{ background: 'var(--color-border)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${uploadProgress[name]}%`,
                    background: 'var(--color-primary)',
                    transition: 'width 0.2s ease',
                  }}
                />
              </div>
              <span
                className="w-9 text-right text-xs font-bold"
                style={{ color: 'var(--color-primary)' }}
              >
                {uploadProgress[name]}%
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Filters + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="rounded-full px-4 py-1.5 text-xs font-semibold"
              style={{
                background: filter === f.key ? 'var(--color-primary)' : 'var(--color-surface)',
                color: filter === f.key ? 'white' : 'var(--color-text-secondary)',
                border: `1px solid ${filter === f.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                transition: 'background-color 150ms ease, color 150ms ease',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search
            className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <Input
            placeholder="İçerik ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : error ? (
        <p className="text-sm" style={{ color: 'var(--color-error)' }}>
          Kütüphane yüklenemedi. Sayfayı yenileyin.
        </p>
      ) : filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <Library
            className="mb-3 h-10 w-10"
            style={{ color: 'var(--color-text-muted)', opacity: 0.5 }}
          />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {search ? 'Aramanızla eşleşen içerik yok' : 'Henüz medya yüklenmedi'}
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)', opacity: 0.7 }}>
            Yukarıdan video veya ses dosyası yükleyin
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const Icon = item.mediaType === 'audio' ? Music : Video;
            return (
              <div
                key={item.id}
                className="group flex flex-col gap-3 rounded-2xl border p-4"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                  transition: 'border-color 150ms ease, box-shadow 150ms ease',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background:
                        item.mediaType === 'audio'
                          ? 'var(--color-accent-light, #fef3c7)'
                          : 'var(--color-primary-light)',
                      color:
                        item.mediaType === 'audio' ? 'var(--color-accent)' : 'var(--color-primary)',
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-semibold"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      {item.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                        {item.mediaType === 'audio' ? 'Ses' : 'Video'}
                      </Badge>
                      <span
                        className="flex items-center gap-1 text-[11px]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        <Clock className="h-3 w-3" />
                        {formatDuration(item.durationSeconds)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                    {formatSize(item.fileSizeBytes)}
                    {item.usageCount > 0 ? ` · ${item.usageCount} eğitimde` : ''}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 text-xs"
                      onClick={() => openPreview(item)}
                    >
                      <Play className="h-3.5 w-3.5" /> Önizle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      style={{ color: 'var(--color-error)' }}
                      onClick={() => setDeleteItem(item)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview modal */}
      <Dialog open={!!previewItem} onOpenChange={(v) => !v && setPreviewItem(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{previewItem?.title}</DialogTitle>
            <DialogDescription>İçerik önizlemesi</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2
                  className="h-6 w-6 animate-spin"
                  style={{ color: 'var(--color-primary)' }}
                />
              </div>
            ) : !previewUrl ? (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                İçerik şu anda yüklenemiyor.
              </p>
            ) : previewItem?.mediaType === 'audio' ? (
              <audio src={previewUrl} controls className="w-full" />
            ) : (
              <video src={previewUrl} controls className="w-full rounded-lg" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteItem} onOpenChange={(v) => !v && setDeleteItem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Medyayı sil</DialogTitle>
            <DialogDescription>
              &quot;{deleteItem?.title}&quot; kütüphaneden kaldırılacak.
              {deleteItem && deleteItem.usageCount > 0
                ? ` Bu dosya ${deleteItem.usageCount} eğitimde kullanılıyor — eğitimler etkilenmez, dosya silinmez.`
                : ' Bu işlem geri alınamaz.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleting}>
              İptal
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              style={{ background: 'var(--color-error)', color: 'white' }}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
