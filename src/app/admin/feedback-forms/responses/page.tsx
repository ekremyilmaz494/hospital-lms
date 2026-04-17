'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Calendar, UserX, Check, X, Download, FileText, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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

function ScorePill({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>—</span>;
  const col = score >= 4 ? 'var(--color-success)' : score >= 3 ? 'var(--brand-600)' : score >= 2 ? '#f59e0b' : 'var(--color-error)';
  const bg = score >= 4 ? 'var(--color-success-bg)' : score >= 3 ? 'var(--brand-100)10' : score >= 2 ? '#fef3c710' : 'var(--color-error-bg)';
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[12px] font-bold tabular-nums"
      style={{ background: bg, color: col, border: `1px solid ${col}30` }}>
      {score.toFixed(2)}<span className="text-[10px] font-normal opacity-60">/ 5</span>
    </span>
  );
}

function FeedbackResponsesContent() {
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [trainingFilter, setTrainingFilter] = useState(searchParams.get('trainingId') ?? '');
  const [passedFilter, setPassedFilter] = useState<'all' | 'true' | 'false'>('all');
  const [exporting, setExporting] = useState(false);

  const runExport = async (format: 'xlsx' | 'pdf') => {
    setExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (trainingFilter) params.set('trainingId', trainingFilter);
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (trainingFilter) params.set('trainingId', trainingFilter);
    if (passedFilter !== 'all') params.set('isPassed', passedFilter);
    fetch(`/api/admin/feedback/responses?${params}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, trainingFilter, passedFilter]);

  const totalPages = data ? Math.ceil(data.total / data.limit) : 1;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Geri Bildirim Yanıtları"
        subtitle="Personelin eğitim sonrası doldurduğu EY.FR.40 anket yanıtları"
      />

      {/* Filters */}
      <div className="rounded-2xl px-5 py-4 flex flex-wrap gap-3 items-center"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--color-text-muted)' }} />
          <Input placeholder="Eğitim ID ile filtrele" value={trainingFilter}
            onChange={e => { setTrainingFilter(e.target.value); setPage(1); }}
            className="pl-9" />
        </div>

        {/* Segment control */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          {(['all', 'true', 'false'] as const).map(v => (
            <button key={v} onClick={() => { setPassedFilter(v); setPage(1); }}
              className="px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{
                background: passedFilter === v
                  ? v === 'true' ? 'var(--color-success-bg)' : v === 'false' ? 'var(--color-error-bg)' : 'var(--color-surface)'
                  : 'transparent',
                color: passedFilter === v
                  ? v === 'true' ? 'var(--color-success)' : v === 'false' ? 'var(--color-error)' : 'var(--color-text)'
                  : 'var(--color-text-muted)',
                boxShadow: passedFilter === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}>
              {v === 'all' ? 'Tümü' : v === 'true' ? 'Geçti' : 'Kaldı'}
            </button>
          ))}
        </div>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={() => runExport('xlsx')}
            disabled={exporting || !data || data.total === 0}
            className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => runExport('pdf')}
            disabled={exporting || !data || data.total === 0}
            className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> PDF
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Tarih', 'Eğitim', 'Katılımcı', 'Departman', 'Durum', 'Puan', ''].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left text-[10px] uppercase tracking-[2px] font-bold"
                      style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((r, i) => (
                  <tr key={r.id} className="group"
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      opacity: 0,
                      animation: `fadeIn 300ms ease ${i * 25}ms forwards`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        {new Date(r.submittedAt).toLocaleDateString('tr-TR')}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 max-w-[260px]">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--color-text)' }} title={r.trainingTitle}>{r.trainingTitle}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      {r.participant ? (
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                            style={{ background: 'var(--color-primary)' }}>
                            {r.participant.name.charAt(0)}
                          </div>
                          <span className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{r.participant.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2" style={{ color: 'var(--color-text-muted)' }}>
                          <UserX className="w-4 h-4" />
                          <span className="text-[13px]">Anonim</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                      {r.participant?.departmentName ?? '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {r.isPassed ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                          style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success)30' }}>
                          <Check className="w-3 h-3" /> Geçti
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                          style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error)30' }}>
                          <X className="w-3 h-3" /> Kaldı
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5"><ScorePill score={r.overallScore} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <Link href={`/admin/feedback-forms/responses/${r.id}`}>
                        <button className="px-3 py-1.5 rounded-lg text-[12px] font-semibold opacity-0 group-hover:opacity-100"
                          style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)', border: '1px solid var(--color-primary)30', transition: 'opacity 150ms' }}>
                          Detay
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
                {(data?.items ?? []).length === 0 && !loading && (
                  <tr><td colSpan={7} className="px-5 py-16 text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Eşleşen yanıt bulunamadı
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > data.limit && (
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--color-border)' }}>
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              <span className="font-bold" style={{ color: 'var(--color-text)' }}>{data.total}</span> yanıt · Sayfa {page} / {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                if (p > totalPages) return null;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[12px] font-bold"
                    style={{
                      background: p === page ? 'var(--color-primary)' : 'var(--color-bg)',
                      color: p === page ? 'white' : 'var(--color-text-muted)',
                      border: p === page ? 'none' : '1px solid var(--color-border)',
                    }}>
                    {p}
                  </button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-30"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

export default function FeedbackResponsesPage() {
  return <Suspense fallback={<PageLoading />}><FeedbackResponsesContent /></Suspense>;
}
