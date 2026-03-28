'use client';

import { Database, Download, Plus, Clock, HardDrive, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { BlurFade } from '@/components/ui/blur-fade';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

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
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
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
        <BlurFade delay={0.05}><StatCard title="Son Yedek" value={stats.lastBackup} icon={CheckCircle} accentColor="var(--color-success)" /></BlurFade>
        <BlurFade delay={0.1}><StatCard title="Toplam Boyut" value={stats.totalSize} icon={HardDrive} accentColor="var(--color-info)" /></BlurFade>
        <BlurFade delay={0.15}><StatCard title="Sonraki Otomatik" value={stats.nextAuto} icon={Clock} accentColor="var(--color-accent)" /></BlurFade>
      </div>

      <BlurFade delay={0.2}>
        <div className="rounded-2xl border overflow-hidden" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
          {backups.length > 0 ? (
            <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th className="w-[30%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
                  <th className="w-[15%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tür</th>
                  <th className="w-[15%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Boyut</th>
                  <th className="w-[20%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                  <th className="w-[20%] px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.id} className="clickable-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td className="px-5 py-4 font-mono font-medium">{b.date}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: b.type === 'auto' ? 'var(--color-info-bg)' : 'var(--color-accent-light)', color: b.type === 'auto' ? 'var(--color-info)' : 'var(--color-accent)' }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.type === 'auto' ? 'var(--color-info)' : 'var(--color-accent)' }} />
                        {b.type === 'auto' ? 'Otomatik' : 'Manuel'}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm" style={{ color: 'var(--color-text-secondary)' }}>{b.size}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle className="h-3.5 w-3.5" /> Tamamlandı
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <Button variant="ghost" size="sm" className="gap-1.5 rounded-lg" style={{ color: 'var(--color-primary)' }} onClick={async () => {
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
            <div className="text-sm text-center py-8" style={{ color: 'var(--color-text-muted)' }}>Henüz veri yok</div>
          )}
        </div>
      </BlurFade>
    </div>
  );
}
