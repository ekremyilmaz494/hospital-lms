'use client';

import Link from 'next/link';
import { ChevronLeft, FileCheck2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { InspectionReportTab } from '../components/inspection-report-tab';

interface Period { id: string; name: string; }
interface PeriodsData { periods: Period[]; }

export default function InspectionPage() {
  const { data } = useFetch<PeriodsData>('/api/admin/smg/periods');
  const periods = data?.periods ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 print:hidden">
        <Link
          href="/admin/smg"
          className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-xl transition-colors"
          style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-secondary)' }}
        >
          <ChevronLeft className="h-4 w-4" /> Geri
        </Link>
        <nav className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          SMG Takibi <span className="mx-1">/</span> <span style={{ color: 'var(--color-text)' }}>SKS Denetim Raporu</span>
        </nav>
      </div>

      <div className="rounded-2xl border p-6 text-center print:p-0 print:border-0"
        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', borderColor: 'transparent' }}>
        <FileCheck2 className="h-10 w-10 mx-auto mb-2 text-white" />
        <h1 className="text-2xl font-black text-white">SKS Denetim Raporu</h1>
        <p className="text-sm mt-1 text-indigo-100">
          Sağlık Bakanlığı SKS Denetimi için Personel Uyum Belgesi
        </p>
      </div>

      <div className="rounded-2xl border overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <InspectionReportTab periods={periods} />
      </div>
    </div>
  );
}
