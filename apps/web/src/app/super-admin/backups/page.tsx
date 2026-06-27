'use client';

import { useState } from 'react';
import { Database, Loader2, RotateCcw, ShieldAlert, CheckCircle2, X } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', BG: '#fafaf9', BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface BackupRow {
  id: string;
  organizationId: string | null;
  organizationName: string;
  backupType: string;
  status: string;
  verified: boolean;
  fileSizeMb: number | null;
  createdAt: string;
}

interface Preview {
  organizationName?: string;
  fileSizeMb?: number | null;
  counts: Record<string, number>;
  exportedAt?: string;
}

const COUNT_LABELS: Record<string, string> = {
  users: 'Personel', departments: 'Departman', trainings: 'Eğitim',
  assignments: 'Atama', attempts: 'Sınav Denemesi', examAnswers: 'Sınav Cevabı',
  videoProgress: 'Video İlerlemesi', notifications: 'Bildirim', certificates: 'Sertifika',
  auditLogs: 'Denetim Kaydı',
};

export default function SuperAdminBackupsPage() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useFetch<{ backups: BackupRow[] }>('/api/super-admin/backups');
  const [target, setTarget] = useState<BackupRow | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const startPreview = async (backup: BackupRow) => {
    setTarget(backup);
    setPreview(null);
    setPreviewing(true);
    try {
      const res = await fetch('/api/super-admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: backup.id, confirm: false }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error || 'Önizleme alınamadı', 'error');
        setTarget(null);
        return;
      }
      setPreview(body);
    } catch {
      toast('Bir hata oluştu', 'error');
      setTarget(null);
    } finally {
      setPreviewing(false);
    }
  };

  const confirmRestore = async () => {
    if (!target) return;
    setRestoring(true);
    try {
      const res = await fetch('/api/super-admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId: target.id, confirm: true }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error || 'Geri yükleme başarısız', 'error');
        return;
      }
      toast(`Geri yükleme tamamlandı: ${target.organizationName}`, 'success');
      setTarget(null);
      setPreview(null);
      refetch();
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const closeModal = () => {
    if (restoring) return;
    setTarget(null);
    setPreview(null);
  };

  if (isLoading) return <PageLoading />;
  const backups = data?.backups ?? [];

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
            <Database className="h-5 w-5" style={{ color: K.PRIMARY }} />
          </div>
          <h1 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 22, fontWeight: 700, color: K.TEXT_PRIMARY }}>
            Yedekler & Geri Yükleme
          </h1>
        </div>
        <p className="text-sm" style={{ color: K.TEXT_MUTED }}>
          Tüm kurumların yedekleri. Geri yükleme YIKICIDIR: hedef kurumun mevcut verisi silinip yedekteki veriyle değiştirilir.
        </p>
      </div>

      <div style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD, overflow: 'hidden' }}>
        {backups.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: K.TEXT_MUTED }}>Henüz yedek kaydı yok.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ background: K.BG }}>
                  {['Kurum', 'Tür', 'Tarih', 'Boyut', 'Durum', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} style={{ borderTop: `1px solid ${K.BORDER_LIGHT}` }}>
                    <td className="px-5 py-3 text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>{b.organizationName}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: K.TEXT_SECONDARY }}>{b.backupType}</td>
                    <td className="px-5 py-3 text-sm" style={{ color: K.TEXT_SECONDARY }}>
                      {new Date(b.createdAt).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-5 py-3 text-sm font-mono" style={{ color: K.TEXT_SECONDARY }}>{b.fileSizeMb != null ? `${b.fileSizeMb} MB` : '—'}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          background: b.verified && b.status === 'completed' ? K.SUCCESS_BG : K.WARNING_BG,
                          color: b.verified && b.status === 'completed' ? K.SUCCESS : K.WARNING,
                        }}>
                        {b.status === 'completed' ? (b.verified ? 'Doğrulandı' : 'Tamamlandı') : b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => startPreview(b)}
                        disabled={b.status !== 'completed' || (previewing && target?.id === b.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                        style={{
                          background: K.SURFACE,
                          border: `1px solid ${K.PRIMARY}`,
                          color: K.PRIMARY,
                          opacity: b.status !== 'completed' ? 0.4 : 1,
                          cursor: b.status !== 'completed' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {previewing && target?.id === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        Geri Yükle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Önizleme + onay modalı */}
      {target && preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={closeModal}>
          <div className="w-full max-w-lg p-6" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-3">
              <h3 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: K.TEXT_PRIMARY }}>
                Geri Yükleme Onayı
              </h3>
              <button onClick={closeModal} style={{ color: K.TEXT_MUTED }}><X className="h-5 w-5" /></button>
            </div>

            <div className="rounded-xl p-3 mb-4 flex gap-2.5" style={{ background: K.ERROR_BG, border: `1px solid ${K.ERROR}` }}>
              <ShieldAlert className="h-5 w-5 flex-shrink-0" style={{ color: K.ERROR }} />
              <p className="text-sm" style={{ color: K.TEXT_PRIMARY }}>
                <strong>{preview.organizationName ?? target.organizationName}</strong> kurumunun MEVCUT verisi
                tamamen silinip bu yedekle değiştirilecek. Bu işlem GERİ ALINAMAZ.
              </p>
            </div>

            <div className="rounded-xl p-4 mb-5" style={{ background: K.BG }}>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: K.TEXT_MUTED }}>Yedek İçeriği</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {Object.entries(preview.counts ?? {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-sm">
                    <span style={{ color: K.TEXT_SECONDARY }}>{COUNT_LABELS[k] ?? k}</span>
                    <span className="font-mono font-semibold" style={{ color: K.TEXT_PRIMARY }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={closeModal} disabled={restoring}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: K.SURFACE, border: `1px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}>
                Vazgeç
              </button>
              <button onClick={confirmRestore} disabled={restoring}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white inline-flex items-center gap-2"
                style={{ background: K.ERROR, cursor: restoring ? 'not-allowed' : 'pointer' }}>
                {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Onayla ve Geri Yükle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
