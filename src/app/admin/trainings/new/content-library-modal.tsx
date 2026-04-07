'use client';

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Search, Video, Music, FileText, Check, Library, Clock, Loader2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';

interface LibraryVideo {
  id: string;
  title: string;
  durationSeconds: number;
  sortOrder: number;
  videoUrl: string;
  videoKey: string;
  contentType: string;
  pageCount: number | null;
  documentKey: string | null;
  description: string | null;
  createdAt: string;
}

interface LibraryTraining {
  id: string;
  title: string;
  category: string;
  publishStatus: string;
  videoCount: number;
  totalDurationSeconds: number;
  createdAt: string;
  videos: LibraryVideo[];
}

/** Wizard'a eklenecek video yapısına dönüşüm için */
export interface SelectedContent {
  id: number;
  title: string;
  url: string;
  contentType: 'video' | 'pdf' | 'audio';
  durationSeconds?: number;
  pageCount?: number;
  documentKey?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (items: SelectedContent[]) => void;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}dk ${s}s` : `${m}dk`;
  const h = Math.floor(m / 60);
  return `${h}sa ${m % 60}dk`;
}

const CONTENT_ICON: Record<string, typeof Video> = {
  video: Video,
  audio: Music,
  pdf: FileText,
};

const CONTENT_LABEL: Record<string, string> = {
  video: 'Video',
  audio: 'Ses',
  pdf: 'Doküman',
};

export function ContentLibraryModal({ open, onClose, onSelect }: Props) {
  const { data, isLoading } = useFetch<{ trainings: LibraryTraining[] }>(
    open ? '/api/admin/content-library/my-videos' : null,
  );
  const trainings = data?.trainings ?? [];

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'video' | 'audio' | 'pdf'>('all');

  // Flatten all videos from all trainings
  const allVideos = useMemo(() => {
    return trainings.flatMap(t =>
      t.videos.map(v => ({ ...v, trainingTitle: t.title, trainingCategory: t.category })),
    );
  }, [trainings]);

  const filtered = useMemo(() => {
    return allVideos.filter(v => {
      if (filter !== 'all' && v.contentType !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          v.title.toLowerCase().includes(q) ||
          v.trainingTitle.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allVideos, search, filter]);

  const toggleSelect = (videoId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const handleConfirm = () => {
    const items: SelectedContent[] = [];
    for (const videoId of selected) {
      const v = allVideos.find(x => x.id === videoId);
      if (!v) continue;
      items.push({
        id: Date.now() + Math.random(),
        title: v.title,
        url: v.videoKey || v.videoUrl,
        contentType: (v.contentType as 'video' | 'pdf' | 'audio') || 'video',
        durationSeconds: v.durationSeconds,
        pageCount: v.pageCount ?? undefined,
        documentKey: v.documentKey ?? undefined,
      });
    }
    onSelect(items);
    setSelected(new Set());
    setSearch('');
    onClose();
  };

  const handleClose = () => {
    setSelected(new Set());
    setSearch('');
    onClose();
  };

  const filters: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'Tümü' },
    { key: 'video', label: 'Video' },
    { key: 'audio', label: 'Ses' },
    { key: 'pdf', label: 'Doküman' },
  ];

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
            <Library className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
            Kütüphaneden İçerik Seç
          </DialogTitle>
          <DialogDescription>
            Mevcut eğitimlerinizdeki video, ses ve dokümanlardan seçin
          </DialogDescription>
        </DialogHeader>

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <Input
              placeholder="İçerik veya eğitim adı ile ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {filters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{
                  background: filter === f.key ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: filter === f.key ? 'white' : 'var(--color-text-secondary)',
                  border: `1px solid ${filter === f.key ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <ScrollArea className="flex-1 min-h-0 -mx-6 px-6" style={{ maxHeight: 'calc(85vh - 280px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span className="ml-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Yükleniyor...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Library className="h-10 w-10 mx-auto mb-2" style={{ color: 'var(--color-text-muted)', opacity: 0.5 }} />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {search ? 'Aramanızla eşleşen içerik bulunamadı' : 'Henüz kütüphanede içerik yok'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {filtered.map(v => {
                const isSelected = selected.has(v.id);
                const Icon = CONTENT_ICON[v.contentType] ?? Video;
                return (
                  <button
                    key={v.id}
                    onClick={() => toggleSelect(v.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: isSelected ? 'var(--color-primary-light)' : 'var(--color-surface)',
                      border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    }}
                  >
                    {/* Check / Icon */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: isSelected ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                        color: isSelected ? 'white' : 'var(--color-text-muted)',
                      }}
                    >
                      {isSelected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {v.title}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                        {v.trainingTitle}
                      </p>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                        {CONTENT_LABEL[v.contentType] ?? 'Video'}
                      </Badge>
                      {v.durationSeconds > 0 && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          <Clock className="h-3 w-3" />
                          {formatDuration(v.durationSeconds)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {selected.size > 0 ? `${selected.size} içerik seçildi` : 'İçerik seçin'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              İptal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              style={{ background: 'var(--color-primary)', color: 'white' }}
            >
              <Check className="h-4 w-4 mr-1" />
              Seçilenleri Ekle ({selected.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
