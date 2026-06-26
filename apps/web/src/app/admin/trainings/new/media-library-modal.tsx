'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { Search, Video, Music, Check, Library, Clock, Loader2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';

interface MediaAssetItem {
  id: string;
  title: string;
  description: string | null;
  mediaType: 'video' | 'audio';
  s3Key: string;
  durationSeconds: number | null;
  usageCount: number;
}

/** Wizard'a eklenecek içerik yapısı (VideoItem'e map edilir). */
export interface SelectedContent {
  id: number;
  title: string;
  url: string;
  contentType: 'video' | 'pdf' | 'audio';
  durationSeconds?: number;
  pageCount?: number;
  documentKey?: string;
  /** Medya kütüphanesinden seçildiyse kaynak asset id (soft geri-bağ). */
  sourceMediaAssetId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (items: SelectedContent[]) => void;
  defaultFilter?: 'all' | 'video' | 'audio';
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s > 0 ? `${m}dk ${s}s` : `${m}dk`;
  const h = Math.floor(m / 60);
  return `${h}sa ${m % 60}dk`;
}

const CONTENT_ICON = { video: Video, audio: Music } as const;
const CONTENT_LABEL = { video: 'Video', audio: 'Ses' } as const;

export function MediaLibraryModal({ open, onClose, onSelect, defaultFilter = 'all' }: Props) {
  const { data, isLoading } = useFetch<{ items: MediaAssetItem[] }>(
    open ? '/api/admin/media-library' : null
  );
  const items = useMemo(() => data?.items ?? [], [data]);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'video' | 'audio'>(defaultFilter);

  useEffect(() => {
    if (open) setFilter(defaultFilter);
  }, [open, defaultFilter]);

  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (filter !== 'all' && it.mediaType !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          it.title.toLowerCase().includes(q) || (it.description?.toLowerCase().includes(q) ?? false)
        );
      }
      return true;
    });
  }, [items, search, filter]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const picked: SelectedContent[] = [];
    for (const id of selected) {
      const it = items.find((x) => x.id === id);
      if (!it) continue;
      picked.push({
        id: Date.now() + Math.floor(Math.random() * 1e6),
        title: it.title,
        url: it.s3Key, // s3Key paylaşılır → publish'te videoKey olur
        contentType: it.mediaType,
        durationSeconds: it.durationSeconds ?? undefined,
        sourceMediaAssetId: it.id,
      });
    }
    onSelect(picked);
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
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle
            className="flex items-center gap-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <Library className="h-5 w-5" style={{ color: '#0d9668' }} />
            Kütüphaneden İçerik Seç
          </DialogTitle>
          <DialogDescription>
            Medya kütüphanenizdeki video ve ses dosyalarından seçin
          </DialogDescription>
        </DialogHeader>

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
              style={{ color: '#78716c' }}
            />
            <Input
              placeholder="İçerik adı ile ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  background: filter === f.key ? '#0d9668' : '#ffffff',
                  color: filter === f.key ? 'white' : '#44403c',
                  border: `1px solid ${filter === f.key ? '#0d9668' : '#c9c4be'}`,
                  transition: 'background-color 150ms ease, color 150ms ease',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content List */}
        <div className="-mx-6 min-h-0 flex-1 overflow-y-auto px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#0d9668' }} />
              <span className="ml-2 text-sm" style={{ color: '#78716c' }}>
                Yükleniyor...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Library
                className="mx-auto mb-2 h-10 w-10"
                style={{ color: '#78716c', opacity: 0.5 }}
              />
              <p className="text-sm" style={{ color: '#78716c' }}>
                {search ? 'Aramanızla eşleşen içerik bulunamadı' : 'Henüz kütüphanede içerik yok'}
              </p>
            </div>
          ) : (
            <div className="space-y-2 py-1">
              {filtered.map((it) => {
                const isSelected = selected.has(it.id);
                const Icon = CONTENT_ICON[it.mediaType] ?? Video;
                return (
                  <button
                    key={it.id}
                    onClick={() => toggleSelect(it.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left"
                    style={{
                      background: isSelected ? '#d1fae5' : '#ffffff',
                      border: `1.5px solid ${isSelected ? '#0d9668' : '#c9c4be'}`,
                      transition: 'background-color 150ms ease, border-color 150ms ease',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background: isSelected ? '#0d9668' : '#f5f5f4',
                        color: isSelected ? 'white' : '#78716c',
                      }}
                    >
                      {isSelected ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: '#1c1917' }}>
                        {it.title}
                      </p>
                      {it.usageCount > 0 && (
                        <p className="truncate text-xs" style={{ color: '#78716c' }}>
                          {it.usageCount} eğitimde kullanılıyor
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant="outline" className="px-1.5 py-0.5 text-[10px]">
                        {CONTENT_LABEL[it.mediaType] ?? 'Video'}
                      </Badge>
                      {(it.durationSeconds ?? 0) > 0 && (
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: '#78716c' }}
                        >
                          <Clock className="h-3 w-3" />
                          {formatDuration(it.durationSeconds ?? 0)}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <p className="text-xs" style={{ color: '#78716c' }}>
            {selected.size > 0 ? `${selected.size} içerik seçildi` : 'İçerik seçin'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>
              İptal
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              style={{ background: '#0d9668', color: 'white' }}
            >
              <Check className="mr-1 h-4 w-4" />
              Seçilenleri Ekle ({selected.size})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
