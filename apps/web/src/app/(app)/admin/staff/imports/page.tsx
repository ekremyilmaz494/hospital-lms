'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, Undo2, CheckCircle2, AlertCircle, Clock, ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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

interface Batch {
  id: string;
  createdAt: string;
  adminName: string;
  totalRows: number;
  created: number;
  failed: number;
  stillActive: number;
  canRollback: boolean;
}

interface BatchesResponse {
  batches: Batch[];
}

export default function ImportsHistoryPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data, isLoading, refetch } = useFetch<BatchesResponse>('/api/admin/bulk-import/batches');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  if (isLoading) return <PageLoading />;

  const batches = data?.batches ?? [];

  const handleRollback = async (batchId: string) => {
    setRollingBack(batchId);
    try {
      const res = await fetch('/api/admin/bulk-import/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Geri alma başarısız');

      const msg = result.failed > 0
        ? `${result.deleted} kişi silindi, ${result.failed} başarısız`
        : `${result.deleted} kişi başarıyla silindi`;
      toast(msg, result.failed > 0 ? 'info' : 'success');
      setConfirmId(null);
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Geri alma başarısız', 'error');
    } finally {
      setRollingBack(null);
    }
  };

  const confirmingBatch = confirmId ? batches.find(b => b.id === confirmId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/admin/staff')}
          className="rounded-lg p-2"
          style={{ color: K.TEXT_MUTED }}
          onMouseEnter={(e) => (e.currentTarget.style.background = K.SURFACE_HOVER)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          aria-label="Geri"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <PageHeader
            title="Yükleme Geçmişi"
            subtitle="Son 50 toplu yükleme kaydı — istersen geri alabilirsin"
          />
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="p-12 text-center" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
          <FileSpreadsheet className="mx-auto h-12 w-12 mb-3" style={{ color: K.TEXT_MUTED }} />
          <p className="font-medium" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 18 }}>Henüz yükleme yok</p>
          <p className="text-sm mt-1" style={{ color: K.TEXT_MUTED }}>
            Personel Yönetimi sayfasından Excel ile toplu personel yükleyebilirsin.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/staff')}>
            Personel Yönetimine Git
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: K.BG }}>
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tarih</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Yapan Kişi</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Toplam</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Eklenen</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Başarısız</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Hâlâ Aktif</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => {
                  const total = batch.created || 1;
                  const activePercent = Math.round((batch.stillActive / total) * 100);
                  return (
                    <tr key={batch.id} style={{ borderTop: `1px solid ${K.BORDER_LIGHT}` }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />
                          <div>
                            <div style={{ color: K.TEXT_PRIMARY, fontWeight: 500 }}>
                              {new Date(batch.createdAt).toLocaleDateString('tr-TR')}
                            </div>
                            <div className="text-xs" style={{ color: K.TEXT_MUTED }}>
                              {new Date(batch.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: K.TEXT_PRIMARY }}>{batch.adminName}</td>
                      <td className="px-4 py-3 text-center font-mono" style={{ color: K.TEXT_PRIMARY }}>{batch.totalRows}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 font-mono" style={{ color: K.SUCCESS }}>
                          <CheckCircle2 className="h-4 w-4" />
                          {batch.created}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {batch.failed > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono" style={{ color: K.ERROR }}>
                            <AlertCircle className="h-4 w-4" />
                            {batch.failed}
                          </span>
                        ) : (
                          <span className="font-mono" style={{ color: K.TEXT_MUTED }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 max-w-[80px] h-1.5 rounded-full overflow-hidden" style={{ background: K.BORDER_LIGHT }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${activePercent}%`, background: K.PRIMARY }}
                            />
                          </div>
                          <span className="font-mono text-xs" style={{ color: K.TEXT_PRIMARY }}>
                            {batch.stillActive}
                            {batch.stillActive < batch.created && (
                              <span style={{ color: K.TEXT_MUTED }}>
                                /{batch.created}
                              </span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {batch.canRollback ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setConfirmId(batch.id)}
                            disabled={rollingBack === batch.id}
                          >
                            {rollingBack === batch.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Undo2 className="h-4 w-4 mr-2" />
                            )}
                            Geri Al
                          </Button>
                        ) : (
                          <span className="text-xs" style={{ color: K.TEXT_MUTED }}>
                            {batch.stillActive === 0 ? 'Zaten silinmiş' : 'Geri alınamaz'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmingBatch && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setConfirmId(null)}
        >
          <div
            className="w-full max-w-md"
            style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0" style={{ background: K.ERROR_BG, color: K.ERROR }}>
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY }}>Yükleme geri alınsın mı?</h2>
                  <p className="text-sm mt-1" style={{ color: K.TEXT_MUTED }}>
                    Bu işlem <strong style={{ color: K.TEXT_PRIMARY }}>{confirmingBatch.stillActive} personeli</strong> sistemden kalıcı olarak silecek.
                    Geçmiş sınav/sertifika kayıtları da kaybolabilir.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-4 mb-4" style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}` }}>
                <div className="text-xs space-y-1" style={{ color: K.TEXT_MUTED }}>
                  <div>Tarih: <strong style={{ color: K.TEXT_PRIMARY }}>{new Date(confirmingBatch.createdAt).toLocaleString('tr-TR')}</strong></div>
                  <div>Yapan: <strong style={{ color: K.TEXT_PRIMARY }}>{confirmingBatch.adminName}</strong></div>
                  <div>Silinecek: <strong style={{ color: K.ERROR }}>{confirmingBatch.stillActive} kişi</strong></div>
                </div>
              </div>

              <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: K.WARNING_BG, color: K.WARNING, border: `1px solid ${K.WARNING}` }}>
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>Bu işlem geri alınamaz. Sınav/sertifika verisi varsa kaybolur.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 pt-0">
              <Button variant="outline" onClick={() => setConfirmId(null)}>
                Vazgeç
              </Button>
              <button
                onClick={() => handleRollback(confirmingBatch.id)}
                disabled={rollingBack === confirmingBatch.id}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: K.ERROR }}
              >
                {rollingBack === confirmingBatch.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Undo2 className="h-4 w-4" />
                )}
                Evet, Geri Al
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
