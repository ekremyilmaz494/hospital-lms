'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Bell, Check, CheckCheck, AlertTriangle, Info, CheckCircle, Zap,
  BellOff, Search, X, Filter, BookOpen, Calendar, Award,
  MessageSquare, Megaphone, Clock3, Sparkles, Inbox, ChevronRight,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  relatedTrainingId: string | null;
  relatedTraining: { id: string; title: string } | null;
}

type TypeKey =
  | 'error' | 'warning' | 'info' | 'success'
  | 'reminder' | 'assignment' | 'announcement'
  | 'competency_evaluation' | 'subscription_expiry';

interface TypeMeta {
  label: string;
  icon: typeof Bell;
  color: string;
  tint: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  error:                 { label: 'Acil',         icon: Zap,            color: 'var(--color-error)',    tint: 'var(--color-error-bg)' },
  warning:               { label: 'Uyarı',        icon: AlertTriangle,  color: 'var(--color-warning)',  tint: 'var(--color-warning-bg)' },
  info:                  { label: 'Bilgi',        icon: Info,           color: 'var(--color-info)',     tint: 'var(--color-info-bg)' },
  success:               { label: 'Başarılı',     icon: CheckCircle,    color: 'var(--color-success)',  tint: 'var(--color-success-bg)' },
  reminder:              { label: 'Hatırlatma',   icon: Clock3,         color: '#d97706',               tint: '#fef3c7' },
  assignment:            { label: 'Yeni Eğitim',  icon: BookOpen,       color: '#0d9668',               tint: '#d1fae5' },
  announcement:          { label: 'Duyuru',       icon: Megaphone,      color: '#4f46e5',               tint: '#e0e7ff' },
  competency_evaluation: { label: 'Yetkinlik',    icon: MessageSquare,  color: '#7c3aed',               tint: '#ede9fe' },
  subscription_expiry:   { label: 'Abonelik',     icon: Sparkles,       color: '#e11d48',               tint: '#ffe4e6' },
};

function getTypeMeta(t: string): TypeMeta {
  return TYPE_META[t] ?? TYPE_META.info;
}

const FILTER_TYPES: TypeKey[] = [
  'reminder', 'assignment', 'announcement', 'competency_evaluation',
  'warning', 'info', 'success', 'error',
];

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

type Bucket = 'today' | 'yesterday' | 'thisWeek' | 'older';
const BUCKET_LABEL: Record<Bucket, string> = {
  today: 'Bugün',
  yesterday: 'Dün',
  thisWeek: 'Bu Hafta',
  older: 'Daha Önce',
};

function bucketOf(dateStr: string): Bucket {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(dateStr));
  const diffDays = Math.round((today - target) / 86_400_000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return 'thisWeek';
  return 'older';
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Az önce';
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün`;
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

function formatExactTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function StaffNotificationsPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } =
    useFetch<{ notifications: Notification[]; unreadCount: number }>('/api/staff/notifications');

  // Action state
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Optimistic overlays
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(new Set());
  const [optimisticAllRead, setOptimisticAllRead] = useState(false);

  // UI state
  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<TypeKey>>(new Set());
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Apply optimistic state
  const allNotifications = useMemo(() => {
    const raw = data?.notifications ?? [];
    return raw.map(n =>
      optimisticAllRead || optimisticReadIds.has(n.id) ? { ...n, isRead: true } : n
    );
  }, [data, optimisticAllRead, optimisticReadIds]);

  const rawUnreadCount = data?.unreadCount ?? 0;
  const unreadCount = optimisticAllRead
    ? 0
    : Math.max(0, rawUnreadCount - optimisticReadIds.size);

  // Stats
  const stats = useMemo(() => {
    const total = allNotifications.length;
    const unread = allNotifications.filter(n => !n.isRead).length;
    const weekTs = Date.now() - 7 * 86_400_000;
    const week = allNotifications.filter(n => new Date(n.createdAt).getTime() >= weekTs).length;
    return { total, unread, week };
  }, [allNotifications]);

  // Type-based counts (for filter chip badges)
  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of allNotifications) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  }, [allNotifications]);

  // Filter pipeline
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return allNotifications.filter(n => {
      if (showUnreadOnly && n.isRead) return false;
      if (activeTypes.size > 0 && !activeTypes.has(n.type as TypeKey)) return false;
      if (q) {
        const hay = `${n.title} ${n.message} ${n.relatedTraining?.title ?? ''}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allNotifications, search, activeTypes, showUnreadOnly]);

  // Group by date bucket
  const grouped = useMemo(() => {
    const buckets: Record<Bucket, Notification[]> = { today: [], yesterday: [], thisWeek: [], older: [] };
    for (const n of filtered) buckets[bucketOf(n.createdAt)].push(n);
    return buckets;
  }, [filtered]);

  const visibleIds = useMemo(() => filtered.map(n => n.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

  // Selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAllVisible = useCallback(() => {
    setSelected(prev => allVisibleSelected ? new Set() : new Set([...prev, ...visibleIds]));
  }, [allVisibleSelected, visibleIds]);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  // Mark single as read
  const handleMarkRead = useCallback(async (id: string) => {
    setOptimisticReadIds(prev => new Set(prev).add(id));
    setMarkingId(id);
    try {
      const res = await fetch(`/api/staff/notifications?id=${id}`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      void refetch();
      setOptimisticReadIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    } catch {
      setOptimisticReadIds(prev => { const s = new Set(prev); s.delete(id); return s; });
      toast('İşlem başarısız', 'error');
    } finally {
      setMarkingId(null);
    }
  }, [refetch, toast]);

  // Mark selected as read
  const handleMarkSelectedRead = useCallback(async () => {
    if (selected.size === 0) return;
    const ids = [...selected];
    setOptimisticReadIds(prev => { const s = new Set(prev); ids.forEach(i => s.add(i)); return s; });
    setSelected(new Set());
    try {
      await Promise.all(
        ids.map(id => fetch(`/api/staff/notifications?id=${id}`, { method: 'PATCH' }))
      );
      toast(`${ids.length} bildirim okundu olarak işaretlendi`, 'success');
      void refetch();
      setOptimisticReadIds(prev => { const s = new Set(prev); ids.forEach(i => s.delete(i)); return s; });
    } catch {
      setOptimisticReadIds(prev => { const s = new Set(prev); ids.forEach(i => s.delete(i)); return s; });
      toast('Bazı işlemler başarısız oldu', 'error');
    }
  }, [selected, refetch, toast]);

  // Mark all as read
  const handleMarkAllRead = useCallback(async () => {
    if (rawUnreadCount === 0) return;
    setOptimisticAllRead(true);
    setMarkingAll(true);
    try {
      const res = await fetch('/api/staff/notifications', { method: 'PATCH' });
      if (!res.ok) throw new Error();
      toast('Tüm bildirimler okundu', 'success');
      void refetch();
      setOptimisticAllRead(false);
    } catch {
      setOptimisticAllRead(false);
      toast('İşlem başarısız', 'error');
    } finally {
      setMarkingAll(false);
    }
  }, [rawUnreadCount, refetch, toast]);

  const toggleType = useCallback((t: TypeKey) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t); else next.add(t);
      return next;
    });
  }, []);
  const clearAllFilters = useCallback(() => {
    setActiveTypes(new Set());
    setSearch('');
    setShowUnreadOnly(false);
  }, []);

  // Keyboard: Esc clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected.size > 0) clearSelection();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected.size, clearSelection]);

  if (isLoading) return <NotificationsSkeleton />;

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-3xl border py-20 text-center"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
      >
        <AlertTriangle className="mb-4 h-10 w-10" style={{ color: 'var(--color-error)' }} />
        <p className="text-sm font-semibold">Bildirimler yüklenemedi</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{error}</p>
      </div>
    );
  }

  const hasAnyFilter = search.length > 0 || activeTypes.size > 0 || showUnreadOnly;
  const totalAfterFilter = filtered.length;
  const filterChipsActive = activeTypes.size + (showUnreadOnly ? 1 : 0);

  return (
    <div className="relative pb-32 lg:pb-8">
      {/* ── HEADER ──────────────────────────────────────────────── */}
      <header className="mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p
              className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}
            >
              EY · Personel Paneli
            </p>
            <h1
              className="text-[28px] sm:text-[34px] font-bold leading-tight tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Bildirim Merkezi
            </h1>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Eğitim atamaları, hatırlatmalar ve duyurular tek bir yerde.
            </p>
          </div>

          <button
            onClick={handleMarkAllRead}
            disabled={markingAll || unreadCount === 0}
            className="group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-semibold transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: unreadCount > 0 ? 'var(--color-primary)' : 'var(--color-surface)',
              color: unreadCount > 0 ? 'white' : 'var(--color-text-muted)',
              border: unreadCount > 0 ? 'none' : '1px solid var(--color-border)',
              boxShadow: unreadCount > 0 ? '0 6px 20px rgba(13, 150, 104, 0.25)' : 'none',
            }}
          >
            <CheckCheck className="h-4 w-4" />
            {markingAll ? 'İşaretleniyor…' : 'Tümünü Okundu'}
          </button>
        </div>

        {/* Stat tiles */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          <StatTile label="Toplam" value={stats.total} />
          <StatTile label="Okunmamış" value={stats.unread} accent />
          <StatTile label="Bu Hafta" value={stats.week} />
        </div>
      </header>

      {/* ── TOOLBAR ─────────────────────────────────────────────── */}
      <div
        className="sticky top-16 z-20 mb-5 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 sm:py-0 border-b sm:border-0"
        style={{
          background: 'rgba(var(--color-bg-rgb, 241, 245, 249), 0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Bildirimlerde ara…"
              className="h-11 rounded-xl pl-10 pr-9 text-sm"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Aramayı temizle"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 hover:bg-[var(--color-bg)]"
              >
                <X className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            )}
          </div>

          {/* Filter trigger (mobile) */}
          <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
            <SheetTrigger
              className="lg:hidden relative inline-flex h-11 w-11 items-center justify-center rounded-xl border"
              aria-label="Filtreler"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <Filter className="h-4.5 w-4.5" style={{ color: 'var(--color-text-secondary)' }} />
              {filterChipsActive > 0 && (
                <span
                  className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {filterChipsActive}
                </span>
              )}
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] p-0">
              <SheetHeader className="border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
                <SheetTitle className="text-base font-bold">Filtreler</SheetTitle>
              </SheetHeader>
              <FilterBody
                activeTypes={activeTypes}
                showUnreadOnly={showUnreadOnly}
                typeCounts={typeCounts}
                onToggleType={toggleType}
                onToggleUnread={() => setShowUnreadOnly(v => !v)}
                onClear={clearAllFilters}
              />
            </SheetContent>
          </Sheet>
        </div>

        {/* Inline chip rail (lg+) */}
        <div className="hidden lg:flex mt-3 flex-wrap items-center gap-2">
          <FilterChip
            active={showUnreadOnly}
            onClick={() => setShowUnreadOnly(v => !v)}
            color="var(--color-primary)"
            tint="var(--color-primary-light)"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--color-primary)' }} />
            Sadece okunmamış
          </FilterChip>
          {FILTER_TYPES.map(t => {
            const m = getTypeMeta(t);
            const c = typeCounts[t] ?? 0;
            if (c === 0) return null;
            return (
              <FilterChip
                key={t}
                active={activeTypes.has(t)}
                onClick={() => toggleType(t)}
                color={m.color}
                tint={m.tint}
              >
                <m.icon className="h-3.5 w-3.5" />
                {m.label}
                <span className="font-mono text-[10px] opacity-70">{c}</span>
              </FilterChip>
            );
          })}
          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="ml-1 inline-flex items-center gap-1 text-[12px] font-semibold underline decoration-dotted underline-offset-4"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Filtreleri temizle
            </button>
          )}
        </div>
      </div>

      {/* ── SELECT-ALL BAR (when any items visible) ─────────────── */}
      {visibleIds.length > 0 && (
        <div className="mb-3 flex items-center justify-between px-1">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <Checkbox checked={allVisibleSelected} onCheckedChange={selectAllVisible} />
            <span className="text-[12px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              {selected.size > 0
                ? `${selected.size} seçildi`
                : `${totalAfterFilter} bildirim`}
            </span>
          </label>
          {hasAnyFilter && totalAfterFilter !== allNotifications.length && (
            <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
              {totalAfterFilter} / {allNotifications.length}
            </span>
          )}
        </div>
      )}

      {/* ── LIST ────────────────────────────────────────────────── */}
      {totalAfterFilter === 0 ? (
        <EmptyState hasFilters={hasAnyFilter} onClearFilters={clearAllFilters} />
      ) : (
        <div className="space-y-8">
          {(['today', 'yesterday', 'thisWeek', 'older'] as Bucket[]).map(bucket => {
            const items = grouped[bucket];
            if (items.length === 0) return null;
            return (
              <section key={bucket}>
                {/* Date label with timeline rule */}
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    <Calendar className="h-3 w-3" />
                    {BUCKET_LABEL[bucket]}
                  </span>
                  <div className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
                  <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {items.length}
                  </span>
                </div>

                <ul className="space-y-2">
                  {items.map(n => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      selected={selected.has(n.id)}
                      onToggleSelect={() => toggleSelect(n.id)}
                      onMarkRead={() => handleMarkRead(n.id)}
                      isMarking={markingId === n.id}
                      anySelected={selected.size > 0}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {/* ── BULK ACTION BAR (sticky bottom when selected) ───────── */}
      {selected.size > 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 lg:px-8"
          style={{
            background: 'linear-gradient(to top, var(--color-bg) 60%, transparent)',
          }}
        >
          <div
            className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-2xl px-4 py-3"
            style={{
              background: 'var(--color-text-primary)',
              color: 'white',
              boxShadow: '0 16px 40px -12px rgba(0,0,0,0.45)',
            }}
          >
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 text-[12px] font-bold"
                style={{ background: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}
              >
                {selected.size}
              </span>
              <span className="text-[13px] font-medium">bildirim seçildi</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkSelectedRead}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-[12px] font-semibold transition-colors hover:bg-white/25"
              >
                <Check className="h-3.5 w-3.5" />
                Okundu
              </button>
              <button
                onClick={clearSelection}
                aria-label="Seçimi temizle"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────────────── */

function StatTile({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        background: accent
          ? 'linear-gradient(135deg, var(--color-primary-light), var(--color-surface))'
          : 'var(--color-surface)',
        borderColor: accent ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)' : 'var(--color-border)',
      }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{
          fontFamily: 'var(--font-display)',
          color: accent ? 'var(--color-primary)' : 'var(--color-text-primary)',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  children, active, onClick, color, tint,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color: string;
  tint: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150 hover:-translate-y-px active:translate-y-0"
      style={{
        background: active ? tint : 'var(--color-surface)',
        borderColor: active ? color : 'var(--color-border)',
        color: active ? color : 'var(--color-text-secondary)',
      }}
    >
      {children}
    </button>
  );
}

function FilterBody({
  activeTypes, showUnreadOnly, typeCounts,
  onToggleType, onToggleUnread, onClear,
}: {
  activeTypes: Set<TypeKey>;
  showUnreadOnly: boolean;
  typeCounts: Record<string, number>;
  onToggleType: (t: TypeKey) => void;
  onToggleUnread: () => void;
  onClear: () => void;
}) {
  return (
    <div className="px-5 py-4">
      <button
        onClick={onToggleUnread}
        className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left"
        style={{
          background: showUnreadOnly ? 'var(--color-primary-light)' : 'var(--color-bg)',
          color: showUnreadOnly ? 'var(--color-primary)' : 'var(--color-text-primary)',
        }}
      >
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold">
          <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-primary)' }} />
          Sadece okunmamış
        </span>
        <Checkbox checked={showUnreadOnly} onCheckedChange={onToggleUnread} />
      </button>

      <p className="mt-5 mb-2 text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--color-text-muted)' }}>
        Tip
      </p>
      <div className="flex flex-wrap gap-2">
        {FILTER_TYPES.map(t => {
          const m = getTypeMeta(t);
          const c = typeCounts[t] ?? 0;
          if (c === 0) return null;
          return (
            <FilterChip
              key={t}
              active={activeTypes.has(t)}
              onClick={() => onToggleType(t)}
              color={m.color}
              tint={m.tint}
            >
              <m.icon className="h-3.5 w-3.5" />
              {m.label}
              <span className="font-mono text-[10px] opacity-70">{c}</span>
            </FilterChip>
          );
        })}
      </div>

      <button
        onClick={onClear}
        className="mt-5 w-full rounded-xl py-3 text-[13px] font-semibold"
        style={{
          background: 'var(--color-bg)',
          color: 'var(--color-text-secondary)',
        }}
      >
        Tümünü temizle
      </button>
    </div>
  );
}

function NotificationCard({
  notification: n, selected, onToggleSelect, onMarkRead, isMarking, anySelected,
}: {
  notification: Notification;
  selected: boolean;
  onToggleSelect: () => void;
  onMarkRead: () => void;
  isMarking: boolean;
  anySelected: boolean;
}) {
  const m = getTypeMeta(n.type);
  const Icon = m.icon;
  const unread = !n.isRead;

  return (
    <li
      className="group relative overflow-hidden rounded-2xl transition-all duration-200"
      style={{
        background: 'var(--color-surface)',
        border: `1px solid ${selected ? m.color : 'var(--color-border)'}`,
        boxShadow: unread ? '0 1px 0 rgba(0,0,0,0.02)' : 'none',
      }}
    >
      {/* Vertical accent stripe (left) */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: unread ? m.color : 'transparent' }}
      />

      <div className="flex items-start gap-3 p-4 pl-5 sm:p-5 sm:pl-6">
        {/* Checkbox: visible on hover OR when selection mode active */}
        <div
          className={[
            'pt-1 transition-opacity duration-150',
            anySelected || selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
          ].join(' ')}
        >
          <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Bildirimi seç" />
        </div>

        {/* Icon tile */}
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: m.tint,
            color: m.color,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${m.color} 18%, transparent)`,
          }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3
              className="text-[14px] font-semibold leading-tight"
              style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}
            >
              {n.title}
            </h3>
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
              style={{ background: m.tint, color: m.color }}
            >
              {m.label}
            </span>
            {unread && (
              <span
                className="inline-flex h-1.5 w-1.5 rounded-full"
                style={{ background: m.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${m.color} 24%, transparent)` }}
                aria-label="Okunmamış"
              />
            )}
          </div>

          <p
            className="mt-1.5 text-[13px] leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {n.message}
          </p>

          {/* Footer row */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <time
              className="inline-flex items-center gap-1 text-[11px] font-mono tabular-nums"
              style={{ color: 'var(--color-text-muted)' }}
              dateTime={n.createdAt}
              title={new Date(n.createdAt).toLocaleString('tr-TR')}
            >
              <Clock3 className="h-3 w-3" />
              {formatRelativeTime(n.createdAt)}
              <span className="opacity-60">· {formatExactTime(n.createdAt)}</span>
            </time>

            {n.relatedTrainingId && (
              <Link
                href={`/staff/my-trainings`}
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-primary)',
                }}
              >
                <Award className="h-3 w-3" />
                <span className="max-w-[180px] truncate">
                  {n.relatedTraining?.title ?? 'Eğitime Git'}
                </span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center">
          {unread ? (
            <button
              onClick={onMarkRead}
              disabled={isMarking}
              aria-label="Okundu işaretle"
              title="Okundu işaretle"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
              style={{
                background: 'var(--color-bg)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Check className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center" aria-label="Okundu" title="Okundu">
              <CheckCircle className="h-4 w-4" style={{ color: 'var(--color-text-muted)', opacity: 0.4 }} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function EmptyState({ hasFilters, onClearFilters }: { hasFilters: boolean; onClearFilters: () => void }) {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border px-6 py-16 text-center"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Decorative dotted grid */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="empty-dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="currentColor" style={{ color: 'var(--color-text-primary)' }} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#empty-dots)" />
      </svg>

      <div className="relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
      >
        {hasFilters ? <Inbox className="h-7 w-7" /> : <BellOff className="h-7 w-7" />}
      </div>
      <h3
        className="relative text-[16px] font-bold"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {hasFilters ? 'Eşleşen bildirim yok' : 'Şu an bildiriminiz yok'}
      </h3>
      <p
        className="relative mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {hasFilters
          ? 'Filtrelerinizi gevşetip tekrar deneyin. Aramayı temizleyebilir veya tip filtresini kaldırabilirsiniz.'
          : 'Yeni bir eğitim atandığında, hatırlatma yapıldığında veya hastane duyurusu yayımlandığında burada görünecek.'}
      </p>
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="relative mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          <X className="h-3.5 w-3.5" />
          Filtreleri temizle
        </button>
      )}
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="mb-2 h-3 w-32 rounded" style={{ background: 'var(--color-border)' }} />
        <div className="h-9 w-72 rounded-lg" style={{ background: 'var(--color-border)' }} />
        <div className="mt-6 grid grid-cols-3 gap-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-20 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
          ))}
        </div>
      </div>
      <div className="mb-5 h-11 rounded-xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
      <div className="space-y-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }} />
        ))}
      </div>
    </div>
  );
}
