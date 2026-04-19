'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, Undo2, CheckCircle2, AlertCircle, Clock, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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
          className="rounded-lg p-2 hover:bg-(--color-surface-hover)"
          aria-label="Geri"
        >
          <ArrowLeft className="h-5 w-5" style={{ color: 'var(--color-text-muted)' }} />
        </button>
        <div className="flex-1">
          <PageHeader
            title="Yükleme Geçmişi"
            subtitle="Son 50 toplu yükleme kaydı — istersen geri alabilirsin"
          />
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <FileSpreadsheet className="mx-auto h-12 w-12 mb-3" style={{ color: 'var(--color-text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--color-text)' }}>Henüz yükleme yok</p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Personel Yönetimi sayfasından Excel ile toplu personel yükleyebilirsin.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/staff')}>
            Personel Yönetimine Git
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: 'var(--color-surface-muted)' }}>
                <tr>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ color: 'var(--color-text-muted)' }}>Yapan Kişi</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Toplam</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Eklenen</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Başarısız</th>
                  <th className="px-4 py-3 text-center font-medium" style={{ color: 'var(--color-text-muted)' }}>Hâlâ Aktif</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                        <div>
                          <div style={{ color: 'var(--color-text)' }}>
                            {new Date(batch.createdAt).toLocaleDateString('tr-TR')}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {new Date(batch.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>{batch.adminName}</td>
                    <td className="px-4 py-3 text-center font-mono" style={{ color: 'var(--color-text)' }}>{batch.totalRows}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 font-mono" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle2 className="h-4 w-4" />
                        {batch.created}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {batch.failed > 0 ? (
                        <span className="inline-flex items-center gap-1 font-mono" style={{ color: 'var(--color-error)' }}>
                          <AlertCircle className="h-4 w-4" />
                          {batch.failed}
                        </span>
                      ) : (
                        <span className="font-mono" style={{ color: 'var(--color-text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-mono" style={{ color: 'var(--color-text)' }}>
                      {batch.stillActive}
                      {batch.stillActive < batch.created && (
                        <span className="text-xs ml-1" style={{ color: 'var(--color-text-muted)' }}>
                          / {batch.created}
                        </span>
                      )}
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
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {batch.stillActive === 0 ? 'Zaten silinmiş' : 'Geri alınamaz'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
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
            className="w-full max-w-md rounded-2xl shadow-xl"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>Yükleme geri alınsın mı?</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Bu işlem <strong>{confirmingBatch.stillActive} personeli</strong> sistemden kalıcı olarak silecek.
                    Geçmiş sınav/sertifika kayıtları da kaybolabilir.
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--color-surface-muted)' }}>
                <div className="text-xs space-y-1" style={{ color: 'var(--color-text-muted)' }}>
                  <div>Tarih: <strong style={{ color: 'var(--color-text)' }}>{new Date(confirmingBatch.createdAt).toLocaleString('tr-TR')}</strong></div>
                  <div>Yapan: <strong style={{ color: 'var(--color-text)' }}>{confirmingBatch.adminName}</strong></div>
                  <div>Silinecek: <strong style={{ color: 'var(--color-error)' }}>{confirmingBatch.stillActive} kişi</strong></div>
                </div>
              </div>

              <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: 'var(--color-warning-bg, #fffbeb)', color: '#92400e' }}>
                ⚠️ Bu işlem geri alınamaz. Sınav/sertifika verisi varsa kaybolur.
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 pt-0">
              <Button variant="outline" onClick={() => setConfirmId(null)}>
                Vazgeç
              </Button>
              <button
                onClick={() => handleRollback(confirmingBatch.id)}
                disabled={rollingBack === confirmingBatch.id}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 h-10 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: '#dc2626' }}
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
