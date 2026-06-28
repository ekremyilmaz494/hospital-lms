'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Inbox, Check, X, Clock, User, GraduationCap } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { StatusChip, type StatusChipVariant } from '@/components/shared/status-chip';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

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

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

interface AttemptRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string | null;
  grantedAttempts: number | null;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  trainingId: string;
  userId: string;
  training: { title: string };
  user: {
    firstName: string;
    lastName: string;
    email: string;
    departmentRel: { name: string } | null;
  };
  reviewedBy: { firstName: string; lastName: string } | null;
  assignment: {
    currentAttempt: number;
    maxAttempts: number;
    status: string;
  } | null;
}

const PAGE_LIMIT = 20;

/** Atama durumu → Türkçe etiket + StatusChip varyantı (ham İngilizce enum göstermemek için). */
const ASSIGNMENT_STATUS: Record<string, { label: string; variant: StatusChipVariant }> = {
  assigned: { label: 'Atandı', variant: 'assigned' },
  in_progress: { label: 'Devam ediyor', variant: 'in_progress' },
  passed: { label: 'Başarılı', variant: 'passed' },
  failed: { label: 'Başarısız', variant: 'failed' },
  locked: { label: 'Kilitli', variant: 'locked' },
};

/** Talep durumu → StatusChip varyantı + etiket. */
const REQUEST_STATUS: Record<AttemptRequest['status'], { label: string; variant: StatusChipVariant }> = {
  pending: { label: 'Bekliyor', variant: 'warning' },
  approved: { label: 'Onaylandı', variant: 'success' },
  rejected: { label: 'Reddedildi', variant: 'error' },
};

export default function AttemptRequestsPage() {
  const [filter, setFilter] = useState<Filter>('pending');
  const [page, setPage] = useState(1);
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<{
    items: AttemptRequest[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>(`/api/admin/attempt-requests?status=${filter}&page=${page}&limit=${PAGE_LIMIT}`);

  // Filtre/sayfa değişiminde tam-sayfa loader flash'ı yerine önceki listeyi koru + ince üst bar.
  const lastDataRef = useRef<typeof data>(null);
  if (data) lastDataRef.current = data;
  const shownData = data ?? lastDataRef.current;

  // Filtre degistiginde 1. sayfaya don
  useEffect(() => { setPage(1); }, [filter]);

  const [reviewing, setReviewing] = useState<{
    req: AttemptRequest;
    mode: 'approve' | 'reject';
  } | null>(null);
  const [grantedAttempts, setGrantedAttempts] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submitReview = async () => {
    if (!reviewing) return;
    if (reviewing.mode === 'reject' && note.trim().length < 3) {
      toast('Red gerekçesi en az 3 karakter olmalı', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload =
        reviewing.mode === 'approve'
          ? { action: 'approve', grantedAttempts, note: note.trim() || undefined }
          : { action: 'reject', note: note.trim() };
      const res = await fetch(`/api/admin/attempt-requests/${reviewing.req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'İşlem başarısız');
      toast(reviewing.mode === 'approve' ? 'Talep onaylandı' : 'Talep reddedildi', 'success');
      setReviewing(null);
      setNote('');
      setGrantedAttempts(1);
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // İlk yüklemede (henüz hiç veri yok) tam-sayfa loader; sonraki yüklemelerde liste korunur.
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
          <h1 style={{
            margin: 0, fontSize: 26, fontWeight: 700, color: K.TEXT_PRIMARY,
            letterSpacing: '-0.02em',
          }}>
            Ek Sınav Hakkı Talepleri
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: K.TEXT_MUTED }}>
            Personel tarafından gönderilen ek deneme hakkı taleplerini değerlendirin.
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {([
          { id: 'pending', label: 'Bekleyen' },
          { id: 'approved', label: 'Onaylanan' },
          { id: 'rejected', label: 'Reddedilen' },
          { id: 'all', label: 'Tümü' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              padding: '8px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600,
              cursor: 'pointer',
              background: filter === tab.id ? K.PRIMARY : K.SURFACE,
              color: filter === tab.id ? '#fff' : K.TEXT_SECONDARY,
              border: `1px solid ${filter === tab.id ? K.PRIMARY : K.BORDER}`,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Yenileniyor — tam-sayfa loader yerine ince üst çubuk (bağlam korunur) */}
      <div aria-hidden style={{ height: 2, borderRadius: 999, background: refreshing ? K.PRIMARY : 'transparent', opacity: refreshing ? 0.6 : 0 }} className={refreshing ? 'animate-pulse' : undefined} />

      {error && (
        <div style={{
          padding: 14, borderRadius: 12, background: K.ERROR_BG, color: '#7a1d14',
          border: `1px solid ${K.ERROR}`, fontSize: 13,
        }}>
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
          <p style={{ margin: 0, fontSize: 14 }}>
            {filter === 'pending' ? 'Bekleyen talep yok' : 'Kayıt yok'}
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map((r) => {
            return (
              <li
                key={r.id}
                style={{
                  padding: 18, background: K.SURFACE, borderRadius: 14,
                  border: `1.5px solid ${K.BORDER_LIGHT}`, boxShadow: K.SHADOW_CARD,
                  display: 'flex', flexDirection: 'column', gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: K.TEXT_MUTED }}>
                      <User className="h-3 w-3" />
                      <Link
                        href={`/admin/staff/${r.userId}`}
                        className="hover:underline"
                        style={{ fontWeight: 600, color: K.TEXT_SECONDARY, textDecoration: 'none' }}
                      >
                        {r.user.firstName} {r.user.lastName}
                      </Link>
                      <span>·</span>
                      <span>{r.user.email}</span>
                      {r.user.departmentRel?.name && (
                        <>
                          <span>·</span>
                          <span>{r.user.departmentRel.name}</span>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: K.TEXT_PRIMARY }}>
                      <GraduationCap className="h-4 w-4" style={{ color: K.PRIMARY }} />
                      {r.training.title}
                    </div>
                    {r.assignment && (() => {
                      const a = ASSIGNMENT_STATUS[r.assignment.status] ?? {
                        label: r.assignment.status, variant: 'neutral' as StatusChipVariant,
                      };
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 11, color: K.TEXT_MUTED }}>
                          <span>Mevcut: {r.assignment.currentAttempt}/{r.assignment.maxAttempts} deneme</span>
                          <StatusChip variant={a.variant} label={a.label} size="sm" />
                        </div>
                      );
                    })()}
                  </div>

                  <StatusChip
                    variant={REQUEST_STATUS[r.status].variant}
                    label={REQUEST_STATUS[r.status].label}
                    size="sm"
                  />
                </div>

                {r.reason && (
                  <div style={{
                    padding: '10px 12px', background: K.BG, borderRadius: 8,
                    border: `1px solid ${K.BORDER_LIGHT}`, fontSize: 13, color: K.TEXT_SECONDARY,
                    lineHeight: 1.5,
                  }}>
                    <strong style={{ display: 'block', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: K.TEXT_MUTED, marginBottom: 4 }}>
                      Personelin gerekçesi
                    </strong>
                    {r.reason}
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: K.TEXT_MUTED }}>
                  <Clock className="h-3 w-3" />
                  Talep: {new Date(r.createdAt).toLocaleString('tr-TR')}
                  {r.reviewedAt && r.reviewedBy && (
                    <>
                      <span>·</span>
                      <span>
                        {r.status === 'approved' ? 'Onaylayan' : 'Reddeden'}: {r.reviewedBy.firstName} {r.reviewedBy.lastName} ({new Date(r.reviewedAt).toLocaleDateString('tr-TR')})
                      </span>
                    </>
                  )}
                </div>

                {r.status !== 'pending' && r.reviewNote && (
                  <div style={{
                    fontSize: 12, color: K.TEXT_SECONDARY,
                    padding: '8px 10px', background: K.BG, borderRadius: 6,
                  }}>
                    <strong>Yönetici notu:</strong> {r.reviewNote}
                  </div>
                )}

                {r.status === 'approved' && r.grantedAttempts != null && (
                  <div style={{ fontSize: 12, color: K.SUCCESS, fontWeight: 600 }}>
                    Verilen ek hak: {r.grantedAttempts}
                  </div>
                )}

                {r.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setReviewing({ req: r, mode: 'reject' });
                        setNote('');
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 999,
                        background: K.SURFACE, color: '#b91c1c',
                        border: `1px solid ${K.ERROR}`, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reddet
                    </button>
                    <button
                      onClick={() => {
                        setReviewing({ req: r, mode: 'approve' });
                        setGrantedAttempts(1);
                        setNote('');
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 999,
                        background: K.PRIMARY, color: '#fff',
                        border: `1px solid ${K.PRIMARY}`, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Onayla
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Sayfalama */}
      {!error && (shownData?.totalPages ?? 0) > 1 && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 16, paddingTop: 12, borderTop: `1px solid ${K.BORDER_LIGHT}`,
        }}>
          <span style={{ fontSize: 13, color: K.TEXT_MUTED }}>
            {(page - 1) * PAGE_LIMIT + 1}–{Math.min(page * PAGE_LIMIT, shownData?.total ?? 0)} / {shownData?.total ?? 0}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{
                padding: '6px 14px', fontSize: 13, borderRadius: 8,
                border: `1px solid ${K.BORDER}`, background: K.SURFACE,
                color: page === 1 ? K.TEXT_MUTED : K.TEXT_PRIMARY,
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                transition: 'background-color 160ms ease, border-color 160ms ease',
              }}
            >
              ← Önceki
            </button>
            <span style={{ fontSize: 13, color: K.TEXT_MUTED, alignSelf: 'center', padding: '0 6px' }}>
              {page} / {shownData?.totalPages ?? 1}
            </span>
            <button
              type="button"
              disabled={page >= (shownData?.totalPages ?? 1)}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '6px 14px', fontSize: 13, borderRadius: 8,
                border: `1px solid ${K.BORDER}`, background: K.SURFACE,
                color: page >= (shownData?.totalPages ?? 1) ? K.TEXT_MUTED : K.TEXT_PRIMARY,
                cursor: page >= (shownData?.totalPages ?? 1) ? 'not-allowed' : 'pointer',
                transition: 'background-color 160ms ease, border-color 160ms ease',
              }}
            >
              Sonraki →
            </button>
          </div>
        </div>
      )}

      {/* Review modal — PremiumModal: focus-trap + Escape + focus restore + aria-modal hazır gelir */}
      {reviewing && (
        <PremiumModal
          isOpen={!!reviewing}
          onClose={() => !submitting && setReviewing(null)}
          eyebrow="Ek Hak Talebi"
          title={reviewing.mode === 'approve' ? 'Talebi onayla' : 'Talebi reddet'}
          subtitle={`${reviewing.req.user.firstName} ${reviewing.req.user.lastName} · ${reviewing.req.training.title}`}
          size="md"
          disableEscape={submitting}
          footer={
            <PremiumModalFooter
              actions={
                <>
                  <PremiumButton variant="ghost" onClick={() => setReviewing(null)} disabled={submitting}>
                    Vazgeç
                  </PremiumButton>
                  <PremiumButton
                    onClick={submitReview}
                    loading={submitting}
                    disabled={reviewing.mode === 'reject' && note.trim().length < 3}
                    icon={reviewing.mode === 'approve' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                  >
                    {reviewing.mode === 'approve' ? `${grantedAttempts} hak ver` : 'Reddet'}
                  </PremiumButton>
                </>
              }
            />
          }
        >
            {reviewing.mode === 'approve' && (
              <div>
                <label htmlFor="granted-attempts" style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.TEXT_MUTED, marginBottom: 8 }}>
                  Verilecek ek deneme sayısı
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    type="button"
                    aria-label="Azalt"
                    onClick={() => setGrantedAttempts((c) => Math.max(1, c - 1))}
                    disabled={submitting || grantedAttempts <= 1}
                    style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${K.BORDER}`, background: K.SURFACE, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: K.TEXT_SECONDARY, opacity: grantedAttempts <= 1 ? 0.4 : 1 }}
                  >−</button>
                  <input
                    id="granted-attempts"
                    type="number"
                    min={1}
                    max={10}
                    value={grantedAttempts}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v)) setGrantedAttempts(Math.min(Math.max(v, 1), 10));
                    }}
                    style={{ flex: 1, height: 38, textAlign: 'center', borderRadius: 10, border: `1px solid ${K.BORDER}`, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY }}
                  />
                  <button
                    type="button"
                    aria-label="Artır"
                    onClick={() => setGrantedAttempts((c) => Math.min(10, c + 1))}
                    disabled={submitting || grantedAttempts >= 10}
                    style={{ width: 38, height: 38, borderRadius: 10, border: `1px solid ${K.BORDER}`, background: K.SURFACE, fontSize: 18, fontWeight: 700, cursor: 'pointer', color: K.TEXT_SECONDARY, opacity: grantedAttempts >= 10 ? 0.4 : 1 }}
                  >+</button>
                </div>
              </div>
            )}

            <div style={{ marginTop: reviewing.mode === 'approve' ? 18 : 0 }}>
              <label htmlFor="review-note" style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: K.TEXT_MUTED, marginBottom: 8 }}>
                {reviewing.mode === 'approve' ? 'Not (opsiyonel)' : 'Red gerekçesi (zorunlu)'}
              </label>
              <textarea
                id="review-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={reviewing.mode === 'approve' ? 'Personele iletilecek not...' : 'Neden reddediyorsun?'}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${K.BORDER}`, fontSize: 13, fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
              <p style={{ marginTop: 6, fontSize: 10, color: K.TEXT_MUTED }}>{note.length}/500</p>
            </div>

        </PremiumModal>
      )}
    </div>
  );
}
