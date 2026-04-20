'use client';

/**
 * Bildirim Merkezi — "Clinical Editorial" redesign.
 * Gazete/kardiyograf dili: timeline spine, day diamond notches, mono caps,
 * Jakarta Sans bold display + Inter body + JetBrains mono meta.
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Check, CheckCheck, AlertTriangle, Info, CheckCircle, Zap,
  BellOff, Search, X, BookOpen, Award, MessageSquare, Megaphone,
  Clock3, Sparkles, Inbox, ChevronRight, Filter,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { Checkbox } from '@/components/ui/checkbox';

/* ─────────────────────────────────────────────────────
   Domain
   ───────────────────────────────────────────────────── */

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
  icon: typeof Info;
  ink: string;
}

const TYPE_META: Record<string, TypeMeta> = {
  error:                 { label: 'ACİL',            icon: Zap,           ink: '#b3261e' },
  warning:               { label: 'UYARI',           icon: AlertTriangle, ink: '#b4820b' },
  info:                  { label: 'BİLGİ',           icon: Info,          ink: '#2c55b8' },
  success:               { label: 'BAŞARI',          icon: CheckCircle,   ink: '#0a7a47' },
  reminder:              { label: 'HATIRLATMA',      icon: Clock3,        ink: '#b4820b' },
  assignment:            { label: 'EĞİTİM',          icon: BookOpen,      ink: '#1a3a28' },
  announcement:          { label: 'DUYURU',          icon: Megaphone,     ink: '#0b1e3f' },
  competency_evaluation: { label: 'YETKİNLİK',       icon: MessageSquare, ink: '#2c55b8' },
  subscription_expiry:   { label: 'ABONELİK',        icon: Sparkles,      ink: '#8a5a11' },
};

const FILTER_TYPES: TypeKey[] = [
  'assignment', 'reminder', 'announcement', 'competency_evaluation',
  'warning', 'info', 'success', 'error',
];

function getTypeMeta(t: string): TypeMeta {
  return TYPE_META[t] ?? TYPE_META.info;
}

/* ─── Date helpers ─── */

type Bucket = 'today' | 'yesterday' | 'thisWeek' | 'older';

const BUCKET_LABEL: Record<Bucket, string> = {
  today: 'BUGÜN',
  yesterday: 'DÜN',
  thisWeek: 'BU HAFTA',
  older: 'DAHA ÖNCE',
};

function startOfDay(d: Date): number {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c.getTime();
}

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
  if (minutes < 1) return 'az önce';
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

function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ─── Design tokens (editorial palette) ─── */

const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';

/* ─────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────── */

type ViewFilter = 'all' | 'unread' | 'today' | 'week';

export default function StaffNotificationsPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } =
    useFetch<{ notifications: Notification[]; unreadCount: number }>('/api/staff/notifications');

  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [optimisticReadIds, setOptimisticReadIds] = useState<Set<string>>(new Set());
  const [optimisticAllRead, setOptimisticAllRead] = useState(false);

  const [search, setSearch] = useState('');
  const [activeTypes, setActiveTypes] = useState<Set<TypeKey>>(new Set());
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);

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

  const typeCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of allNotifications) c[n.type] = (c[n.type] ?? 0) + 1;
    return c;
  }, [allNotifications]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    const now = Date.now();
    const dayAgo = now - 86_400_000;
    const weekAgo = now - 7 * 86_400_000;

    return allNotifications.filter(n => {
      if (viewFilter === 'unread' && n.isRead) return false;
      if (viewFilter === 'today' && new Date(n.createdAt).getTime() < dayAgo) return false;
      if (viewFilter === 'week' && new Date(n.createdAt).getTime() < weekAgo) return false;
      if (activeTypes.size > 0 && !activeTypes.has(n.type as TypeKey)) return false;
      if (q) {
        const hay = `${n.title} ${n.message} ${n.relatedTraining?.title ?? ''}`.toLocaleLowerCase('tr-TR');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allNotifications, search, activeTypes, viewFilter]);

  const grouped = useMemo(() => {
    const buckets: Record<Bucket, Notification[]> = { today: [], yesterday: [], thisWeek: [], older: [] };
    for (const n of filtered) buckets[bucketOf(n.createdAt)].push(n);
    return buckets;
  }, [filtered]);

  const visibleIds = useMemo(() => filtered.map(n => n.id), [filtered]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));

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
    setViewFilter('all');
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selected.size > 0) clearSelection();
        else if (typeMenuOpen) setTypeMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selected.size, clearSelection, typeMenuOpen]);

  /*
   * Cream theme bleeds into layout: override <main>'s bg and --color-bg-rgb
   * so the topbar (which uses rgba(var(--color-bg-rgb), 0.85)) also inherits cream.
   * Restored on unmount — other pages get their default bg back.
   */
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const el = main as HTMLElement;
    const prevBg = el.style.backgroundColor;
    const prevVar = el.style.getPropertyValue('--color-bg-rgb');
    el.style.backgroundColor = CREAM;
    el.style.setProperty('--color-bg-rgb', '250, 247, 242');
    return () => {
      el.style.backgroundColor = prevBg;
      if (prevVar) el.style.setProperty('--color-bg-rgb', prevVar);
      else el.style.removeProperty('--color-bg-rgb');
    };
  }, []);

  if (isLoading) return <EditorialSkeleton />;
  if (error) return <EditorialError message={error} onRetry={refetch} />;

  const hasAnyFilter = search.length > 0 || activeTypes.size > 0 || viewFilter !== 'all';
  const totalAfterFilter = filtered.length;

  const todayStr = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  }).toUpperCase();

  return (
    <div
      className="-mx-4 -my-4 md:-mx-8 md:-my-8"
      style={{ backgroundColor: CREAM, minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="px-6 pt-6 pb-24 sm:px-10 lg:px-16">
        {/* ═══════════════ MASTHEAD ═══════════════ */}
        <header>
          {/* Top meta rail */}
          <div
            className="flex items-center justify-between border-y py-2 text-[10px] tracking-[0.22em]"
            style={{
              borderColor: INK,
              color: INK,
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span>№ 01 — HASTANE LMS</span>
            <span>{todayStr}</span>
          </div>

          {/* Title zone — asymmetric split */}
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <p
                className="mb-3 text-[11px] uppercase tracking-[0.3em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
              >
                Bildirim Merkezi
              </p>
              <h1
                className="font-bold leading-[0.95] tracking-[-0.02em]"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
                  color: INK,
                  fontWeight: 800,
                }}
              >
                Bildirimler<span style={{ color: GOLD }}>.</span>
              </h1>
              <p
                className="mt-3 max-w-lg text-[14px] leading-relaxed"
                style={{ color: INK_SOFT }}
              >
                Eğitim atamaları, sınav hatırlatmaları ve resmi duyurular — tek bir akışta, tarih sırasına göre.
              </p>
            </div>

            {/* Unread counter — editorial stat */}
            <div className="flex items-end gap-6 md:flex-col md:items-end md:gap-1">
              <StatBlock value={unreadCount} label="OKUNMAMIŞ" accent={unreadCount > 0} />
            </div>
          </div>

          {/* Thick rule */}
          <div className="mt-10 h-[3px]" style={{ backgroundColor: INK }} />
        </header>

        {/* ═══════════════ CONTROL STRIP ═══════════════ */}
        <div
          className="sticky top-0 z-20 -mx-6 mt-0 border-b bg-[var(--stripe-bg)] px-6 py-3 backdrop-blur sm:-mx-10 sm:px-10 lg:-mx-16 lg:px-16"
          style={{
            ['--stripe-bg' as string]: 'rgba(250,247,242,0.92)',
            borderColor: RULE,
          }}
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            {/* Search */}
            <div className="relative flex min-w-[240px] flex-1 items-center">
              <Search className="pointer-events-none absolute left-0 h-3.5 w-3.5" style={{ color: INK_SOFT }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Bildirim ara…"
                className="w-full bg-transparent py-1.5 pl-6 pr-7 text-[13px] outline-none"
                style={{
                  color: INK,
                  borderBottom: `1px solid ${search ? INK : RULE}`,
                  fontFamily: 'var(--font-body)',
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  aria-label="Aramayı temizle"
                  className="absolute right-0 p-1"
                  style={{ color: INK_SOFT }}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Segmented view filter — typographic, no buttons */}
            <nav
              aria-label="Görünüm filtresi"
              className="flex items-center gap-3 text-[11px] tracking-[0.14em]"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {(['all', 'unread', 'today', 'week'] as ViewFilter[]).map((v, i) => (
                <span key={v} className="inline-flex items-center gap-3">
                  {i > 0 && <span style={{ color: RULE }}>·</span>}
                  <button
                    type="button"
                    onClick={() => setViewFilter(v)}
                    aria-pressed={viewFilter === v}
                    className="uppercase transition-colors duration-150"
                    style={{
                      color: viewFilter === v ? INK : INK_SOFT,
                      borderBottom: viewFilter === v ? `2px solid ${GOLD}` : '2px solid transparent',
                      paddingBottom: '2px',
                      fontWeight: viewFilter === v ? 700 : 500,
                    }}
                  >
                    {v === 'all' ? 'Tümü' : v === 'unread' ? 'Okunmamış' : v === 'today' ? 'Bugün' : 'Hafta'}
                  </button>
                </span>
              ))}
            </nav>

            {/* Type menu trigger */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setTypeMenuOpen(o => !o)}
                className="inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-150"
                style={{
                  borderColor: activeTypes.size > 0 ? INK : RULE,
                  color: INK,
                  backgroundColor: activeTypes.size > 0 ? CREAM : 'transparent',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                }}
                aria-expanded={typeMenuOpen}
              >
                <Filter className="h-3 w-3" />
                Tip
                {activeTypes.size > 0 && (
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ backgroundColor: INK, color: CREAM }}
                  >
                    {activeTypes.size}
                  </span>
                )}
              </button>

              {typeMenuOpen && (
                <div
                  className="absolute right-0 top-full z-30 mt-2 w-64 border bg-white shadow-lg"
                  style={{ borderColor: INK, boxShadow: '8px 8px 0 rgba(10,22,40,0.08)' }}
                >
                  <div
                    className="border-b px-4 py-2 text-[10px] tracking-[0.2em]"
                    style={{ borderColor: RULE, color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                  >
                    TİPE GÖRE FİLTRELE
                  </div>
                  <ul className="max-h-72 overflow-auto py-1">
                    {FILTER_TYPES.map(t => {
                      const m = getTypeMeta(t);
                      const c = typeCounts[t] ?? 0;
                      const active = activeTypes.has(t);
                      return (
                        <li key={t}>
                          <button
                            onClick={() => toggleType(t)}
                            disabled={c === 0}
                            className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-[12px] transition-colors duration-100 hover:bg-[var(--hover-bg)] disabled:opacity-40"
                            style={{
                              ['--hover-bg' as string]: CREAM,
                              color: INK,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <span
                                className="inline-block h-2 w-2"
                                style={{ backgroundColor: m.ink }}
                              />
                              <span className="tracking-[0.08em]">{m.label}</span>
                              {active && <Check className="h-3 w-3" style={{ color: GOLD }} />}
                            </span>
                            <span
                              className="text-[10px] tabular-nums"
                              style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                            >
                              {c}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Mark all */}
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 disabled:opacity-30"
              style={{
                backgroundColor: unreadCount > 0 ? INK : 'transparent',
                color: unreadCount > 0 ? CREAM : INK_SOFT,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                border: unreadCount > 0 ? 'none' : `1px solid ${RULE}`,
              }}
            >
              <CheckCheck className="h-3 w-3" />
              {markingAll ? 'İşleniyor…' : 'Tümünü Okundu'}
            </button>
          </div>

          {/* Active filter summary */}
          {hasAnyFilter && (
            <div
              className="mt-2 flex items-center gap-3 text-[10px] tracking-[0.18em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
            >
              <span>{totalAfterFilter} / {allNotifications.length} GÖSTERİLİYOR</span>
              <button
                onClick={clearAllFilters}
                className="underline decoration-dotted underline-offset-4 hover:text-[var(--ink)]"
                style={{ ['--ink' as string]: INK }}
              >
                FİLTRELERİ TEMİZLE
              </button>
            </div>
          )}
        </div>

        {/* ═══════════════ SELECTION STRIP ═══════════════ */}
        {visibleIds.length > 0 && (
          <div className="mt-6 flex items-center justify-between border-b pb-3" style={{ borderColor: RULE }}>
            <label className="inline-flex cursor-pointer items-center gap-3">
              <Checkbox checked={allVisibleSelected} onCheckedChange={selectAllVisible} />
              <span
                className="text-[10px] tracking-[0.2em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
              >
                {selected.size > 0 ? `${selected.size} SEÇİLDİ` : 'TÜMÜNÜ SEÇ'}
              </span>
            </label>
            <span
              className="text-[10px] tabular-nums tracking-[0.14em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
            >
              TOPLAM {allNotifications.length.toString().padStart(3, '0')}
            </span>
          </div>
        )}

        {/* ═══════════════ TIMELINE FEED ═══════════════ */}
        {totalAfterFilter === 0 ? (
          <EditorialEmptyState hasFilters={hasAnyFilter} onClearFilters={clearAllFilters} />
        ) : (
          <div className="relative mt-10 pb-8">
            {/* Vertical spine — fixed at 14px across breakpoints for clean alignment */}
            <div
              aria-hidden="true"
              className="absolute bottom-0 left-[14px] top-0 w-[2px]"
              style={{ backgroundColor: INK }}
            />

            {(['today', 'yesterday', 'thisWeek', 'older'] as Bucket[]).map(bucket => {
              const items = grouped[bucket];
              if (items.length === 0) return null;
              return (
                <section key={bucket} className="relative mb-10 last:mb-0">
                  {/* Day row — explicit grid (Tailwind 4 arbitrary cols can be flaky, use inline) */}
                  <header
                    className="grid items-center gap-3 md:gap-4"
                    style={{ gridTemplateColumns: '30px max-content 1fr max-content' }}
                  >
                    <div className="relative flex h-4 items-center justify-center">
                      <span
                        aria-hidden="true"
                        className="absolute h-4 w-4 rounded-full"
                        style={{ backgroundColor: CREAM }}
                      />
                      <span
                        aria-hidden="true"
                        className="relative h-2.5 w-2.5 rotate-45"
                        style={{ backgroundColor: GOLD }}
                      />
                    </div>
                    <h2
                      className="text-[11px] tracking-[0.3em] whitespace-nowrap"
                      style={{ color: INK, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    >
                      {BUCKET_LABEL[bucket]}
                    </h2>
                    <span className="block h-px w-full" style={{ backgroundColor: RULE }} />
                    <span
                      className="text-[10px] tabular-nums tracking-[0.14em] whitespace-nowrap"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                    >
                      {items.length.toString().padStart(2, '0')}
                    </span>
                  </header>

                  <ul className="mt-8 list-none space-y-4 p-0">
                    {items.map((n, idx) => (
                      <NotificationEntry
                        key={n.id}
                        notification={n}
                        index={idx + 1}
                        selected={selected.has(n.id)}
                        onToggleSelect={() => toggleSelect(n.id)}
                        onMarkRead={() => handleMarkRead(n.id)}
                        isMarking={markingId === n.id}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {/* ═══════════════ BULK ACTION BAR ═══════════════ */}
        {selected.size > 0 && (
          <div
            className="fixed inset-x-0 bottom-0 z-40 px-6 pb-6 pt-3"
            style={{
              background: `linear-gradient(to top, ${CREAM} 60%, transparent)`,
            }}
          >
            <div
              className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-3"
              style={{
                backgroundColor: INK,
                color: CREAM,
                boxShadow: `8px 8px 0 ${GOLD}`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="px-2 py-0.5 text-[11px] font-bold tracking-[0.14em]"
                  style={{ backgroundColor: GOLD, color: INK, fontFamily: 'var(--font-mono)' }}
                >
                  {selected.size}
                </span>
                <span className="text-[12px] tracking-[0.14em]" style={{ fontFamily: 'var(--font-mono)' }}>
                  BİLDİRİM SEÇİLDİ
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkSelectedRead}
                  className="inline-flex items-center gap-1.5 border px-3 py-1.5 text-[11px] uppercase tracking-[0.14em] transition-colors duration-150 hover:bg-white/10"
                  style={{ borderColor: CREAM, color: CREAM, fontFamily: 'var(--font-mono)' }}
                >
                  <Check className="h-3 w-3" />
                  Okundu
                </button>
                <button
                  onClick={clearSelection}
                  aria-label="Seçimi temizle"
                  className="p-1.5 transition-colors duration-150 hover:bg-white/10"
                  style={{ color: CREAM }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Sub-components
   ───────────────────────────────────────────────────── */

function StatBlock({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="text-right">
      <div
        className="leading-none tabular-nums"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(3rem, 6vw, 4.5rem)',
          fontWeight: 800,
          color: accent ? INK : INK_SOFT,
          letterSpacing: '-0.04em',
        }}
      >
        {value.toString().padStart(2, '0')}
      </div>
      <div
        className="mt-1 text-[10px] tracking-[0.3em]"
        style={{
          color: accent ? GOLD : INK_SOFT,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function NotificationEntry({
  notification: n, index, selected, onToggleSelect, onMarkRead, isMarking,
}: {
  notification: Notification;
  index: number;
  selected: boolean;
  onToggleSelect: () => void;
  onMarkRead: () => void;
  isMarking: boolean;
}) {
  const m = getTypeMeta(n.type);
  const Icon = m.icon;
  const unread = !n.isRead;

  return (
    <li
      className="grid items-start gap-3 md:gap-4"
      style={{ gridTemplateColumns: '30px 1fr' }}
    >
      {/* Spine column — cream mask covers spine, connector dot on top */}
      <div className="relative flex justify-center pt-5">
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-[18px] h-3.5 w-3.5 -translate-x-1/2 rounded-full"
          style={{ backgroundColor: CREAM }}
        />
        <span
          aria-hidden="true"
          className="relative h-2 w-2 rounded-full"
          style={{
            backgroundColor: unread ? INK : CREAM,
            border: `1.5px solid ${INK}`,
          }}
        />
      </div>

      <article
        className="group relative border bg-white transition-[border-color] duration-200"
        style={{
          borderTopColor: selected ? INK : RULE,
          borderRightColor: selected ? INK : RULE,
          borderBottomColor: selected ? INK : RULE,
          borderLeftWidth: unread ? '3px' : '1px',
          borderLeftColor: unread ? m.ink : (selected ? INK : RULE),
        }}
      >
        <div className="flex gap-4 p-4 sm:p-5">
          {/* Checkbox */}
          <div className="pt-0.5">
            <Checkbox
              checked={selected}
              onCheckedChange={onToggleSelect}
              aria-label="Seç"
            />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* Top meta row — magazine section label style */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2">
                <Icon className="h-3 w-3" style={{ color: m.ink }} strokeWidth={2.5} />
                <span
                  className="text-[10px] tracking-[0.22em]"
                  style={{ color: m.ink, fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                >
                  {m.label}
                </span>
                <span className="text-[10px]" style={{ color: RULE }}>|</span>
                <span
                  className="text-[10px] tracking-[0.14em] tabular-nums"
                  style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
                >
                  {index.toString().padStart(2, '0')}
                </span>
              </div>

              <time
                className="text-[10px] tabular-nums"
                dateTime={n.createdAt}
                title={`${formatLongDate(n.createdAt)} · ${formatExactTime(n.createdAt)}`}
                style={{ color: INK_SOFT, fontFamily: 'var(--font-mono)' }}
              >
                {formatRelativeTime(n.createdAt)}
                <span className="opacity-60"> · {formatExactTime(n.createdAt)}</span>
              </time>
            </div>

            {/* Title */}
            <h3
              className="mt-2 leading-snug tracking-tight"
              style={{
                fontFamily: 'var(--font-display)',
                color: INK,
                fontWeight: 700,
                fontSize: '1.0625rem',
              }}
            >
              {n.title}
              {unread && (
                <span
                  aria-label="Okunmamış"
                  className="ml-2 inline-block h-1.5 w-1.5 rounded-full align-middle"
                  style={{ backgroundColor: GOLD }}
                />
              )}
            </h3>

            {/* Message */}
            <p
              className="mt-1.5 text-[13.5px] leading-relaxed"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-body)' }}
            >
              {n.message}
            </p>

            {/* Related training link */}
            {n.relatedTrainingId && (
              <div className="mt-3">
                <Link
                  href={`/staff/my-trainings`}
                  className="group/link inline-flex items-center gap-1.5 text-[11px] tracking-[0.12em] uppercase transition-colors duration-150"
                  style={{
                    color: OLIVE,
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    borderBottom: `1px solid ${OLIVE}`,
                    paddingBottom: '2px',
                  }}
                >
                  <Award className="h-3 w-3" />
                  <span className="max-w-[240px] truncate">
                    {n.relatedTraining?.title ?? 'Eğitime Git'}
                  </span>
                  <ChevronRight className="h-3 w-3 transition-transform duration-150 group-hover/link:translate-x-0.5" />
                </Link>
              </div>
            )}
          </div>

          {/* Action */}
          {unread && (
            <div className="flex shrink-0 items-start">
              <button
                onClick={onMarkRead}
                disabled={isMarking}
                aria-label="Okundu işaretle"
                title="Okundu işaretle"
                className="inline-flex h-8 w-8 items-center justify-center transition-colors duration-150 disabled:opacity-50"
                style={{
                  border: `1px solid ${RULE}`,
                  color: INK_SOFT,
                  backgroundColor: 'transparent',
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </article>
    </li>
  );
}

function EditorialEmptyState({
  hasFilters, onClearFilters,
}: {
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  return (
    <div className="mt-20 flex flex-col items-center py-16 text-center">
      {/* Dashed plate */}
      <div
        className="relative mb-8 flex h-20 w-20 items-center justify-center"
        style={{
          border: `1.5px dashed ${INK}`,
          backgroundColor: CREAM,
        }}
      >
        {hasFilters ? (
          <Inbox className="h-8 w-8" style={{ color: INK }} strokeWidth={1.5} />
        ) : (
          <BellOff className="h-8 w-8" style={{ color: INK }} strokeWidth={1.5} />
        )}
      </div>

      {/* "— KAYIT YOK —" style typographic mark */}
      <div
        className="mb-6 flex items-center gap-4"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        <span style={{ color: INK_SOFT }}>—</span>
        <span
          className="text-[11px] tracking-[0.32em]"
          style={{ color: INK, fontWeight: 700 }}
        >
          {hasFilters ? 'EŞLEŞME YOK' : 'KAYIT YOK'}
        </span>
        <span style={{ color: INK_SOFT }}>—</span>
      </div>

      <h3
        className="max-w-md leading-tight tracking-tight"
        style={{
          fontFamily: 'var(--font-display)',
          color: INK,
          fontSize: '1.5rem',
          fontWeight: 700,
        }}
      >
        {hasFilters ? 'Aramanıza uygun bildirim bulunamadı' : 'Şu an hiç bildiriminiz yok'}
      </h3>

      <p
        className="mt-3 max-w-md text-[14px] leading-relaxed"
        style={{ color: INK_SOFT }}
      >
        {hasFilters
          ? 'Filtreleri temizleyip tekrar deneyin veya arama terimini değiştirin.'
          : 'Yeni bir eğitim atandığında, sınav hatırlatması yapıldığında veya hastane duyurusu yayımlandığında burada görünecek.'}
      </p>

      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="mt-8 inline-flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.18em] transition-colors duration-150"
          style={{
            backgroundColor: INK,
            color: CREAM,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          <X className="h-3 w-3" />
          Filtreleri Temizle
        </button>
      )}
    </div>
  );
}

function EditorialError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      className="-mx-4 -my-4 md:-mx-8 md:-my-8"
      style={{ backgroundColor: CREAM, minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="px-6 pt-10 pb-24 sm:px-10 lg:px-16">
        <div
          className="flex items-center gap-4 text-[10px] tracking-[0.22em]"
          style={{ color: '#b3261e', fontFamily: 'var(--font-mono)' }}
        >
          <span>—</span>
          <span style={{ fontWeight: 700 }}>HATA</span>
          <span className="h-px flex-1" style={{ backgroundColor: '#b3261e' }} />
        </div>
        <h1
          className="mt-6 leading-tight tracking-tight"
          style={{
            fontFamily: 'var(--font-display)',
            color: INK,
            fontSize: 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: 800,
          }}
        >
          Bildirimler yüklenemedi<span style={{ color: '#b3261e' }}>.</span>
        </h1>
        <p className="mt-4 max-w-lg text-[14px] leading-relaxed" style={{ color: INK_SOFT }}>
          {message || 'Sunucuya bağlanırken bir sorun oluştu. İnternet bağlantınızı kontrol edin ve tekrar deneyin.'}
        </p>
        <button
          onClick={onRetry}
          className="mt-8 inline-flex items-center gap-2 px-4 py-2 text-[11px] uppercase tracking-[0.18em] transition-colors duration-150"
          style={{
            backgroundColor: INK,
            color: CREAM,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
          }}
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}

function EditorialSkeleton() {
  return (
    <div
      className="-mx-4 -my-4 md:-mx-8 md:-my-8"
      style={{ backgroundColor: CREAM, minHeight: 'calc(100vh - 64px)' }}
    >
      <div className="animate-pulse px-6 pt-6 sm:px-10 lg:px-16">
        <div className="h-4 border-y py-2" style={{ borderColor: INK }} />
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_auto]">
          <div>
            <div className="mb-3 h-3 w-40 rounded" style={{ backgroundColor: RULE }} />
            <div className="h-12 w-80 rounded" style={{ backgroundColor: RULE }} />
            <div className="mt-4 h-4 w-96 rounded" style={{ backgroundColor: RULE }} />
          </div>
          <div className="h-20 w-32" style={{ backgroundColor: RULE }} />
        </div>
        <div className="mt-10 h-[3px]" style={{ backgroundColor: INK }} />
        <div className="mt-10 space-y-3 pl-14">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-24 border" style={{ borderColor: RULE, backgroundColor: 'white' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
