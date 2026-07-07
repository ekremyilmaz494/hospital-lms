'use client';

import { useMemo, useState } from 'react';
import {
  Inbox,
  Search,
  Mail,
  Phone,
  Building2,
  Users,
  Trash2,
  Archive,
  MailOpen,
  MailCheck,
  MessageSquare,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Message {
  id: string;
  source: 'contact' | 'demo';
  name: string;
  email: string;
  phone: string | null;
  organization: string | null;
  staffCount: string | null;
  subject: string | null;
  message: string | null;
  isRead: boolean;
  createdAt: string;
}

interface MessagesResponse {
  messages: Message[];
  unreadCount: number;
  total: number;
}

type SourceFilter = 'all' | 'contact' | 'demo' | 'unread';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MessagesPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<MessagesResponse>(
    '/api/super-admin/messages',
    { noStore: true },
  );
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const messages = data?.messages ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'unread' && !m.isRead) ||
        m.source === filter;
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.subject?.toLowerCase().includes(q) ?? false) ||
        (m.organization?.toLowerCase().includes(q) ?? false) ||
        (m.message?.toLowerCase().includes(q) ?? false);
      return matchesFilter && matchesSearch;
    });
  }, [messages, search, filter]);

  const patchMessage = async (id: string, body: { isRead?: boolean; isArchived?: boolean }) => {
    setBusy(id);
    try {
      const res = await fetch(`/api/super-admin/messages/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || 'İşlem başarısız');
      }
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'İşlem başarısız', 'error');
    } finally {
      setBusy(null);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!window.confirm('Bu mesajı kalıcı olarak silmek istediğinize emin misiniz?')) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/super-admin/messages/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || 'Silinemedi');
      }
      toast('Mesaj silindi', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Silinemedi', 'error');
    } finally {
      setBusy(null);
    }
  };

  const toggleExpand = (m: Message) => {
    const next = expanded === m.id ? null : m.id;
    setExpanded(next);
    // Açılışta okunmamışsa okundu işaretle
    if (next && !m.isRead) patchMessage(m.id, { isRead: true });
  };

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm" style={{ color: 'var(--color-error)' }}>
          Mesajlar yüklenemedi. Lütfen tekrar deneyin.
        </p>
        <Button onClick={() => refetch()} className="mt-4 rounded-xl">
          Tekrar Dene
        </Button>
      </div>
    );
  }

  const unreadCount = data?.unreadCount ?? 0;
  const contactCount = messages.filter((m) => m.source === 'contact').length;
  const demoCount = messages.filter((m) => m.source === 'demo').length;

  const tabs: { key: SourceFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tümü', count: messages.length },
    { key: 'unread', label: 'Okunmamış', count: unreadCount },
    { key: 'contact', label: 'İletişim', count: contactCount },
    { key: 'demo', label: 'Demo Talebi', count: demoCount },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="İletişim Mesajları"
        subtitle="Web sitesi iletişim formu ve demo talepleri"
        badge={unreadCount > 0 ? `${unreadCount} okunmamış` : undefined}
      />

      {/* Filtre sekmeleri + arama */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold"
                style={{
                  background: active ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: active ? 'white' : 'var(--color-text-secondary)',
                  border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
                }}
              >
                {t.label}
                <span
                  className="rounded-full px-1.5 text-[11px] font-bold"
                  style={{
                    background: active ? 'rgba(255,255,255,0.22)' : 'var(--color-primary-light)',
                    color: active ? 'white' : 'var(--color-primary)',
                  }}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--color-text-muted)' }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ara: isim, e-posta, konu..."
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-16"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        >
          <Inbox className="mb-3 h-10 w-10" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            {messages.length === 0 ? 'Henüz mesaj yok.' : 'Filtreye uygun mesaj bulunamadı.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m, i) => {
            const isOpen = expanded === m.id;
            const SourceIcon = m.source === 'contact' ? MessageSquare : FlaskConical;
            return (
              <BlurFade key={m.id} delay={Math.min(i * 0.03, 0.3)}>
                <div
                  className="rounded-2xl border"
                  style={{
                    borderColor: m.isRead ? 'var(--color-border)' : 'var(--color-primary)',
                    background: 'var(--color-surface)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Başlık satırı */}
                  <button
                    onClick={() => toggleExpand(m)}
                    className="flex w-full items-center gap-3 p-4 text-left"
                  >
                    {!m.isRead && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: 'var(--color-primary)' }}
                      />
                    )}
                    <span
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold"
                      style={{
                        background: 'var(--color-primary-light)',
                        color: 'var(--color-primary)',
                      }}
                    >
                      <SourceIcon className="h-3 w-3" />
                      {m.source === 'contact' ? 'İletişim' : 'Demo'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate text-sm"
                        style={{
                          fontWeight: m.isRead ? 500 : 700,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {m.name}
                        <span className="font-normal" style={{ color: 'var(--color-text-muted)' }}>
                          {' · '}
                          {m.subject || m.organization || m.email}
                        </span>
                      </p>
                    </div>
                    <span
                      className="shrink-0 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {formatDate(m.createdAt)}
                    </span>
                  </button>

                  {/* Detay */}
                  {isOpen && (
                    <div
                      className="border-t px-4 py-4"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="mb-4 grid gap-2 sm:grid-cols-2">
                        <DetailRow icon={Mail} label="E-posta" value={m.email} href={`mailto:${m.email}`} />
                        {m.phone && <DetailRow icon={Phone} label="Telefon" value={m.phone} href={`tel:${m.phone}`} />}
                        {m.organization && <DetailRow icon={Building2} label="Kurum" value={m.organization} />}
                        {m.staffCount && <DetailRow icon={Users} label="Personel" value={m.staffCount} />}
                        {m.subject && <DetailRow icon={MessageSquare} label="Konu" value={m.subject} />}
                      </div>

                      {m.message && (
                        <div
                          className="mb-4 rounded-xl p-3 text-sm leading-relaxed"
                          style={{
                            background: 'var(--color-bg)',
                            color: 'var(--color-text-secondary)',
                            whiteSpace: 'pre-wrap',
                          }}
                        >
                          {m.message}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === m.id}
                          onClick={() => patchMessage(m.id, { isRead: !m.isRead })}
                          className="gap-1.5 rounded-lg"
                        >
                          {m.isRead ? <MailOpen className="h-3.5 w-3.5" /> : <MailCheck className="h-3.5 w-3.5" />}
                          {m.isRead ? 'Okunmadı işaretle' : 'Okundu işaretle'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === m.id}
                          onClick={() => patchMessage(m.id, { isArchived: true })}
                          className="gap-1.5 rounded-lg"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          Arşivle
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === m.id}
                          onClick={() => deleteMessage(m.id)}
                          className="gap-1.5 rounded-lg"
                          style={{ color: 'var(--color-error)' }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Sil
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </BlurFade>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
      <span style={{ color: 'var(--color-text-muted)' }}>{label}:</span>
      {href ? (
        <a href={href} className="truncate font-medium" style={{ color: 'var(--color-primary)' }}>
          {value}
        </a>
      ) : (
        <span className="truncate font-medium" style={{ color: 'var(--color-text-primary)' }}>
          {value}
        </span>
      )}
    </div>
  );
}
