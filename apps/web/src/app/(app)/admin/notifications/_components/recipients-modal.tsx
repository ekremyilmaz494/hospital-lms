'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Search, Users, CheckCircle2, Circle, Loader2, Mail, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { getNotificationTypeMeta } from '@/lib/notification-types';

interface Recipient {
  notificationId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  title: string | null;
  departmentName: string | null;
  isRead: boolean;
}

interface BatchDetail {
  batchId: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  recipientCount: number;
  readCount: number;
  recipients: Recipient[];
}

type Tab = 'all' | 'read' | 'unread';

interface Props {
  batchId: string;
  title: string;
  type: string;
  onClose: () => void;
}

export function RecipientsModal({ batchId, title, type, onClose }: Props) {
  const [data, setData] = useState<BatchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');

  // ESC ile kapanma
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Fetch — modal her açılışta yeniden mount olur, başlangıç state'i
  // (isLoading=true, error=null) ilk render'ı zaten karşılar; effect içinde
  // senkron setState çağrısı gereksiz (cascading render önlenir).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/notifications/batch/${batchId}`)
      .then(async res => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Alıcılar yüklenemedi');
        return json as BatchDetail;
      })
      .then(json => {
        if (!alive) return;
        setData(json);
      })
      .catch(err => {
        if (!alive) return;
        setError(err.message || 'Alıcılar yüklenemedi');
      })
      .finally(() => {
        if (alive) setIsLoading(false);
      });
    return () => { alive = false; };
  }, [batchId]);

  const meta = getNotificationTypeMeta(type);

  const filteredRecipients = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLocaleLowerCase('tr-TR');
    return data.recipients.filter(r => {
      if (tab === 'read' && !r.isRead) return false;
      if (tab === 'unread' && r.isRead) return false;
      if (!q) return true;
      const haystack = `${r.firstName} ${r.lastName} ${r.email} ${r.departmentName ?? ''}`.toLocaleLowerCase('tr-TR');
      return haystack.includes(q);
    });
  }, [data, search, tab]);

  const readPct = data && data.recipientCount > 0
    ? Math.round((data.readCount / data.recipientCount) * 100)
    : 0;

  const tabs: { id: Tab; label: string; count: number }[] = data ? [
    { id: 'all', label: 'Tümü', count: data.recipientCount },
    { id: 'read', label: 'Okuyanlar', count: data.readCount },
    { id: 'unread', label: 'Bekleyenler', count: data.recipientCount - data.readCount },
  ] : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipients-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="k-card w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ borderColor: 'var(--k-border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="k-card-head flex items-start justify-between shrink-0 gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in srgb, ${meta.ink} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${meta.ink} 22%, transparent)`,
              }}
            >
              <Users className="h-5 w-5" style={{ color: meta.ink }} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="recipients-modal-title"
                className="text-lg font-bold truncate"
                style={{ color: 'var(--k-text-primary)' }}
              >
                Alıcılar
              </h2>
              <p className="text-xs truncate" style={{ color: 'var(--k-text-muted)' }} title={title}>
                {title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="k-btn k-btn-ghost k-btn-sm shrink-0"
            style={{ padding: '0.5rem' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Summary + progress */}
        {data && !isLoading && !error && (
          <div className="px-5 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--k-border)' }}>
            <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--k-primary) 10%, transparent)',
                    color: 'var(--k-primary)',
                  }}
                >
                  <Users className="h-3 w-3" />
                  {data.recipientCount} kişiye gönderildi
                </span>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    background: 'color-mix(in srgb, #059669 12%, transparent)',
                    color: '#047857',
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {data.readCount} okudu
                </span>
              </div>
              <span className="text-[11px] font-mono" style={{ color: 'var(--k-text-muted)' }}>
                %{readPct}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: 'color-mix(in srgb, var(--k-border) 70%, transparent)' }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${readPct}%`,
                  background: '#10b981',
                }}
              />
            </div>
          </div>
        )}

        {/* Tabs + search */}
        {data && !isLoading && !error && (
          <div className="px-5 pt-4 pb-3 shrink-0 space-y-3">
            <div
              role="tablist"
              aria-label="Okunma durumu"
              className="grid grid-cols-3 gap-1 p-1 rounded-xl"
              style={{ background: 'var(--k-bg)', border: '1px solid var(--k-border)' }}
            >
              {tabs.map(t => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold cursor-pointer transition-colors duration-200"
                    style={{
                      background: active ? 'var(--k-surface)' : 'transparent',
                      color: active ? 'var(--k-primary)' : 'var(--k-text-muted)',
                      boxShadow: active ? '0 1px 2px rgba(15,23,42,0.06)' : 'none',
                    }}
                  >
                    {t.label}
                    <span
                      className="inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-5 h-5"
                      style={{
                        background: active
                          ? 'color-mix(in srgb, var(--k-primary) 16%, transparent)'
                          : 'color-mix(in srgb, var(--k-text-muted) 12%, transparent)',
                        color: active ? 'var(--k-primary)' : 'var(--k-text-muted)',
                      }}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: 'var(--k-text-muted)' }}
              />
              <Input
                type="search"
                placeholder="Ad, e-posta veya departman ara…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-5" aria-live="polite" aria-busy={isLoading}>
          {isLoading && (
            <div className="space-y-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl animate-pulse"
                  style={{ background: 'color-mix(in srgb, var(--k-border) 50%, transparent)' }}
                />
              ))}
            </div>
          )}

          {error && !isLoading && (
            <div
              className="flex flex-col items-center justify-center text-center py-10"
              style={{ color: 'var(--k-error)' }}
            >
              <p className="text-sm font-semibold">{error}</p>
            </div>
          )}

          {data && !isLoading && !error && filteredRecipients.length === 0 && (
            <div
              className="flex flex-col items-center justify-center rounded-xl border py-12"
              style={{ background: 'var(--k-bg)', borderColor: 'var(--k-border)' }}
            >
              <Loader2 className="h-6 w-6 mb-3" style={{ color: 'var(--k-text-muted)', opacity: 0.4 }} />
              <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--k-text-primary)' }}>
                Eşleşen alıcı yok
              </p>
              <p className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                Bu filtre veya aramayla alıcı bulunamadı.
              </p>
            </div>
          )}

          {data && !isLoading && !error && filteredRecipients.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {filteredRecipients.map(r => {
                const initials = `${r.firstName[0] ?? ''}${r.lastName[0] ?? ''}`.toLocaleUpperCase('tr-TR');
                return (
                  <li
                    key={r.notificationId}
                    className="flex items-center gap-3 rounded-xl border p-3"
                    style={{
                      background: 'var(--k-surface)',
                      borderColor: 'var(--k-border)',
                    }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                      style={{
                        background: 'color-mix(in srgb, var(--k-primary) 14%, transparent)',
                        color: 'var(--k-primary)',
                      }}
                      aria-hidden="true"
                    >
                      {initials || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[13px] font-semibold truncate"
                          style={{ color: 'var(--k-text-primary)' }}
                        >
                          {r.firstName} {r.lastName}
                        </span>
                        {r.title && (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: 'var(--k-text-muted)' }}
                          >
                            {r.title}
                          </span>
                        )}
                      </div>
                      <div
                        className="flex items-center gap-3 mt-0.5 text-[11px]"
                        style={{ color: 'var(--k-text-muted)' }}
                      >
                        <span className="inline-flex items-center gap-1 min-w-0">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{r.email}</span>
                        </span>
                        {r.departmentName && (
                          <span className="inline-flex items-center gap-1 shrink-0">
                            <Building2 className="h-3 w-3" />
                            {r.departmentName}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {r.isRead ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                          style={{
                            background: 'color-mix(in srgb, #059669 12%, transparent)',
                            color: '#047857',
                          }}
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Okundu
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                          style={{
                            background: 'color-mix(in srgb, var(--k-text-muted) 14%, transparent)',
                            color: 'var(--k-text-muted)',
                          }}
                        >
                          <Circle className="h-3 w-3" />
                          Bekliyor
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
