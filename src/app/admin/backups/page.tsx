'use client';

import { Download, Plus, Clock, HardDrive, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
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

interface Backup {
  id: string;
  type: string;
  date: string;
  size: string;
  status: string;
}

interface BackupsData {
  backups: Backup[];
  stats: { lastBackup: string; totalSize: string; nextAuto: string };
}

export default function BackupsPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<BackupsData>('/api/admin/backups');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: K.ERROR }}>{error}</div></div>;
  }

  const backups = data?.backups ?? [];
  const stats = data?.stats ?? { lastBackup: '-', totalSize: '-', nextAuto: '-' };

  const handleManualBackup = async () => {
    try {
      const res = await fetch('/api/admin/backups', { method: 'POST' });
      if (!res.ok) throw new Error('Yedekleme başarısız');
      toast('Manuel yedek alındı.', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Veritabanı Yedekleme"
        subtitle="Otomatik ve manuel yedeklerinizi yönetin"
        action={{ label: 'Manuel Yedek Al', icon: Plus, onClick: handleManualBackup }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BlurFade delay={0.05}><StatCard title="Son Yedek" value={stats.lastBackup} icon={CheckCircle} accentColor={K.SUCCESS} /></BlurFade>
        <BlurFade delay={0.1}><StatCard title="Toplam Boyut" value={stats.totalSize} icon={HardDrive} accentColor={K.INFO} /></BlurFade>
        <BlurFade delay={0.15}><StatCard title="Sonraki Otomatik" value={stats.nextAuto} icon={Clock} accentColor={K.ACCENT} /></BlurFade>
      </div>

      <BlurFade delay={0.2}>
        <div className="overflow-hidden" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
          {backups.length > 0 ? (
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: K.BG }}>
                  <th className="w-[30%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tarih</th>
                  <th className="w-[15%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Tür</th>
                  <th className="w-[15%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Boyut</th>
                  <th className="w-[20%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Durum</th>
                  <th className="w-[20%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="clickable-row" style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                    <td className="px-5 py-4 font-mono font-medium" style={{ color: K.TEXT_PRIMARY }}>{b.date}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: b.type === 'auto' ? K.INFO_BG : K.PRIMARY_LIGHT, color: b.type === 'auto' ? K.INFO : K.PRIMARY }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.type === 'auto' ? K.INFO : K.PRIMARY }} />
                        {b.type === 'auto' ? 'Otomatik' : 'Manuel'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm" style={{ color: K.TEXT_SECONDARY }}>{b.size}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: K.SUCCESS_BG, color: K.SUCCESS }}>
                        <CheckCircle className="h-3.5 w-3.5" /> Tamamlandı
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg" style={{ color: K.PRIMARY }} onClick={async () => {
                        toast(`${b.date} tarihli yedek indiriliyor...`, 'info');
                        try {
                          const res = await fetch(`/api/admin/backups/${b.id}/download`);
                          if (!res.ok) throw new Error('İndirme başarısız');
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `yedek-${b.date}.json`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast('Yedek indirildi', 'success');
                        } catch {
                          toast('Yedek indirilemedi — henüz aktif yedekleme sistemi yapılandırılmamış', 'error');
                        }
                      }}>
                        <Download className="h-3.5 w-3.5" /> İndir
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-sm text-center py-8" style={{ color: K.TEXT_MUTED }}>Henüz yedekleme yapılmadı. İlk yedeği almak için &apos;Yedek Al&apos; butonunu kullanın.</div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
