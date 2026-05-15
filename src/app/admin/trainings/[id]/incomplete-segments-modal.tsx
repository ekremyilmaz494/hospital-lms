'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Loader2, XCircle, UserX, Clock4, CalendarRange } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import {
  CREAM, INK, INK_SOFT, GOLD, RULE, CARD_BG, STATUS_TOKENS, TONE_TOKENS,
  FONT_DISPLAY, FONT_MONO,
} from '@/lib/editorial-palette';

type Segment = 'failed' | 'no_show' | 'overdue_in_progress';

interface FailedRow {
  assignmentId: string;
  userId: string;
  name: string;
  department: string | null;
  currentAttempt: number;
  maxAttempts: number;
  lastScore: number | null;
  round: number;
}

interface NoShowRow {
  assignmentId: string;
  userId: string;
  name: string;
  department: string | null;
  round: number;
}

interface OverdueRow {
  assignmentId: string;
  userId: string;
  name: string;
  department: string | null;
  currentAttempt: number;
  round: number;
}

interface SegmentsResponse {
  failed: FailedRow[];
  noShow: NoShowRow[];
  overdueInProgress: OverdueRow[];
}

interface Props {
  trainingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const SEGMENT_META: Record<Segment, {
  label: string;
  icon: typeof XCircle;
  tone: { bg: string; border: string; ink: string };
  description: string;
}> = {
  failed: {
    label: 'Başarısız Olanlar',
    icon: XCircle,
    tone: TONE_TOKENS.danger,
    description: 'Sınava girdi ancak deneme haklarını tükettiği için başarısız oldu',
  },
  no_show: {
    label: 'Sisteme Girmeyenler',
    icon: UserX,
    tone: TONE_TOKENS.info,
    description: 'Atandı ancak süresi dolana kadar eğitime hiç girmedi',
  },
  overdue_in_progress: {
    label: 'Süresi Geçip Yarım Bırakanlar',
    icon: Clock4,
    tone: TONE_TOKENS.warning,
    description: 'Eğitime başladı ancak bitiş tarihine kadar tamamlamadı',
  },
};

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 59, 0);
  return d.toISOString().slice(0, 16); // datetime-local format
}

export function IncompleteSegmentsModal({ trainingId, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useFetch<SegmentsResponse>(
    open ? `/api/admin/trainings/${trainingId}/assignments?incompleteSegments=1` : null,
  );

  const [segment, setSegment] = useState<Segment>('failed');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newDueDate, setNewDueDate] = useState<string>(tomorrowISO());
  const [additionalAttempts, setAdditionalAttempts] = useState(3);
  const [submitting, setSubmitting] = useState(false);

  // Modal kapanınca/segment değişince seçimi sıfırla — yanlışlıkla
  // başka segmentten kullanıcı taşımayı engeller.
  useEffect(() => {
    if (!open) {
      setSelectedIds(new Set());
      setSegment('failed');
      setNewDueDate(tomorrowISO());
      setAdditionalAttempts(3);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [segment]);

  const currentRows = useMemo<Array<{ userId: string; name: string; department: string | null; round: number; meta?: string }>>(() => {
    if (!data) return [];
    if (segment === 'failed') {
      return data.failed.map(r => ({
        userId: r.userId,
        name: r.name,
        department: r.department,
        round: r.round,
        meta: `${r.currentAttempt}/${r.maxAttempts} deneme${r.lastScore !== null ? ` · son puan ${r.lastScore}` : ''}`,
      }));
    }
    if (segment === 'no_show') {
      return data.noShow.map(r => ({ userId: r.userId, name: r.name, department: r.department, round: r.round }));
    }
    return data.overdueInProgress.map(r => ({
      userId: r.userId,
      name: r.name,
      department: r.department,
      round: r.round,
      meta: `${r.currentAttempt} deneme yapıldı`,
    }));
  }, [data, segment]);

  const counts = useMemo(
    () => ({
      failed: data?.failed.length ?? 0,
      no_show: data?.noShow.length ?? 0,
      overdue_in_progress: data?.overdueInProgress.length ?? 0,
    }),
    [data],
  );

  const allSelected = currentRows.length > 0 && currentRows.every(r => selectedIds.has(r.userId));

  function toggle(userId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentRows.map(r => r.userId)));
  }

  async function handleSubmit() {
    if (selectedIds.size === 0) {
      toast('En az bir personel seçmelisiniz', 'error');
      return;
    }
    const dueDate = new Date(newDueDate);
    if (Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= Date.now()) {
      toast('Yeni bitiş tarihi gelecekte olmalı', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/trainings/${trainingId}/reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          newDueDate: dueDate.toISOString(),
          reason: segment,
          additionalAttempts,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json.error || 'Yeniden atama başarısız', 'error');
        return;
      }
      toast(`${json.created} kişi için 2. atama oluşturuldu — yeni bitiş ${dueDate.toLocaleDateString('tr-TR')}`, 'success');
      onSuccess();
      onOpenChange(false);
      void refetch();
    } catch (err) {
      toast(`Beklenmeyen hata: ${(err as Error).message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl" style={{ background: CREAM, fontFamily: FONT_DISPLAY }}>
        <DialogHeader>
          <DialogTitle style={{ color: INK, fontFamily: FONT_DISPLAY, fontWeight: 600 }}>
            Tamamlamayanları Yeniden Ata
          </DialogTitle>
          <DialogDescription style={{ color: INK_SOFT }}>
            Belirtilen tarihe kadar eğitimi tamamlamayan personelleri seçin, yeni bir bitiş tarihiyle 2. atama açın.
            Mevcut atama kaydı bozulmaz; yeni satır olarak takip turu eklenir.
          </DialogDescription>
        </DialogHeader>

        {/* Segment sekmeleri */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {(['failed', 'no_show', 'overdue_in_progress'] as Segment[]).map(s => {
            const meta = SEGMENT_META[s];
            const Icon = meta.icon;
            const active = segment === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSegment(s)}
                className="rounded-2xl px-3 py-3 text-left border"
                style={{
                  background: active ? meta.tone.bg : CARD_BG,
                  borderColor: active ? meta.tone.border : RULE,
                  color: active ? meta.tone.ink : INK,
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon size={16} />
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{meta.label}</span>
                </div>
                <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: INK_SOFT, marginTop: 4 }}>
                  {counts[s]} kişi
                </div>
              </button>
            );
          })}
        </div>

        <div
          className="rounded-xl border px-3 py-2 mt-2"
          style={{ borderColor: SEGMENT_META[segment].tone.border, background: SEGMENT_META[segment].tone.bg, color: SEGMENT_META[segment].tone.ink, fontSize: 12 }}
        >
          {SEGMENT_META[segment].description}
        </div>

        {/* Liste */}
        <div className="border rounded-xl overflow-hidden" style={{ borderColor: RULE, background: CARD_BG, maxHeight: 320, overflowY: 'auto' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8" style={{ color: INK_SOFT }}>
              <Loader2 className="animate-spin" size={18} />
            </div>
          ) : currentRows.length === 0 ? (
            <div className="text-center py-8" style={{ color: INK_SOFT, fontSize: 13 }}>
              Bu segmentte personel yok.
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-3 px-3 py-2 border-b sticky top-0"
                style={{ borderColor: RULE, background: CARD_BG }}
              >
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="cursor-pointer"
                  style={{ accentColor: GOLD }}
                />
                <span style={{ fontSize: 12, color: INK_SOFT, fontFamily: FONT_MONO }}>
                  Tümünü Seç ({selectedIds.size}/{currentRows.length})
                </span>
              </div>
              {currentRows.map(row => {
                const checked = selectedIds.has(row.userId);
                return (
                  <label
                    key={row.userId}
                    className="flex items-center gap-3 px-3 py-2 border-b cursor-pointer"
                    style={{ borderColor: RULE, background: checked ? STATUS_TOKENS.assigned.bg : 'transparent' }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(row.userId)}
                      style={{ accentColor: GOLD }}
                    />
                    <div className="flex-1 min-w-0">
                      <div style={{ color: INK, fontSize: 13, fontWeight: 500 }}>{row.name}</div>
                      <div style={{ color: INK_SOFT, fontSize: 11 }}>
                        {row.department ?? 'Birim atanmamış'}
                        {row.meta ? ` · ${row.meta}` : ''}
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2 py-0.5"
                      style={{
                        background: STATUS_TOKENS.neutral.bg,
                        color: STATUS_TOKENS.neutral.ink,
                        fontSize: 10,
                        fontFamily: FONT_MONO,
                      }}
                    >
                      {row.round}. tur
                    </span>
                  </label>
                );
              })}
            </>
          )}
        </div>

        {/* Footer kontrolleri */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <label className="flex flex-col gap-1" style={{ fontSize: 12, color: INK_SOFT }}>
            <span className="flex items-center gap-1"><CalendarRange size={14} /> Yeni Bitiş Tarihi</span>
            <input
              type="datetime-local"
              value={newDueDate}
              min={tomorrowISO()}
              onChange={e => setNewDueDate(e.target.value)}
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: RULE, background: CARD_BG, color: INK }}
            />
          </label>
          <label className="flex flex-col gap-1" style={{ fontSize: 12, color: INK_SOFT }}>
            <span>Maks. Deneme Hakkı (1-10)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={additionalAttempts}
              onChange={e => setAdditionalAttempts(Math.max(1, Math.min(10, Number(e.target.value) || 3)))}
              className="rounded-lg border px-3 py-2"
              style={{ borderColor: RULE, background: CARD_BG, color: INK }}
            />
          </label>
        </div>

        <DialogFooter className="mt-3 gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="rounded-full px-4 py-2 border"
            style={{ borderColor: RULE, color: INK_SOFT, background: 'transparent', fontSize: 13 }}
          >
            İptal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || selectedIds.size === 0}
            className="rounded-full px-4 py-2"
            style={{
              background: GOLD,
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              opacity: submitting || selectedIds.size === 0 ? 0.5 : 1,
            }}
          >
            {submitting ? 'Oluşturuluyor…' : `2. Atamayı Oluştur (${selectedIds.size} kişi)`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
