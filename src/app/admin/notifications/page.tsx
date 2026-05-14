'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Bell, BellOff, Send, Check, CheckCircle,
  Filter, Clock, Inbox, Trash2, X, Users, UserMinus, Building2, Loader2, ChevronRight,
  BookOpen,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { getNotificationTypeMeta } from '@/lib/notification-types';
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  relatedTrainingId: string | null;
}

interface AdminNotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
}

interface StaffMember { id: string; firstName: string; lastName: string; title: string | null }
interface Department { id: string; name: string; users: StaffMember[]; _count: { users: number } }

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

  // Yeni bildirim geldiğinde liste tazelensin — bell zaten store'a ekliyor,
  // ama bu sayfanın kendi listesi useFetch'in cache'inden geliyor; refetch ile senkronize tut.
  useRealtimeNotifications();

  const handleDelete = async (notifId: string) => {
    setDismissing(notifId);
    try {
      const res = await fetch(`/api/admin/notifications/${notifId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast('Bildirim silindi', 'success');
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
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
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
      fetch('/api/admin/departments').then(r => r.json()).then(d => {
        const depts = Array.isArray(d) ? d : d.departments ?? d.data ?? [];
        // API "staff" döndürebilir, frontend "users" bekliyor — normalize et
        const normalized = depts.map((dept: Record<string, unknown>) => ({
          ...dept,
          users: (dept.users ?? dept.staff ?? []) as StaffMember[],
          _count: (dept._count ?? { users: (dept.count as number) ?? 0 }) as { users: number },
        }));
        setDepartments(normalized as Department[]);
      }).catch(() => {});
    }
  }, [showSendModal, departments.length]);

  // Seçili departmanın personelleri
  const selectedDept = departments.find(d => d.id === selectedDeptId);
  const deptStaff = selectedDept?.users ?? [];
  const allStaff = departments.flatMap(d => d.users ?? []);

  // Bireysel modda filtrelenen personeller
  const filteredStaff = allStaff.filter(s => {
    if (!debouncedStaffSearch) return true;
    const name = `${s.firstName} ${s.lastName}`.toLowerCase();
    return name.includes(debouncedStaffSearch.toLowerCase());
  });

  // Gönderilecek kişi sayısı
  const getRecipientCount = () => {
    if (sendMode === 'individual') return selectedStaffIds.size;
    if (!selectedDeptId) return 0;
    return deptStaff.length - excludedStaffIds.size;
  };

  const getRecipientIds = (): string[] => {
    if (sendMode === 'individual') return Array.from(selectedStaffIds);
    return deptStaff.filter(s => !excludedStaffIds.has(s.id)).map(s => s.id);
  };

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
      setSelectedDeptId('');
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

  const notifications: Notification[] = data?.notifications ?? [];

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.isRead;
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors duration-150"
                    style={{
                      background: isActive
                        ? 'color-mix(in srgb, var(--k-primary) 12%, transparent)'
                        : 'transparent',
                      color: isActive ? 'var(--k-primary)' : 'var(--k-text-secondary)',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
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
                const isDismissing = dismissing === n.id;
                return (
                  <BlurFade key={n.id} delay={0.08 + i * 0.03}>
                    <div
                      className="group relative flex items-start gap-4 rounded-xl border p-5 transition-colors duration-200"
                      style={{
                        background: 'var(--k-surface)',
                        borderColor: 'var(--k-border)',
                        borderLeftWidth: '3px',
                        borderLeftColor: meta.ink,
                        opacity: isDismissing ? 0 : 1,
                        transform: isDismissing ? 'translateX(20px)' : 'translateX(0)',
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        style={{
                          background: `color-mix(in srgb, ${meta.ink} 14%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${meta.ink} 22%, transparent)`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: meta.ink }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
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
                        </div>
                        <p
                          className="text-[13px] leading-relaxed"
                          style={{ color: 'var(--k-text-secondary)' }}
                        >
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" style={{ color: 'var(--k-text-muted)' }} />
                            <span className="text-[11px] font-mono" style={{ color: 'var(--k-text-muted)' }}>
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
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

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 disabled:opacity-50"
                          style={{ color: 'var(--k-error)' }}
                          title="Sil"
                          aria-label="Bildirimi sil"
                          disabled={dismissing === n.id}
                          onClick={() => handleDelete(n.id)}
                        >
                          {dismissing === n.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
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
              {/* Mode Toggle */}
              <div className="flex gap-2 mb-5">
                <button
                  onClick={() => { setSendMode('department'); setSelectedStaffIds(new Set()); }}
                  className={sendMode === 'department' ? 'k-btn k-btn-primary' : 'k-btn k-btn-ghost'}
                >
                  <Building2 className="h-4 w-4" />
                  Departman Bazlı
                </button>
                <button
                  onClick={() => { setSendMode('individual'); setSelectedDeptId(''); setExcludedStaffIds(new Set()); }}
                  className={sendMode === 'individual' ? 'k-btn k-btn-primary' : 'k-btn k-btn-ghost'}
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
                    <select
                      value={selectedDeptId}
                      onChange={(e) => { setSelectedDeptId(e.target.value); setExcludedStaffIds(new Set()); }}
                      className="k-input w-full"
                    >
                      <option value="">Departman seçin...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.users?.length ?? 0} kişi)</option>
                      ))}
                    </select>

                    {/* Departman personeli — çıkarma özelliği */}
                    {selectedDeptId && deptStaff.length > 0 && (
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

              {/* Notification Content */}
              <div className="space-y-4 mb-6">
                <div>
                  <Label
                    className="text-xs font-semibold mb-2 block"
                    style={{ color: 'var(--k-text-secondary)' }}
                  >
                    Bildirim Tipi
                  </Label>
                  <div className="flex gap-2 flex-wrap">
                    {(['info', 'warning', 'error', 'success'] as const).map((key) => {
                      const meta = getNotificationTypeMeta(key);
                      const Icon = meta.icon;
                      const isActive = sendType === key;
                      const sentenceLabel = meta.label.charAt(0) + meta.label.slice(1).toLocaleLowerCase('tr-TR');
                      return (
                        <button
                          key={key}
                          onClick={() => setSendType(key)}
                          className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150"
                          style={{
                            background: isActive
                              ? `color-mix(in srgb, ${meta.ink} 14%, transparent)`
                              : 'var(--k-bg)',
                            color: isActive ? meta.ink : 'var(--k-text-muted)',
                            border: `1px solid ${isActive ? meta.ink : 'var(--k-border)'}`,
                          }}
                        >
                          <Icon className="h-3.5 w-3.5" />
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

              {/* E-posta seçeneği */}
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div
                    onClick={() => setAlsoSendEmail(!alsoSendEmail)}
                    role="checkbox"
                    aria-checked={alsoSendEmail}
                    aria-label="E-posta ile de gönder"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors duration-150"
                    style={{
                      background: alsoSendEmail ? 'var(--k-primary)' : 'var(--k-bg)',
                      border: alsoSendEmail ? 'none' : '2px solid var(--k-border)',
                    }}
                  >
                    {alsoSendEmail && <Check className="h-3.5 w-3.5 text-white" />}
                  </div>
                  <div>
                    <span
                      className="text-sm font-medium"
                      style={{ color: 'var(--k-text-primary)' }}
                    >
                      E-posta ile de gönder
                    </span>
                    <p className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                      Bildirimle birlikte alıcılara e-posta da gönderilir
                    </p>
                  </div>
                </label>
              </div>

            </div>

            {/* Footer — modal dibinde sabit, body scroll edilirken kaybolmaz */}
            <div
              className="flex items-center justify-between gap-3 px-5 py-4 shrink-0"
              style={{ borderTop: '1px solid var(--k-border)', background: 'var(--k-surface)' }}
            >
              <div className="text-xs" style={{ color: 'var(--k-text-muted)' }}>
                <span className="font-bold" style={{ color: 'var(--k-primary)' }}>
                  {getRecipientCount()}
                </span> kişiye gönderilecek
                {alsoSendEmail && <span className="ml-1.5">(+ e-posta)</span>}
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
    </div>
  );
}
