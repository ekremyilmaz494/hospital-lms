'use client';

import { useState, useEffect, useRef } from 'react';
import { Inbox, ShieldCheck, Clock, User, AlertTriangle } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { StatusChip, type StatusChipVariant } from '@/components/shared/status-chip';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import { KVKK_REQUEST_TYPE_LABELS, KVKK_RESPONSE_SLA_DAYS, type KvkkRequestType } from '@/lib/kvkk/request-types';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

type Filter = 'pending' | 'in_progress' | 'completed' | 'rejected' | 'all';
type ResolveMode = 'in_progress' | 'completed' | 'rejected';

interface KvkkRequest {
  id: string;
  requestType: string;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  description: string;
  responseNote: string | null;
  createdAt: string;
  completedAt: string | null;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    departmentRel: { name: string } | null;
  };
  respondedBy: { firstName: string; lastName: string } | null;
}

const PAGE_LIMIT = 20;

const STATUS_CHIP: Record<KvkkRequest['status'], { label: string; variant: StatusChipVariant }> = {
  pending: { label: 'Bekliyor', variant: 'warning' },
  in_progress: { label: 'İşleniyor', variant: 'in_progress' },
  completed: { label: 'Tamamlandı', variant: 'success' },
  rejected: { label: 'Reddedildi', variant: 'error' },
};

const MODE_LABEL: Record<ResolveMode, string> = {
  in_progress: 'İşleme Al',
  completed: 'Yanıtla & Tamamla',
  rejected: 'Reddet',
};

/** createdAt'ten itibaren KVKK m.13 (30 gün) kalan gün — negatifse süre aşımı. */
function slaDaysLeft(createdAt: string): number {
  const elapsed = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  return KVKK_RESPONSE_SLA_DAYS - elapsed;
}

export default function AdminKvkkRequestsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<{
    items: KvkkRequest[];
    total: number;
    pendingCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/api/admin/kvkk-requests?status=${filter}&page=${page}&limit=${PAGE_LIMIT}`);

  const lastDataRef = useRef<typeof data>(null);
  if (data) lastDataRef.current = data;
  const shownData = data ?? lastDataRef.current;

  useEffect(() => { setPage(1); }, [filter]);

  const [resolving, setResolving] = useState<{ req: KvkkRequest; mode: ResolveMode } | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitResolve = async () => {
    if (!resolving) return;
    if (resolving.mode !== 'in_progress' && note.trim().length < 3) {
      toast('Yanıt notu en az 3 karakter olmalı', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/kvkk-requests/${resolving.req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: resolving.mode, responseNote: note.trim() || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'İşlem başarısız');
      toast(
        resolving.mode === 'completed' ? 'Talep tamamlandı'
          : resolving.mode === 'rejected' ? 'Talep reddedildi'
          : 'Talep işleme alındı',
        'success',
      );
      setResolving(null);
      setNote('');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!shownData && isLoading) return <PageLoading />;

  const requests = shownData?.items ?? [];
  const refreshing = isLoading && !!shownData;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, fontFamily: K.FONT_DISPLAY }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        gap: 16, paddingBottom: 20, borderBottom: `1px solid ${K.BORDER_LIGHT}`,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: K.TEXT_PRIMARY, letterSpacing: '-0.02em' }}>
            KVKK Hak Talepleri
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: K.TEXT_MUTED }}>
            6698 sayılı Kanun m.11 kapsamında personel taleplerini yanıtlayın. Yasal yanıt süresi {KVKK_RESPONSE_SLA_DAYS} gündür.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([
          { id: 'pending', label: 'Bekleyen' },
          { id: 'in_progress', label: 'İşlenen' },
          { id: 'completed', label: 'Tamamlanan' },
          { id: 'rejected', label: 'Reddedilen' },
          { id: 'all', label: 'Tümü' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: filter === tab.id ? K.PRIMARY : K.SURFACE,
              color: filter === tab.id ? '#fff' : K.TEXT_SECONDARY,
              border: `1px solid ${filter === tab.id ? K.PRIMARY : K.BORDER}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div aria-hidden style={{ height: 2, borderRadius: 999, background: refreshing ? K.PRIMARY : 'transparent', opacity: refreshing ? 0.6 : 0 }} className={refreshing ? 'animate-pulse' : undefined} />

      {error && (
        <div style={{ padding: 14, borderRadius: 12, background: K.ERROR_BG, color: '#7a1d14', border: `1px solid ${K.ERROR}`, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* List */}
      {requests.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: 60, gap: 12, color: K.TEXT_MUTED,
          background: K.SURFACE, borderRadius: 14, border: `1.5px solid ${K.BORDER_LIGHT}`,
        }}>
          <Inbox className="h-10 w-10" />
          <p style={{ margin: 0, fontSize: 14 }}>{filter === 'pending' ? 'Bekleyen talep yok' : 'Kayıt yok'}</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((r) => {
            const chip = STATUS_CHIP[r.status] ?? STATUS_CHIP.pending;
            const typeLabel = KVKK_REQUEST_TYPE_LABELS[r.requestType as KvkkRequestType]?.label ?? r.requestType;
            const open = r.status === 'pending' || r.status === 'in_progress';
            const daysLeft = open ? slaDaysLeft(r.createdAt) : null;
            const overdue = daysLeft != null && daysLeft < 0;
            return (
              <li key={r.id} style={{
                background: K.SURFACE, borderRadius: 14, border: `1.5px solid ${K.BORDER_LIGHT}`,
                padding: 18, boxShadow: K.SHADOW_CARD, display: 'flex', flexDirection: 'column', gap: 12,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: K.PRIMARY }} />
                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: K.TEXT_PRIMARY }}>{typeLabel}</h3>
                    <StatusChip variant={chip.variant} label={chip.label} size="sm" />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {daysLeft != null && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 999,
                        background: overdue ? K.ERROR_BG : daysLeft <= 5 ? K.WARNING_BG : K.INFO_BG,
                        color: overdue ? '#7a1d14' : daysLeft <= 5 ? '#7a4a04' : '#1e3a5f',
                      }}>
                        {overdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {overdue ? `${Math.abs(daysLeft)} gün gecikti` : `${daysLeft} gün kaldı`}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: K.TEXT_MUTED }}>
                  <User className="h-3.5 w-3.5" />
                  <span style={{ fontWeight: 600, color: K.TEXT_SECONDARY }}>{r.user.firstName} {r.user.lastName}</span>
                  <span>·</span>
                  <span>{r.user.email}</span>
                  {r.user.departmentRel?.name && (<><span>·</span><span>{r.user.departmentRel.name}</span></>)}
                  <span>·</span>
                  <span>{new Date(r.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>

                <p style={{ margin: 0, fontSize: 13, color: K.TEXT_SECONDARY, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {r.description}
                </p>

                {r.responseNote && (
                  <div style={{ padding: 12, borderRadius: 10, background: K.INFO_BG, border: `1px solid ${K.INFO}` }}>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Yanıt {r.respondedBy && `· ${r.respondedBy.firstName} ${r.respondedBy.lastName}`}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: K.TEXT_PRIMARY }}>{r.responseNote}</p>
                  </div>
                )}

                {open && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 4 }}>
                    {r.status === 'pending' && (
                      <button
                        onClick={() => { setResolving({ req: r, mode: 'in_progress' }); setNote(''); }}
                        style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: K.SURFACE, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}` }}
                      >
                        {MODE_LABEL.in_progress}
                      </button>
                    )}
                    <button
                      onClick={() => { setResolving({ req: r, mode: 'completed' }); setNote(''); }}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: K.PRIMARY, color: '#fff', border: `1px solid ${K.PRIMARY}` }}
                    >
                      {MODE_LABEL.completed}
                    </button>
                    <button
                      onClick={() => { setResolving({ req: r, mode: 'rejected' }); setNote(''); }}
                      style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: K.SURFACE, color: K.ERROR, border: `1px solid ${K.ERROR}` }}
                    >
                      {MODE_LABEL.rejected}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {shownData && shownData.totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer', background: K.SURFACE, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}`, opacity: page <= 1 ? 0.5 : 1 }}>
            Önceki
          </button>
          <span style={{ fontSize: 12, color: K.TEXT_MUTED }}>{page} / {shownData.totalPages}</span>
          <button disabled={page >= shownData.totalPages} onClick={() => setPage((p) => p + 1)}
            style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: page >= shownData.totalPages ? 'not-allowed' : 'pointer', background: K.SURFACE, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}`, opacity: page >= shownData.totalPages ? 0.5 : 1 }}>
            Sonraki
          </button>
        </div>
      )}

      {/* Resolve modal */}
      <PremiumModal
        isOpen={!!resolving}
        onClose={() => !submitting && setResolving(null)}
        eyebrow="KVKK Hak Talebi"
        title={resolving ? MODE_LABEL[resolving.mode] : ''}
        subtitle={resolving ? `${resolving.req.user.firstName} ${resolving.req.user.lastName} · ${KVKK_REQUEST_TYPE_LABELS[resolving.req.requestType as KvkkRequestType]?.label ?? resolving.req.requestType}` : ''}
        size="md"
        disableEscape={submitting}
        footer={
          <PremiumModalFooter
            actions={
              <>
                <PremiumButton variant="ghost" onClick={() => setResolving(null)} disabled={submitting}>Vazgeç</PremiumButton>
                <PremiumButton onClick={submitResolve} disabled={submitting}>
                  {submitting ? 'Gönderiliyor...' : 'Onayla'}
                </PremiumButton>
              </>
            }
          />
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: K.TEXT_SECONDARY }}>
            Yanıt notu {resolving?.mode === 'in_progress' ? '(isteğe bağlı)' : '(personele iletilir)'}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder={resolving?.mode === 'rejected' ? 'Red gerekçesini açıklayın...' : 'Talebe ilişkin yanıtınızı yazın...'}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${K.BORDER}`, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', color: K.TEXT_PRIMARY }}
          />
          <p style={{ margin: 0, fontSize: 11, color: K.TEXT_MUTED, textAlign: 'right' }}>{note.length}/2000</p>
        </div>
      </PremiumModal>
    </div>
  );
}
