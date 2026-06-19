'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Bell, BellOff, Send, Check, CheckCircle, CheckCircle2,
  Filter, Clock, Inbox, Trash2, X, Users, UserMinus, Building2, Loader2, ChevronRight,
  BookOpen, Eye, AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { getNotificationTypeMeta } from '@/lib/notification-types';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';
import { RecipientsModal } from './_components/recipients-modal';

/** Admin "Gönderdiklerim" listesinde bir gönderim = bir batch.
 * Backend N alıcı satırını batchId üzerinden tek karta indirger. Legacy
 * (eski) satırlarda batchId NULL olduğunda backend `id`'yi fallback olarak
 * batchId yerine koyar ve `isLegacy: true` döner — DELETE rotası buna göre seçilir. */
interface NotificationBatch {
  batchId: string;
  isLegacy: boolean;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  recipientCount: number;
  readCount: number;
  relatedTrainingId: string | null;
}

interface AdminNotificationsResponse {
  notifications: NotificationBatch[];
  total: number;
  page: number;
  limit: number;
}

interface StaffMember { id: string; firstName: string; lastName: string; title: string | null }
interface Department {
  id: string;
  name: string;
  parentId: string | null;
  users: StaffMember[];
  _count: { users: number };
}

/** Filter sidebar'da gözüken tipler. Tüm tipler değil; admin'in
 * en sık kullandığı manuel gönderim tiplerine ek olarak sistem tetikli
 * `training_assigned` + `exam_passed` görünür. */
const ADMIN_FILTER_TYPES = ['info', 'warning', 'error', 'success', 'training_assigned', 'exam_passed'] as const;

type FilterType = 'all' | 'unread' | (typeof ADMIN_FILTER_TYPES)[number];

function timeAgo(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Az önce';
    if (mins < 60) return `${mins} dk önce`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} saat önce`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} gün önce`;
    return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  } catch {
    return dateStr;
  }
}

export default function NotificationsPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<AdminNotificationsResponse>('/api/admin/notifications');
  const [filter, setFilter] = useState<FilterType>('all');
  const [dismissing, setDismissing] = useState<string | null>(null);
  // "Alıcıları gör" modali — açık batch'in kimliği + başlık/tip (modal başlığı için).
  const [recipientsModal, setRecipientsModal] = useState<
    { batchId: string; title: string; type: string } | null
  >(null);
  // Silme onay modali — batch silme N kişiyi etkilediği için onay zorunlu.
  const [deleteTarget, setDeleteTarget] = useState<
    { batchId: string; title: string; recipientCount: number } | null
  >(null);

  // Yeni bildirim geldiğinde liste tazelensin — bell zaten store'a ekliyor,
  // ama bu sayfanın kendi listesi useFetch'in cache'inden geliyor; refetch ile senkronize tut.
  useRealtimeNotifications();

  // Bir gönderimin (batch) tüm alıcı satırlarını siler. Batch endpoint'i hem
  // gerçek batchId hem legacy `id` fallback'ini çözer — tek rota yeterli.
  const handleDelete = async (batchId: string) => {
    setDismissing(batchId);
    try {
      const res = await fetch(`/api/admin/notifications/batch/${batchId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast('Bildirim silindi', 'success');
      setDeleteTarget(null);
      refetch();
    } catch {
      toast('Bildirim silinemedi', 'error');
    } finally {
      setDismissing(null);
    }
  };

  // ── Send Modal State ──
  const [showSendModal, setShowSendModal] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  // Çoklu departman seçimi — admin birden fazla parent dept'i toplu seçebilir.
  // "Tüm personele gönder" convenience butonu tüm parent dept'leri set'e ekler.
  const [selectedDeptIds, setSelectedDeptIds] = useState<Set<string>>(new Set());
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [excludedStaffIds, setExcludedStaffIds] = useState<Set<string>>(new Set());
  const [sendMode, setSendMode] = useState<'individual' | 'department'>('department');
  const [sendTitle, setSendTitle] = useState('');
  const [sendMessage, setSendMessage] = useState('');
  const [sendType, setSendType] = useState('info');
  const [sending, setSending] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [debouncedStaffSearch, setDebouncedStaffSearch] = useState('');
  const [alsoSendEmail, setAlsoSendEmail] = useState(false);
  const searchTimerRef = useRef<NodeJS.Timeout>(undefined);

  const handleStaffSearch = useCallback((value: string) => {
    setStaffSearch(value);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedStaffSearch(value);
    }, 300);
  }, []);

  // Departmanları yükle
  useEffect(() => {
    if (showSendModal && departments.length === 0) {
      fetch('/api/admin/departments')
        .then(r => {
          if (!r.ok) throw new Error('departments-fetch-failed');
          return r.json();
        })
        .then(d => {
          const depts = Array.isArray(d) ? d : d.departments ?? d.data ?? [];
          // API "staff" döndürebilir, frontend "users" bekliyor — normalize et
          const normalized = depts.map((dept: Record<string, unknown>) => ({
            ...dept,
            parentId: (dept.parentId ?? null) as string | null,
            users: (dept.users ?? dept.staff ?? []) as StaffMember[],
            _count: (dept._count ?? { users: (dept.count as number) ?? 0 }) as { users: number },
          }));
          setDepartments(normalized as Department[]);
        })
        .catch(() => {
          // Sessiz yutma yerine kullanıcıya bildir (boş departman listesi = bozuk modal)
          toast('Departmanlar yüklenemedi. Lütfen tekrar deneyin.', 'error');
        });
    }
  }, [showSendModal, departments.length, toast]);

  // Seçili departmanların TÜM personelleri (parent + alt birim üyeleri, deduped).
  // Multi-select: birden fazla parent dept seçilebilir, hepsinin altındaki üyeler birleştirilir.
  const deptStaff = (() => {
    if (selectedDeptIds.size === 0) return [];
    const seen = new Set<string>();
    const result: StaffMember[] = [];
    for (const deptId of selectedDeptIds) {
      const parent = departments.find(d => d.id === deptId);
      if (!parent) continue;
      const childDepts = departments.filter(d => d.parentId === parent.id);
      for (const d of [parent, ...childDepts]) {
        for (const u of d.users ?? []) {
          if (!seen.has(u.id)) {
            seen.add(u.id);
            result.push(u);
          }
        }
      }
    }
    return result;
  })();

  // Bireysel modu için tüm çalışanlar (deduped)
  const allStaff = (() => {
    const seen = new Set<string>();
    return departments.flatMap(d => d.users ?? []).filter(u => (seen.has(u.id) ? false : (seen.add(u.id), true)));
  })();

  // Departman seçim listesi: SADECE ana (kök) departmanlar.
  // Alt birim göndermek isteyenler "Kişi Bazlı" moda geçer — bu sayede liste sade kalır
  // ve admin sub-dept seçip yanlışlıkla parent'a tek başına bildirim atmaz.
  // Ana dept "kişi sayısı" = kendisi + alt dept kullanıcıları (deduped).
  const departmentOptions = (() => {
    const parents = departments.filter(d => d.parentId === null);
    type Opt = { id: string; label: string; count: number; hasSubs: boolean };
    return parents.map<Opt>(parent => {
      const subs = departments.filter(d => d.parentId === parent.id);
      const aggregatedSeen = new Set<string>();
      const aggregated = [parent, ...subs].flatMap(d => d.users ?? []).filter(u => (aggregatedSeen.has(u.id) ? false : (aggregatedSeen.add(u.id), true)));
      return { id: parent.id, label: parent.name, count: aggregated.length, hasSubs: subs.length > 0 };
    });
  })();

  // Bireysel modda filtrelenen personeller
  const filteredStaff = allStaff.filter(s => {
    if (!debouncedStaffSearch) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(debouncedStaffSearch.toLowerCase());
  });

  // Gönderilecek kişi sayısı
  const getRecipientCount = () => {
    if (sendMode === 'individual') return selectedStaffIds.size;
    if (selectedDeptIds.size === 0) return 0;
    // excludedStaffIds eski dept seçimlerinden artık olabilir — sadece mevcut deptStaff içindekileri say
    const deptStaffIds = new Set(deptStaff.map(s => s.id));
    const effectiveExcluded = Array.from(excludedStaffIds).filter(id => deptStaffIds.has(id)).length;
    return deptStaff.length - effectiveExcluded;
  };

  const getRecipientIds = (): string[] => {
    if (sendMode === 'individual') return Array.from(selectedStaffIds);
    return deptStaff.filter(s => !excludedStaffIds.has(s.id)).map(s => s.id);
  };

  const toggleDept = (id: string) => {
    setSelectedDeptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Dept değiştiğinde exclude listesi temizlenir — kullanıcı kafası karışmasın
    setExcludedStaffIds(new Set());
  };

  const selectAllDepts = () => {
    const allParentIds = departments.filter(d => d.parentId === null).map(d => d.id);
    setSelectedDeptIds(new Set(allParentIds));
    setExcludedStaffIds(new Set());
  };

  const clearAllDepts = () => {
    setSelectedDeptIds(new Set());
    setExcludedStaffIds(new Set());
  };

  const allParents = departments.filter(d => d.parentId === null);
  const allDeptsSelected = allParents.length > 0 && allParents.every(d => selectedDeptIds.has(d.id));

  const handleSend = async () => {
    const recipientIds = getRecipientIds();
    if (!sendTitle.trim() || !sendMessage.trim() || recipientIds.length === 0) {
      toast('Başlık, mesaj ve en az bir alıcı gerekli', 'error');
      return;
    }
    setSending(true);
    try {
      // Tek request ile toplu bildirim + opsiyonel e-posta gönder
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: sendTitle,
          message: sendMessage,
          type: sendType,
          recipientIds,
          sendEmail: alsoSendEmail,
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        toast(result.error || 'Bildirim gönderilemedi', 'error');
        return;
      }

      const parts: string[] = [`${result.notificationsCreated} kişiye bildirim gönderildi`];
      if (alsoSendEmail && result.emailsSent > 0) {
        parts.push(`${result.emailsSent} e-posta gönderildi`);
      }
      if (result.emailsFailed > 0) {
        parts.push(`${result.emailsFailed} e-posta gönderilemedi`);
      }
      toast(parts.join('. '), result.emailsFailed > 0 ? 'warning' : 'success');

      setShowSendModal(false);
      setSendTitle('');
      setSendMessage('');
      setSendType('info');
      setAlsoSendEmail(false);
      setSelectedStaffIds(new Set());
      setExcludedStaffIds(new Set());
      setSelectedDeptIds(new Set());
      refetch();
    } catch {
      toast('Bildirim gönderilemedi', 'error');
    } finally {
      setSending(false);
    }
  };

  const toggleStaff = (id: string) => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExclude = (id: string) => {
    setExcludedStaffIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--k-error)' }}>{error}</div>
      </div>
    );
  }

  const notifications: NotificationBatch[] = data?.notifications ?? [];

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    // "Okunmamış" = bu gönderimi henüz okumayan en az bir alıcı var.
    if (filter === 'unread') return n.readCount < n.recipientCount;
    return n.type === filter;
  });

  const filters: { id: FilterType; label: string; icon: typeof Bell; count?: number }[] = [
    { id: 'all', label: 'Tümü', icon: Inbox, count: notifications.length },
    ...ADMIN_FILTER_TYPES.map((t) => {
      const meta = getNotificationTypeMeta(t);
      // Etiket: kicker uppercase yerine sentence-case göster (UI sözlüğüne uydur)
      const sentenceLabel = meta.label.charAt(0) + meta.label.slice(1).toLocaleLowerCase('tr-TR');
      return { id: t as FilterType, label: sentenceLabel, icon: meta.icon };
    }),
  ];

  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span data-current="true">Bildirimler</span>
            </div>
            <h1 className="k-page-title">Bildirim Yönetimi</h1>
            <p className="k-page-subtitle">Personele bildirim gönderin ve takip edin.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSendModal(true)} className="k-btn k-btn-primary">
              <Send size={15} /> Bildirim Gönder
            </button>
          </div>
        </header>
      </BlurFade>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <BlurFade delay={0.05}>
          <div
            className="w-52 shrink-0 p-2 rounded-xl border"
            style={{
              background: 'var(--k-surface)',
              borderColor: 'var(--k-border)',
            }}
          >
            <div className="flex items-center gap-2 px-3 py-2 mb-1">
              <Filter className="h-3.5 w-3.5" style={{ color: 'var(--k-text-muted)' }} />
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--k-text-muted)' }}
              >
                Filtrele
              </span>
            </div>
            <div className="space-y-0.5">
              {filters.map((f) => {
                const isActive = filter === f.id;
                const iconColor = f.id === 'all' || f.id === 'unread'
                  ? 'var(--k-text-muted)'
                  : getNotificationTypeMeta(f.id).ink;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    aria-label={`Filtrele: ${f.label}`}
                    aria-pressed={isActive}
                    className="group/filter relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] cursor-pointer transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--k-primary)_6%,transparent)]"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--k-primary) 12%, transparent)'
                        : 'transparent',
                      color: isActive ? 'var(--k-primary)' : 'var(--k-text-secondary)',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full"
                        style={{ background: 'var(--k-primary)' }}
                      />
                    )}
                    <f.icon
                      className="h-4 w-4"
                      style={{
                        color: isActive ? 'var(--k-primary)' : iconColor,
                        opacity: isActive ? 1 : 0.85,
                      }}
                    />
                    <span className="flex-1 text-left">{f.label}</span>
                    {f.count !== undefined && f.count > 0 && (
                      <span
                        className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                        style={{
                          background: isActive
                            ? 'color-mix(in srgb, var(--k-primary) 18%, transparent)'
                            : 'var(--k-bg)',
                          color: isActive ? 'var(--k-primary)' : 'var(--k-text-muted)',
                        }}
                      >
                        {f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </BlurFade>

        {/* Notification list */}
        <div className="flex-1 min-w-0">
          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((n, i) => {
                const meta = getNotificationTypeMeta(n.type);
                const Icon = meta.icon;
                const isDismissing = dismissing === n.batchId;
                const readPct = n.recipientCount > 0
                  ? Math.round((n.readCount / n.recipientCount) * 100)
                  : 0;
                const allRead = n.recipientCount > 0 && n.readCount === n.recipientCount;
                const fullDate = (() => {
                  try {
                    return new Date(n.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    });
                  } catch {
                    return n.createdAt;
                  }
                })();
                return (
                  <BlurFade key={n.batchId} delay={0.08 + i * 0.03}>
                    <div
                      className="group relative flex items-start gap-4 rounded-xl border p-5 transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--k-bg)_50%,var(--k-surface))]"
                      style={{
                        background: 'var(--k-surface)',
                        borderColor: 'var(--k-border)',
                        borderLeftWidth: '3px',
                        borderLeftColor: meta.ink,
                        opacity: isDismissing ? 0 : 1,
                        transform: isDismissing ? 'translateX(20px)' : 'translateX(0)',
                        transitionProperty: 'background-color, border-color, opacity, transform',
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: `color-mix(in srgb, ${meta.ink} 14%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${meta.ink} 22%, transparent)`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: meta.ink }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                          <p className="text-[13px] font-semibold" style={{ color: 'var(--k-text-primary)' }}>
                            {n.title}
                          </p>
                          <span
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{
                              background: `color-mix(in srgb, ${meta.ink} 14%, transparent)`,
                              color: meta.ink,
                            }}
                          >
                            {meta.label}
                          </span>
                          {n.readCount === 0 && (
                            <span
                              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                background: 'color-mix(in srgb, var(--k-primary) 12%, transparent)',
                                color: 'var(--k-primary)',
                              }}
                            >
                              Yeni
                            </span>
                          )}
                        </div>
                        <p
                          className="text-[13px] leading-relaxed line-clamp-2"
                          style={{ color: 'var(--k-text-secondary)' }}
                        >
                          {n.message}
                        </p>

                        {/* Meta — alıcı sayısı · okunma · zaman damgası */}
                        <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                          {/* Alıcı sayısı */}
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              background: 'color-mix(in srgb, var(--k-primary) 9%, transparent)',
                              color: 'var(--k-primary)',
                            }}
                          >
                            <Users className="h-3 w-3" />
                            {n.recipientCount} kişi
                          </span>

                          {/* Okunma ilerlemesi */}
                          <span
                            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                            style={{
                              background: allRead
                                ? 'color-mix(in srgb, #059669 13%, transparent)'
                                : 'color-mix(in srgb, var(--k-text-muted) 13%, transparent)',
                              color: allRead ? '#047857' : 'var(--k-text-muted)',
                            }}
                            title={`%${readPct} okudu`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {n.readCount} / {n.recipientCount} okudu
                          </span>

                          {/* Mini progress bar */}
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-16 overflow-hidden rounded-full"
                            style={{ background: 'color-mix(in srgb, var(--k-border) 70%, transparent)' }}
                          >
                            <span
                              className="block h-full rounded-full transition-[width] duration-300"
                              style={{
                                width: `${readPct}%`,
                                background: allRead ? '#10b981' : meta.ink,
                              }}
                            />
                          </span>

                          {/* Zaman damgası — relative görünür, tam tarih tooltip'te */}
                          <span
                            className="inline-flex items-center gap-1.5"
                            title={fullDate}
                          >
                            <Clock className="h-3 w-3" style={{ color: 'var(--k-text-muted)' }} />
                            <span className="text-[11px] font-mono" style={{ color: 'var(--k-text-muted)' }}>
                              {timeAgo(n.createdAt)}
                            </span>
                          </span>

                          {n.relatedTrainingId && (
                            <Link
                              href={`/admin/trainings/${n.relatedTrainingId}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold transition-colors duration-150"
                              style={{ color: 'var(--k-primary)' }}
                            >
                              <BookOpen className="h-3 w-3" />
                              Eğitime git
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          )}
                        </div>
                      </div>

                      {/* Actions — always visible on touch, faded on desktop until hover */}
                      <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                        <button
                          className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold cursor-pointer transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--k-primary)_10%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                          style={{
                            color: 'var(--k-primary)',
                            // @ts-expect-error — focus ring uses theme token
                            '--tw-ring-color': 'var(--k-primary)',
                          }}
                          title="Alıcıları gör"
                          aria-label="Alıcıları gör"
                          onClick={() => setRecipientsModal({ batchId: n.batchId, title: n.title, type: n.type })}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">Alıcılar</span>
                        </button>
                        <button
                          className="flex h-11 w-11 items-center justify-center rounded-lg cursor-pointer transition-colors duration-200 hover:bg-[color-mix(in_srgb,var(--k-error)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            color: 'var(--k-error)',
                            // @ts-expect-error — focus ring uses theme token
                            '--tw-ring-color': 'var(--k-error)',
                          }}
                          title="Bildirimi sil"
                          aria-label="Bildirimi sil"
                          disabled={dismissing === n.batchId}
                          onClick={() => setDeleteTarget({
                            batchId: n.batchId,
                            title: n.title,
                            recipientCount: n.recipientCount,
                          })}
                        >
                          {dismissing === n.batchId
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </BlurFade>
                );
              })}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-xl border py-20"
              style={{ background: 'var(--k-surface)', borderColor: 'var(--k-border)' }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: 'var(--k-bg)' }}
              >
                <BellOff className="h-7 w-7" style={{ color: 'var(--k-text-muted)' }} />
              </div>
              <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--k-text-primary)' }}>
                Henüz bildirim yok
              </p>
              <p className="text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
                {filter !== 'all' ? 'Bu filtreye uygun bildirim yok' : 'Henüz bildirim yok. Personele bildirim göndermek için yukarıdaki butonu kullanın.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Send Notification Modal ── */}
      {showSendModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="k-card w-full max-w-2xl max-h-[85vh] flex flex-col"
            style={{ borderColor: 'var(--k-border)' }}
          >
            {/* Modal Header */}
            <div className="k-card-head flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--k-primary) 12%, transparent)' }}
                >
                  <Send className="h-5 w-5" style={{ color: 'var(--k-primary)' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--k-text-primary)' }}>
                    Bildirim Gönder
                  </h2>
                  <p className="text-xs" style={{ color: 'var(--k-text-muted)' }}>
                    Personellere hedefli bildirim gönderin
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                aria-label="Kapat"
                className="k-btn k-btn-ghost k-btn-sm"
                style={{ padding: '0.5rem' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="k-card-body flex-1 overflow-y-auto">
              {/* Step indicator: Kime */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--k-primary)', color: '#fff' }}
                >1</span>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--k-text-secondary)' }}>
                  Kime gönderilecek?
                </span>
              </div>

              {/* Mode Toggle — segmented control */}
              <div
                role="tablist"
                aria-label="Alıcı seçim modu"
                className="grid grid-cols-2 gap-1 p-1 mb-5 rounded-xl"
                style={{ background: 'var(--k-bg)', border: '1px solid var(--k-border)' }}
              >
                <button
                  role="tab"
                  aria-selected={sendMode === 'department'}
                  onClick={() => { setSendMode('department'); setSelectedStaffIds(new Set()); }}
                  className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold cursor-pointer transition-colors duration-200"
                  style={{
                    background: sendMode === 'department' ? 'var(--k-surface)' : 'transparent',
                    color: sendMode === 'department' ? 'var(--k-primary)' : 'var(--k-text-muted)',
                    boxShadow: sendMode === 'department' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                  }}
                >
                  <Building2 className="h-4 w-4" />
                  Departman Bazlı
                </button>
                <button
                  role="tab"
                  aria-selected={sendMode === 'individual'}
                  onClick={() => { setSendMode('individual'); setSelectedDeptIds(new Set()); setExcludedStaffIds(new Set()); }}
                  className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold cursor-pointer transition-colors duration-200"
                  style={{
                    background: sendMode === 'individual' ? 'var(--k-surface)' : 'transparent',
                    color: sendMode === 'individual' ? 'var(--k-primary)' : 'var(--k-text-muted)',
                    boxShadow: sendMode === 'individual' ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                  }}
                >
                  <Users className="h-4 w-4" />
                  Kişi Bazlı
                </button>
              </div>

              {/* Recipient Selection */}
              <div className="mb-5">
                <Label
                  className="text-xs font-semibold mb-2 block"
                  style={{ color: 'var(--k-text-secondary)' }}
                >
                  {sendMode === 'department' ? 'Departman Seçin' : 'Personel Seçin'}
                </Label>

                {sendMode === 'department' ? (
                  <div className="space-y-3">
                    {/* "Tüm personele" + Temizle hızlı eylemler */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={allDeptsSelected ? clearAllDepts : selectAllDepts}
                        aria-pressed={allDeptsSelected}
                        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                        style={{
                          background: allDeptsSelected
                            ? 'var(--k-primary)'
                            : 'color-mix(in srgb, var(--k-primary) 8%, transparent)',
                          color: allDeptsSelected ? '#fff' : 'var(--k-primary)',
                          border: `1px solid ${allDeptsSelected ? 'var(--k-primary)' : 'color-mix(in srgb, var(--k-primary) 25%, transparent)'}`,
                          // @ts-expect-error focus ring uses theme token
                          '--tw-ring-color': 'var(--k-primary)',
                        }}
                      >
                        {allDeptsSelected ? <Check className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                        Tüm Personele
                      </button>
                      {selectedDeptIds.size > 0 && !allDeptsSelected && (
                        <button
                          type="button"
                          onClick={clearAllDepts}
                          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors duration-200 hover:bg-[var(--k-bg)]"
                          style={{ color: 'var(--k-text-muted)' }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Seçimi Temizle ({selectedDeptIds.size})
                        </button>
                      )}
                    </div>

                    {/* Departman seçim grid'i — multi-select chip pattern */}
                    <div
                      role="group"
                      aria-label="Departman seçimi"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {departmentOptions.length === 0 ? (
                        <div
                          className="col-span-full text-center py-4 text-sm rounded-xl border"
                          style={{ color: 'var(--k-text-muted)', borderColor: 'var(--k-border)', background: 'var(--k-bg)' }}
                        >
                          Departman bulunamadı
                        </div>
                      ) : departmentOptions.map(opt => {
                        const isSelected = selectedDeptIds.has(opt.id);
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`${opt.label}, ${opt.count} kişi`}
                            onClick={() => toggleDept(opt.id)}
                            className="group/dept flex items-center gap-3 rounded-xl px-3 py-2.5 text-left cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                            style={{
                              background: isSelected
                                ? 'color-mix(in srgb, var(--k-primary) 8%, var(--k-surface))'
                                : 'var(--k-surface)',
                              border: `1.5px solid ${isSelected ? 'var(--k-primary)' : 'var(--k-border)'}`,
                              // @ts-expect-error focus ring uses theme token
                              '--tw-ring-color': 'var(--k-primary)',
                            }}
                          >
                            {/* Checkbox visual */}
                            <span
                              aria-hidden="true"
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors duration-150"
                              style={{
                                background: isSelected ? 'var(--k-primary)' : 'var(--k-bg)',
                                border: isSelected ? 'none' : '1.5px solid var(--k-border)',
                              }}
                            >
                              {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div
                                className="text-[13px] font-semibold truncate"
                                style={{ color: isSelected ? 'var(--k-primary)' : 'var(--k-text-primary)' }}
                              >
                                {opt.label}
                              </div>
                              <div className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                                {opt.count} kişi{opt.hasSubs ? ' · tüm alt birimler' : ''}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Departman personeli — çıkarma özelliği */}
                    {selectedDeptIds.size > 0 && deptStaff.length > 0 && (
                      <div
                        className="rounded-xl border p-3"
                        style={{ borderColor: 'var(--k-border)', background: 'var(--k-bg)' }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold" style={{ color: 'var(--k-text-muted)' }}>
                            {deptStaff.length - excludedStaffIds.size} / {deptStaff.length} kişi alacak
                          </p>
                          {excludedStaffIds.size > 0 && (
                            <button
                              onClick={() => setExcludedStaffIds(new Set())}
                              className="text-[11px] font-semibold"
                              style={{ color: 'var(--k-primary)' }}
                            >
                              Tümünü Dahil Et
                            </button>
                          )}
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {deptStaff.map(s => {
                            const isExcluded = excludedStaffIds.has(s.id);
                            return (
                              <div
                                key={s.id}
                                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                                style={{
                                  opacity: isExcluded ? 0.6 : 1,
                                  background: isExcluded
                                    ? 'color-mix(in srgb, var(--k-error) 10%, transparent)'
                                    : 'var(--k-surface)',
                                  color: 'var(--k-text-primary)',
                                }}
                              >
                                <span className={isExcluded ? 'line-through' : ''}>
                                  {s.firstName} {s.lastName}
                                </span>
                                <button
                                  onClick={() => toggleExclude(s.id)}
                                  className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold"
                                  style={{
                                    color: isExcluded ? 'var(--k-primary)' : 'var(--k-error)',
                                  }}
                                >
                                  {isExcluded ? (
                                    <><CheckCircle className="h-3 w-3" /> Dahil Et</>
                                  ) : (
                                    <><UserMinus className="h-3 w-3" /> Çıkar</>
                                  )}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Bireysel seçim */
                  <div className="space-y-3">
                    <Input
                      placeholder="Personel ara..."
                      value={staffSearch}
                      onChange={(e) => handleStaffSearch(e.target.value)}
                      className="k-input"
                    />
                    {selectedStaffIds.size > 0 && (
                      <p className="text-xs font-semibold" style={{ color: 'var(--k-primary)' }}>
                        {selectedStaffIds.size} kişi seçildi
                      </p>
                    )}
                    <div
                      className="rounded-xl border max-h-48 overflow-y-auto"
                      style={{ borderColor: 'var(--k-border)', background: 'var(--k-surface)' }}
                    >
                      {filteredStaff.length > 0 ? filteredStaff.map(s => {
                        const isSelected = selectedStaffIds.has(s.id);
                        return (
                          <button
                            key={s.id}
                            onClick={() => toggleStaff(s.id)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors duration-100"
                            style={{
                              background: isSelected
                                ? 'color-mix(in srgb, var(--k-primary) 10%, transparent)'
                                : 'transparent',
                              borderBottom: '1px solid var(--k-border)',
                              color: 'var(--k-text-primary)',
                            }}
                          >
                            <div
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                              style={{
                                background: isSelected ? 'var(--k-primary)' : 'var(--k-bg)',
                                border: isSelected ? 'none' : '1px solid var(--k-border)',
                              }}
                            >
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{s.firstName} {s.lastName}</span>
                              {s.title && (
                                <span
                                  className="text-[11px] ml-1.5"
                                  style={{ color: 'var(--k-text-muted)' }}
                                >
                                  · {s.title}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      }) : (
                        <div
                          className="text-center py-6 text-sm"
                          style={{ color: 'var(--k-text-muted)' }}
                        >
                          Personel bulunamadı
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Step indicator: Ne */}
              <div className="flex items-center gap-2 mb-3 mt-2">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--k-primary)', color: '#fff' }}
                >2</span>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--k-text-secondary)' }}>
                  Bildirim içeriği
                </span>
              </div>

              {/* Notification Content */}
              <div className="space-y-4 mb-6">
                <div>
                  <Label
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: 'var(--k-text-secondary)' }}
                  >
                    Bildirim Tipi
                  </Label>
                  <div
                    role="radiogroup"
                    aria-label="Bildirim tipi"
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                  >
                    {(['info', 'warning', 'error', 'success'] as const).map((key) => {
                      const meta = getNotificationTypeMeta(key);
                      const Icon = meta.icon;
                      const isActive = sendType === key;
                      const sentenceLabel = meta.label.charAt(0) + meta.label.slice(1).toLocaleLowerCase('tr-TR');
                      return (
                        <button
                          key={key}
                          role="radio"
                          aria-checked={isActive}
                          aria-label={sentenceLabel}
                          onClick={() => setSendType(key)}
                          className="group/type flex flex-col items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-xs font-semibold cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                          style={{
                            background: isActive
                              ? `color-mix(in srgb, ${meta.ink} 14%, transparent)`
                              : 'var(--k-bg)',
                            color: isActive ? meta.ink : 'var(--k-text-muted)',
                            border: `1.5px solid ${isActive ? meta.ink : 'var(--k-border)'}`,
                            // @ts-expect-error focus ring uses dynamic color
                            '--tw-ring-color': meta.ink,
                          }}
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-200"
                            style={{
                              background: isActive
                                ? `color-mix(in srgb, ${meta.ink} 18%, transparent)`
                                : 'var(--k-surface)',
                            }}
                          >
                            <Icon className="h-4 w-4" style={{ color: isActive ? meta.ink : 'var(--k-text-muted)' }} />
                          </div>
                          {sentenceLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: 'var(--k-text-secondary)' }}
                  >
                    Başlık
                  </Label>
                  <Input
                    value={sendTitle}
                    onChange={(e) => setSendTitle(e.target.value)}
                    placeholder="Bildirim başlığı"
                    className="k-input"
                  />
                </div>

                <div>
                  <Label
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: 'var(--k-text-secondary)' }}
                  >
                    Mesaj
                  </Label>
                  <textarea
                    value={sendMessage}
                    onChange={(e) => setSendMessage(e.target.value)}
                    placeholder="Bildirim mesajı yazın..."
                    rows={3}
                    className="k-input w-full resize-none"
                    style={{ minHeight: '88px', paddingTop: '0.625rem', paddingBottom: '0.625rem' }}
                  />
                </div>
              </div>

              {/* Step indicator: Nasıl */}
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: 'var(--k-primary)', color: '#fff' }}
                >3</span>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--k-text-secondary)' }}>
                  Gönderim seçenekleri
                </span>
              </div>

              {/* E-posta seçeneği — proper switch toggle */}
              <button
                type="button"
                role="switch"
                aria-checked={alsoSendEmail}
                aria-label="E-posta ile de gönder"
                onClick={() => setAlsoSendEmail(!alsoSendEmail)}
                className="w-full flex items-center justify-between gap-4 rounded-xl px-4 py-3.5 mb-6 text-left cursor-pointer transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 hover:bg-[color-mix(in_srgb,var(--k-primary)_4%,var(--k-bg))]"
                style={{
                  background: alsoSendEmail
                    ? 'color-mix(in srgb, var(--k-primary) 6%, var(--k-bg))'
                    : 'var(--k-bg)',
                  border: `1px solid ${alsoSendEmail ? 'color-mix(in srgb, var(--k-primary) 30%, transparent)' : 'var(--k-border)'}`,
                  // @ts-expect-error focus ring uses theme token
                  '--tw-ring-color': 'var(--k-primary)',
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--k-text-primary)' }}>
                    E-posta ile de gönder
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--k-text-muted)' }}>
                    Bildirimle birlikte alıcılara e-posta da gönderilir
                  </p>
                </div>
                {/* Switch track */}
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200"
                  style={{
                    background: alsoSendEmail ? 'var(--k-primary)' : 'color-mix(in srgb, var(--k-text-muted) 30%, transparent)',
                  }}
                >
                  <span
                    className="inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                    style={{ transform: alsoSendEmail ? 'translateX(22px)' : 'translateX(2px)' }}
                  />
                </span>
              </button>

            </div>

            {/* Footer — modal dibinde sabit, body scroll edilirken kaybolmaz */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
              style={{ borderTop: '1px solid var(--k-border)', background: 'var(--k-surface)' }}
            >
              {/* Recipient summary badge — prominent */}
              <div
                className="flex items-center gap-2.5 rounded-xl px-3 py-2"
                style={{
                  background: getRecipientCount() > 0
                    ? 'color-mix(in srgb, var(--k-primary) 10%, transparent)'
                    : 'var(--k-bg)',
                  border: `1px solid ${getRecipientCount() > 0 ? 'color-mix(in srgb, var(--k-primary) 25%, transparent)' : 'var(--k-border)'}`,
                }}
              >
                <Users
                  className="h-4 w-4"
                  style={{ color: getRecipientCount() > 0 ? 'var(--k-primary)' : 'var(--k-text-muted)' }}
                />
                <div className="leading-tight">
                  <div className="text-[15px] font-bold tabular-nums" style={{ color: getRecipientCount() > 0 ? 'var(--k-primary)' : 'var(--k-text-muted)' }}>
                    {getRecipientCount()}
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--k-text-muted)' }}>
                    {alsoSendEmail ? 'kişi + e-posta' : 'kişi'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="k-btn k-btn-ghost"
                >
                  İptal
                </button>
                <button
                  onClick={handleSend}
                  disabled={sending || getRecipientCount() === 0 || !sendTitle.trim() || !sendMessage.trim()}
                  className="k-btn k-btn-primary"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending ? 'Gönderiliyor...' : 'Gönder'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Alıcı Detay Modali ── */}
      {recipientsModal && (
        <RecipientsModal
          batchId={recipientsModal.batchId}
          title={recipientsModal.title}
          type={recipientsModal.type}
          onClose={() => setRecipientsModal(null)}
        />
      )}

      {/* ── Silme Onay Modali ── batch silme N personeli etkilediği için onaylı */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: 'color-mix(in srgb, var(--k-error) 13%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--k-error) 22%, transparent)',
                }}
              >
                <AlertTriangle className="h-5 w-5" style={{ color: 'var(--k-error)' }} />
              </div>
              <div className="min-w-0">
                <DialogTitle>Bildirimi sil</DialogTitle>
                <DialogDescription className="mt-1">
                  {deleteTarget && (
                    <>
                      <span className="font-semibold" style={{ color: 'var(--k-text-primary)' }}>
                        “{deleteTarget.title}”
                      </span>{' '}
                      bildirimi <strong>{deleteTarget.recipientCount} personelin</strong> hesabından
                      kaldırılacak. Bu işlem geri alınamaz.
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="k-btn k-btn-ghost"
            >
              İptal
            </button>
            <button
              type="button"
              disabled={dismissing !== null}
              onClick={() => { if (deleteTarget) handleDelete(deleteTarget.batchId); }}
              className="k-btn"
              style={{ background: 'var(--k-error)', color: '#fff' }}
            >
              {dismissing !== null
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Trash2 className="h-4 w-4" />}
              Sil
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
