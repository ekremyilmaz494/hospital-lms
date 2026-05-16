'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import {
  Calendar, UserX, Check, X, Download, FileText, Search,
  ChevronLeft, ChevronRight, ArrowLeft, FolderOpen, Inbox, MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';
import { useFeedbackPdf } from './_hooks/use-feedback-pdf';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface ResponseItem {
  id: string;
  submittedAt: string;
  isPassed: boolean;
  trainingId: string;
  trainingTitle: string;
  participant: { id: string; name: string; departmentName: string | null } | null;
  overallScore: number | null;
}

interface Data { items: ResponseItem[]; total: number; page: number; limit: number; }

interface TrainingSummary {
  trainingId: string;
  trainingTitle: string;
  category: string | null;
  responseCount: number;
  passedCount: number;
  failedCount: number;
  lastResponseAt: string | null;
}

interface TrainingSummaryData { items: TrainingSummary[]; total: number; }

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[12px]" style={{ color: K.TEXT_MUTED }}>—</span>;
  const col = score >= 4 ? K.SUCCESS : score >= 3 ? K.PRIMARY : score >= 2 ? K.WARNING : K.ERROR;
  const bg = score >= 4 ? K.SUCCESS_BG : score >= 3 ? K.PRIMARY_LIGHT : score >= 2 ? K.WARNING_BG : K.ERROR_BG;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tabular-nums"
      style={{ background: bg, color: col }}>
      {score.toFixed(2)}<span className="text-[10px] font-normal opacity-60">/ 5</span>
    </span>
  );
}

function TrainingCard({ t, onClick }: { t: TrainingSummary; onClick: () => void }) {
  const passRate = t.responseCount > 0 ? (t.passedCount / t.responseCount) * 100 : 0;
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl group"
      style={{
        background: K.SURFACE,
        border: `1.5px solid ${K.BORDER}`,
        boxShadow: K.SHADOW_CARD,
        transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(15,23,42,0.08), 0 16px 32px rgba(15,23,42,0.06)';
        e.currentTarget.style.borderColor = K.PRIMARY;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = K.SHADOW_CARD;
        e.currentTarget.style.borderColor = K.BORDER;
      }}
    >
      <div className="p-5 flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}>
          <MessageSquare className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold truncate" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }} title={t.trainingTitle}>
                {t.trainingTitle}
              </h3>
              {t.category && (
                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider"
                  style={{ background: K.BG, color: K.TEXT_MUTED, border: `1px solid ${K.BORDER_LIGHT}` }}>
                  {t.category}
                </span>
              )}
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold tabular-nums shrink-0"
              style={{ background: K.PRIMARY, color: '#fff' }}
              title="Toplam yanıt sayısı"
            >
              <Inbox className="w-3 h-3" />
              {t.responseCount} yanıt
            </span>
          </div>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold"
              style={{ color: K.SUCCESS }}>
              <Check className="w-3.5 h-3.5" />
              <span>{t.passedCount} geçti</span>
            </div>
            <div className="flex items-center gap-1.5 text-[12px] font-semibold"
              style={{ color: t.failedCount > 0 ? K.ERROR : K.TEXT_MUTED }}>
              <X className="w-3.5 h-3.5" />
              <span>{t.failedCount} kaldı</span>
            </div>
            <div className="ml-auto text-[11px]" style={{ color: K.TEXT_MUTED }}>
              {t.lastResponseAt
                ? <>Son: {new Date(t.lastResponseAt).toLocaleDateString('tr-TR')}</>
                : 'Tarih yok'}
            </div>
          </div>

          {/* Mini pass/fail bar */}
          <div className="mt-3 h-1.5 w-full rounded-full overflow-hidden flex"
            style={{ background: K.BORDER_LIGHT }}>
            <div style={{ width: `${passRate}%`, background: K.SUCCESS, transition: 'width 300ms ease' }} />
            <div style={{ width: `${100 - passRate}%`, background: K.ERROR, transition: 'width 300ms ease' }} />
          </div>
        </div>
      </div>
    </button>
  );
}

function FeedbackResponsesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const selectedTrainingId = searchParams.get('trainingId') || '';

  // Eğitim özet listesi state'i
  const [summary, setSummary] = useState<TrainingSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [trainingSearch, setTrainingSearch] = useState('');

  // Yanıt listesi state'i (sadece bir eğitim seçildiğinde dolar)
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [passedFilter, setPassedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [exporting, setExporting] = useState(false);

  // Tek yanıt PDF indirme — satır başına buton tetikler.
  // Toplu ZIP — drill-down sayfasında "Tüm yanıtlar ZIP" butonu tetikler.
  const {
    downloadResponsePdf,
    isPending: isPdfPending,
    downloadAllForTraining,
    isBulkPending,
  } = useFeedbackPdf();

  // URL'den eğitim değişirse: pagination ve filtreleri sıfırla
  useEffect(() => {
    setPage(1);
    setPassedFilter('all');
  }, [selectedTrainingId]);

  // Eğitim özet listesini çek (her zaman yüklenir; drill-down sonrası geri dönüşte de hazır)
  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    fetch('/api/admin/feedback/responses/by-training')
      .then(r => r.json())
      .then(d => { if (!cancelled) { setSummary(d); setSummaryLoading(false); } })
      .catch(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Yanıt listesini sadece bir eğitim seçildiğinde çek
  useEffect(() => {
    if (!selectedTrainingId) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20', trainingId: selectedTrainingId });
    if (passedFilter !== 'all') params.set('isPassed', passedFilter);
    fetch(`/api/admin/feedback/responses?${params}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, passedFilter, selectedTrainingId]);

  const selectTraining = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('trainingId', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearTraining = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('trainingId');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const runExport = async (format: 'xlsx' | 'pdf') => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (selectedTrainingId) params.set('trainingId', selectedTrainingId);
      if (passedFilter !== 'all') params.set('isPassed', passedFilter);

      const res = await fetch(`/api/admin/feedback/responses/export?${params}`);
      if (!res.ok) {
        const msg = res.status === 429
          ? 'Çok fazla dışa aktarma isteği. Lütfen biraz bekleyin.'
          : 'Dışa aktarma başarısız oldu.';
        toast(msg, 'error');
        return;
      }

      const blob = await res.blob();
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `geri-bildirim.${format === 'pdf' ? 'pdf' : 'xlsx'}`;

      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(urlObj);

      toast(format === 'pdf' ? 'PDF indirildi' : 'Excel indirildi', 'success');
    } catch {
      toast('Dışa aktarma başarısız oldu.', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Aktif eğitim meta (drill-down view'da başlık için)
  const activeTraining = useMemo(() => {
    if (!selectedTrainingId || !summary) return null;
    return summary.items.find(t => t.trainingId === selectedTrainingId) ?? null;
  }, [selectedTrainingId, summary]);

  const filteredSummaryItems = useMemo(() => {
    if (!summary) return [];
    const q = trainingSearch.trim().toLowerCase();
    if (!q) return summary.items;
    return summary.items.filter(t =>
      t.trainingTitle.toLowerCase().includes(q) ||
      (t.category?.toLowerCase().includes(q) ?? false),
    );
  }, [summary, trainingSearch]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;
  const isGroupedView = !selectedTrainingId;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {isGroupedView ? (
        <PageHeader
          title="Geri Bildirim Yanıtları"
          subtitle="Eğitim seçin — o eğitime ait personel yanıtlarını görmek için karta tıklayın"
        />
      ) : (
        <div className="space-y-3">
          <button
            onClick={clearTraining}
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold rounded-lg px-2.5 py-1.5"
            style={{ color: K.TEXT_SECONDARY, background: K.SURFACE, border: `1px solid ${K.BORDER}` }}
            onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE; }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Tüm eğitimlere dön
          </button>
          <PageHeader
            title={activeTraining?.trainingTitle ?? 'Eğitim yanıtları'}
            subtitle={
              activeTraining
                ? `${activeTraining.responseCount} yanıt · ${activeTraining.passedCount} geçti · ${activeTraining.failedCount} kaldı`
                : 'Bu eğitime ait personel yanıtları'
            }
          />
        </div>
      )}

      {isGroupedView ? (
        <>
          {/* Eğitim arama */}
          <div className="px-5 py-4"
            style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: K.TEXT_MUTED }} />
              <Input
                placeholder="Eğitim adı veya kategori ara..."
                value={trainingSearch}
                onChange={(e) => setTrainingSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Eğitim kartları */}
          {summaryLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: K.BORDER_LIGHT, borderTopColor: K.PRIMARY }} />
            </div>
          ) : filteredSummaryItems.length === 0 ? (
            <div
              className="py-20 text-center rounded-2xl"
              style={{ background: K.SURFACE, border: `1.5px dashed ${K.BORDER}` }}
            >
              <FolderOpen className="w-10 h-10 mx-auto mb-3" style={{ color: K.TEXT_MUTED, opacity: 0.6 }} />
              <p className="text-[14px] font-semibold mb-1" style={{ color: K.TEXT_PRIMARY }}>
                {trainingSearch ? 'Aramayla eşleşen eğitim yok' : 'Henüz geri bildirim yanıtı yok'}
              </p>
              <p className="text-[12px]" style={{ color: K.TEXT_MUTED }}>
                {trainingSearch
                  ? 'Farklı bir terim deneyin veya aramayı temizleyin.'
                  : 'Personel bir eğitim tamamlayıp anket doldurduğunda buradan görünecek.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSummaryItems.map((t, i) => (
                <div
                  key={t.trainingId}
                  style={{
                    opacity: 0,
                    animation: `fadeInUp 320ms ease ${i * 40}ms forwards`,
                  }}
                >
                  <TrainingCard t={t} onClick={() => selectTraining(t.trainingId)} />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Drill-down: filtreler + tablo */}
          <div className="px-5 py-4 flex flex-wrap gap-3 items-center"
            style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
            {/* Segment control */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}>
              {(['all', 'true', 'false'] as const).map(v => (
                <button key={v} onClick={() => { setPassedFilter(v); setPage(1); }}
                  className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold"
                  style={{
                    background: passedFilter === v
                      ? v === 'true' ? K.SUCCESS_BG : v === 'false' ? K.ERROR_BG : K.SURFACE
                      : 'transparent',
                    color: passedFilter === v
                      ? v === 'true' ? K.SUCCESS : v === 'false' ? K.ERROR : K.TEXT_PRIMARY
                      : K.TEXT_MUTED,
                    boxShadow: passedFilter === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}>
                  {v === 'all' ? 'Tümü' : v === 'true' ? 'Geçti' : 'Kaldı'}
                </button>
              ))}
            </div>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm" onClick={() => runExport('xlsx')}
                disabled={exporting || !data || data.total === 0}
                className="gap-1.5"
                style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}>
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={() => runExport('pdf')}
                disabled={exporting || !data || data.total === 0}
                className="gap-1.5"
                style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}>
                <FileText className="w-3.5 h-3.5" /> PDF (özet)
              </Button>
              {/* Tüm yanıtlar ZIP — her yanıt için ayrı resmi PDF formatı tek arşivde */}
              <Button size="sm"
                onClick={() => {
                  if (!selectedTrainingId || !activeTraining) return;
                  void downloadAllForTraining(selectedTrainingId, activeTraining.trainingTitle);
                }}
                disabled={
                  !selectedTrainingId
                  || !data
                  || data.total === 0
                  || isBulkPending(selectedTrainingId)
                }
                className="gap-1.5"
                style={{ background: K.PRIMARY, color: '#fff', boxShadow: '0 1px 3px rgba(13,150,104,0.3)' }}
                title="Bu eğitime ait tüm yanıtların PDF'lerini tek ZIP olarak indir"
              >
                {isBulkPending(selectedTrainingId) ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                      style={{ borderColor: '#fff', borderTopColor: 'transparent' }} />
                    Hazırlanıyor...
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" /> Tümü ZIP
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: K.BORDER_LIGHT, borderTopColor: K.PRIMARY }} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                      {['Tarih', 'Katılımcı', 'Departman', 'Durum', 'Puan', ''].map(h => (
                        <th key={h} className="px-5 py-3.5 text-left text-[11px] uppercase tracking-wider font-semibold"
                          style={{ color: K.TEXT_MUTED, background: K.BG }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.items ?? []).map((r, i) => (
                      <tr key={r.id} className="group"
                        style={{
                          borderBottom: `1px solid ${K.BORDER_LIGHT}`,
                          opacity: 0,
                          animation: `fadeIn 300ms ease ${i * 25}ms forwards`,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = K.SURFACE_HOVER)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-[12px]" style={{ color: K.TEXT_MUTED }}>
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            {new Date(r.submittedAt).toLocaleDateString('tr-TR')}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {r.participant ? (
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                style={{ background: K.PRIMARY }}>
                                {r.participant.name.charAt(0)}
                              </div>
                              <span className="text-[13px] font-medium" style={{ color: K.TEXT_PRIMARY }}>{r.participant.name}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2" style={{ color: K.TEXT_MUTED }}>
                              <UserX className="w-4 h-4" />
                              <span className="text-[13px]">Anonim</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[13px]" style={{ color: K.TEXT_MUTED }}>
                          {r.participant?.departmentName ?? '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          {r.isPassed ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                              style={{ background: K.SUCCESS_BG, color: K.SUCCESS }}>
                              <Check className="w-3 h-3" /> Geçti
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                              style={{ background: K.ERROR_BG, color: K.ERROR }}>
                              <X className="w-3 h-3" /> Kaldı
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5"><ScorePill score={r.overallScore} /></td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* PDF indir — hover'da görünür, indirme sırasında loading */}
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); void downloadResponsePdf(r.id); }}
                              disabled={isPdfPending(r.id)}
                              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-wait"
                              style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY, transition: 'opacity 150ms' }}
                              title="PDF olarak indir"
                            >
                              {isPdfPending(r.id) ? (
                                <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin"
                                  style={{ borderColor: K.PRIMARY, borderTopColor: 'transparent' }} />
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <Link href={`/admin/feedback-forms/responses/${r.id}`}>
                              <button className="px-3 py-1.5 rounded-lg text-[12px] font-semibold opacity-0 group-hover:opacity-100"
                                style={{ background: K.PRIMARY, color: '#fff', transition: 'opacity 150ms' }}>
                                Detay
                              </button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(data?.items ?? []).length === 0 && !loading && (
                      <tr><td colSpan={6} className="px-5 py-16 text-center" style={{ color: K.TEXT_MUTED }}>
                        Bu eğitim için eşleşen yanıt bulunamadı
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {data && data.total > data.limit && (
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: `1px solid ${K.BORDER_LIGHT}` }}>
                <p className="text-[12px]" style={{ color: K.TEXT_MUTED }}>
                  <span className="font-bold" style={{ color: K.TEXT_PRIMARY }}>{data.total}</span> yanıt · Sayfa {page} / {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30"
                    style={{ background: K.SURFACE, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}` }}>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    if (p > totalPages) return null;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-bold"
                        style={{
                          background: p === page ? K.PRIMARY : K.SURFACE,
                          color: p === page ? 'white' : K.TEXT_SECONDARY,
                          border: p === page ? 'none' : `1px solid ${K.BORDER}`,
                        }}>
                        {p}
                      </button>
                    );
                  })}
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30"
                    style={{ background: K.SURFACE, color: K.TEXT_SECONDARY, border: `1px solid ${K.BORDER}` }}>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default function FeedbackResponsesPage() {
  return <Suspense fallback={<PageLoading />}><FeedbackResponsesContent /></Suspense>;
}
