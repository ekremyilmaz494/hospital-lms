'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, BellOff, Send, AlertTriangle, Info, Check, CheckCircle, Zap,
  Filter, Clock, Inbox, Trash2, X, Users, UserMinus, Building2, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  time: string;
  isRead: boolean;
}

interface StaffMember { id: string; firstName: string; lastName: string; title: string | null }
interface Department { id: string; name: string; users: StaffMember[]; _count: { users: number } }

const typeConfig: Record<string, { color: string; bg: string; icon: typeof Bell; label: string }> = {
  warning: { color: 'var(--color-warning)', bg: 'var(--color-warning-bg)', icon: AlertTriangle, label: 'Uyarı' },
  error: { color: 'var(--color-error)', bg: 'var(--color-error-bg)', icon: Zap, label: 'Acil' },
  info: { color: 'var(--color-info)', bg: 'var(--color-info-bg)', icon: Info, label: 'Bilgi' },
  success: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', icon: CheckCircle, label: 'Başarılı' },
};

type FilterType = 'all' | 'unread' | 'warning' | 'error' | 'info' | 'success';

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
  const { data, isLoading, error, refetch } = useFetch<Notification[]>('/api/admin/notifications');
  const [filter, setFilter] = useState<FilterType>('all');
  const [dismissing] = useState<string | null>(null);

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
        setDepartments(depts);
      }).catch(() => {});
    }
  }, [showSendModal, departments.length]);

  // Seçili departmanın personelleri
  const selectedDept = departments.find(d => d.id === selectedDeptId);
  const deptStaff = selectedDept?.users ?? [];
  const allStaff = departments.flatMap(d => d.users);

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
      // Her alıcıya bildirim oluştur
      const results = await Promise.all(
        recipientIds.map(userId =>
          fetch('/api/admin/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, title: sendTitle, message: sendMessage, type: sendType }),
          })
        )
      );
      const successCount = results.filter(r => r.ok).length;
      toast(`${successCount} kişiye bildirim gönderildi`, 'success');
      setShowSendModal(false);
      setSendTitle('');
      setSendMessage('');
      setSendType('info');
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
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  const notifications = Array.isArray(data) ? data : ((data as unknown as Record<string, unknown>)?.notifications as typeof data) ?? [];

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    return n.type === filter;
  });

  const filters: { id: FilterType; label: string; icon: typeof Bell; count?: number }[] = [
    { id: 'all', label: 'Tümü', icon: Inbox, count: notifications.length },
    { id: 'info', label: 'Bilgi', icon: Info },
    { id: 'warning', label: 'Uyarı', icon: AlertTriangle },
    { id: 'error', label: 'Acil', icon: Zap },
    { id: 'success', label: 'Başarılı', icon: CheckCircle },
  ];

  return (
    <div>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 4px 14px rgba(13, 150, 104, 0.25)',
              }}
            >
              <Bell className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
                Bildirim Yonetimi
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Personele bildirim gonderin ve takip edin
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSendModal(true)}
              className="flex items-center gap-2 rounded-xl h-10 px-5 text-[13px] font-semibold text-white transition-[transform] duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
              }}
            >
              <Send className="h-4 w-4" />
              Bildirim Gönder
            </button>
          </div>
        </div>
      </BlurFade>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <BlurFade delay={0.05}>
          <div className="w-52 shrink-0 space-y-1">
            <div className="flex items-center gap-2 px-3 mb-3">
              <Filter className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
              <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                Filtrele
              </span>
            </div>
            {filters.map((f) => {
              const isActive = filter === f.id;
              const typeConf = typeConfig[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-all duration-200"
                  style={{
                    background: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 500,
                    boxShadow: isActive ? '0 2px 8px rgba(13, 150, 104, 0.2)' : 'none',
                  }}
                >
                  <f.icon
                    className="h-4 w-4"
                    style={{
                      color: isActive ? 'white' : typeConf?.color || 'var(--color-text-muted)',
                      opacity: isActive ? 1 : 0.7,
                    }}
                  />
                  <span className="flex-1 text-left">{f.label}</span>
                  {f.count !== undefined && f.count > 0 && (
                    <span
                      className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--color-bg)',
                        color: isActive ? 'white' : 'var(--color-text-muted)',
                      }}
                    >
                      {f.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </BlurFade>

        {/* Notification list */}
        <div className="flex-1 min-w-0">
          {filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((n, i) => {
                const cfg = typeConfig[n.type] || typeConfig.info;
                const Icon = cfg.icon;
                const isDismissing = dismissing === n.id;
                return (
                  <BlurFade key={n.id} delay={0.08 + i * 0.03}>
                    <div
                      className="group relative flex items-start gap-4 rounded-xl border p-5 transition-all duration-300"
                      style={{
                        background: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        borderLeftWidth: '3px',
                        borderLeftColor: cfg.color,
                        opacity: isDismissing ? 0 : 1,
                        transform: isDismissing ? 'translateX(20px)' : 'translateX(0)',
                      }}
                    >
                      {/* Icon */}
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
                        style={{
                          background: `${cfg.color}10`,
                          border: `1px solid ${cfg.color}15`,
                        }}
                      >
                        <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {n.title}
                          </p>
                          <span
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: `${cfg.color}12`, color: cfg.color }}
                          >
                            {cfg.label}
                          </span>
                        </div>
                        <p
                          className="text-[13px] leading-relaxed"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {n.message}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <Clock className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                          <span className="text-[11px] font-mono" style={{ color: 'var(--color-text-muted)' }}>
                            {timeAgo(n.time)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button
                          className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150"
                          style={{ color: 'var(--color-text-muted)' }}
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </BlurFade>
                );
              })}
            </div>
          ) : (
            <div
              className="flex flex-col items-center justify-center rounded-2xl border py-20"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4"
                style={{ background: 'var(--color-bg)' }}
              >
                <BellOff className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="text-[14px] font-semibold mb-1">Bildirim bulunamadı</p>
              <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                {filter !== 'all' ? 'Bu filtreye uygun bildirim yok' : 'Henüz bildiriminiz bulunmuyor'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Send Notification Modal ── */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border p-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-xl)' }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'rgba(13,150,104,0.1)' }}>
                  <Send className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Bildirim Gönder</h2>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Personellere hedefli bildirim gönderin</p>
                </div>
              </div>
              <button onClick={() => setShowSendModal(false)} className="rounded-lg p-2" style={{ color: 'var(--color-text-muted)' }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Toggle */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => { setSendMode('department'); setSelectedStaffIds(new Set()); }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{
                  background: sendMode === 'department' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: sendMode === 'department' ? 'white' : 'var(--color-text-secondary)',
                  border: `1px solid ${sendMode === 'department' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                <Building2 className="h-4 w-4" />
                Departman Bazlı
              </button>
              <button
                onClick={() => { setSendMode('individual'); setSelectedDeptId(''); setExcludedStaffIds(new Set()); }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
                style={{
                  background: sendMode === 'individual' ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: sendMode === 'individual' ? 'white' : 'var(--color-text-secondary)',
                  border: `1px solid ${sendMode === 'individual' ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                <Users className="h-4 w-4" />
                Kişi Bazlı
              </button>
            </div>

            {/* Recipient Selection */}
            <div className="mb-5">
              <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>
                {sendMode === 'department' ? 'Departman Seçin' : 'Personel Seçin'}
              </Label>

              {sendMode === 'department' ? (
                <div className="space-y-3">
                  <select
                    value={selectedDeptId}
                    onChange={(e) => { setSelectedDeptId(e.target.value); setExcludedStaffIds(new Set()); }}
                    className="w-full rounded-xl border h-11 px-3 text-sm"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                  >
                    <option value="">Departman seçin...</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.users.length} kişi)</option>
                    ))}
                  </select>

                  {/* Departman personeli — çıkarma özelliği */}
                  {selectedDeptId && deptStaff.length > 0 && (
                    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                          {deptStaff.length - excludedStaffIds.size} / {deptStaff.length} kişi alacak
                        </p>
                        {excludedStaffIds.size > 0 && (
                          <button onClick={() => setExcludedStaffIds(new Set())} className="text-[11px] font-semibold" style={{ color: 'var(--color-primary)' }}>
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
                              style={{ opacity: isExcluded ? 0.5 : 1, background: isExcluded ? 'var(--color-error-bg)' : 'var(--color-surface)' }}
                            >
                              <span className={isExcluded ? 'line-through' : ''}>{s.firstName} {s.lastName}</span>
                              <button
                                onClick={() => toggleExclude(s.id)}
                                className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold"
                                style={{ color: isExcluded ? 'var(--color-primary)' : 'var(--color-error)' }}
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
                    className="h-11 rounded-xl text-sm"
                    style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                  />
                  {selectedStaffIds.size > 0 && (
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>
                      {selectedStaffIds.size} kişi seçildi
                    </p>
                  )}
                  <div className="rounded-xl border max-h-48 overflow-y-auto" style={{ borderColor: 'var(--color-border)' }}>
                    {filteredStaff.length > 0 ? filteredStaff.map(s => {
                      const isSelected = selectedStaffIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleStaff(s.id)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-left transition-colors duration-100"
                          style={{
                            background: isSelected ? 'rgba(13,150,104,0.08)' : 'transparent',
                            borderBottom: '1px solid var(--color-border)',
                          }}
                        >
                          <div
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                            style={{
                              background: isSelected ? 'var(--color-primary)' : 'var(--color-bg)',
                              border: isSelected ? 'none' : '1px solid var(--color-border)',
                            }}
                          >
                            {isSelected && <Check className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium">{s.firstName} {s.lastName}</span>
                            {s.title && <span className="text-[11px] ml-1.5" style={{ color: 'var(--color-text-muted)' }}>· {s.title}</span>}
                          </div>
                        </button>
                      );
                    }) : (
                      <div className="text-center py-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>Personel bulunamadı</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Notification Content */}
            <div className="space-y-4 mb-6">
              <div>
                <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>Bildirim Tipi</Label>
                <div className="flex gap-2">
                  {Object.entries(typeConfig).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setSendType(key)}
                        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
                        style={{
                          background: sendType === key ? cfg.bg : 'var(--color-bg)',
                          color: sendType === key ? cfg.color : 'var(--color-text-muted)',
                          border: `1px solid ${sendType === key ? cfg.color : 'var(--color-border)'}`,
                        }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>Başlık</Label>
                <Input
                  value={sendTitle}
                  onChange={(e) => setSendTitle(e.target.value)}
                  placeholder="Bildirim başlığı"
                  className="h-11 rounded-xl text-sm"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                />
              </div>

              <div>
                <Label className="text-xs font-semibold mb-2 block" style={{ color: 'var(--color-text-secondary)' }}>Mesaj</Label>
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  placeholder="Bildirim mesajı yazın..."
                  rows={3}
                  className="w-full rounded-xl border px-4 py-3 text-sm resize-none"
                  style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span className="font-bold" style={{ color: 'var(--color-primary)' }}>{getRecipientCount()}</span> kişiye gönderilecek
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => setShowSendModal(false)}>İptal</Button>
                <button
                  onClick={handleSend}
                  disabled={sending || getRecipientCount() === 0 || !sendTitle.trim() || !sendMessage.trim()}
                  className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-[transform] duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}
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
