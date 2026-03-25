'use client';
import { Database, Download, Plus, Clock, HardDrive, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/shared/page-header';

const backups = [
  { id: '1', type: 'auto', date: '24.03.2026 03:00', size: '124.5 MB', status: 'completed' },
  { id: '2', type: 'manual', date: '23.03.2026 15:30', size: '123.8 MB', status: 'completed' },
  { id: '3', type: 'auto', date: '23.03.2026 03:00', size: '123.2 MB', status: 'completed' },
  { id: '4', type: 'auto', date: '22.03.2026 03:00', size: '122.1 MB', status: 'completed' },
  { id: '5', type: 'auto', date: '21.03.2026 03:00', size: '121.5 MB', status: 'completed' },
  { id: '6', type: 'manual', date: '20.03.2026 10:15', size: '120.8 MB', status: 'completed' },
  { id: '7', type: 'auto', date: '20.03.2026 03:00', size: '120.2 MB', status: 'completed' },
];

export default function BackupsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Veritabanı Yedekleme" subtitle="Otomatik ve manuel yedeklerinizi yönetin" action={{ label: 'Manuel Yedek Al', icon: Plus }} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeftWidth: '4px', borderLeftColor: 'var(--color-success)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3"><CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} /><div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Son Yedek</p><p className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>24.03.2026</p></div></div>
        </div>
        <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeftWidth: '4px', borderLeftColor: 'var(--color-info)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3"><HardDrive className="h-5 w-5" style={{ color: 'var(--color-info)' }} /><div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Toplam Boyut</p><p className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>856.1 MB</p></div></div>
        </div>
        <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderLeftWidth: '4px', borderLeftColor: 'var(--color-accent)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="flex items-center gap-3"><Clock className="h-5 w-5" style={{ color: 'var(--color-accent)' }} /><div><p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sonraki Otomatik</p><p className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>25.03.2026 03:00</p></div></div>
        </div>
      </div>
      <div className="rounded-xl border" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <table className="w-full text-sm">
          <thead><tr style={{ borderBottom: '1px solid var(--color-border)' }}>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tarih</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Tür</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Boyut</th>
            <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
            <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
          </tr></thead>
          <tbody>{backups.map((b) => (
            <tr key={b.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td className="px-5 py-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>{b.date}</td>
              <td className="px-5 py-3"><span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: b.type === 'auto' ? 'var(--color-info-bg)' : 'var(--color-accent-light)', color: b.type === 'auto' ? 'var(--color-info)' : 'var(--color-accent)' }}>{b.type === 'auto' ? 'Otomatik' : 'Manuel'}</span></td>
              <td className="px-5 py-3" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>{b.size}</td>
              <td className="px-5 py-3"><span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--color-success)' }}><CheckCircle className="h-3.5 w-3.5" /> Tamamlandı</span></td>
              <td className="px-5 py-3 text-right"><Button variant="ghost" size="sm" className="gap-1" style={{ color: 'var(--color-primary)' }}><Download className="h-3.5 w-3.5" /> İndir</Button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
