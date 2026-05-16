'use client';

import Link from 'next/link';
import { ChevronLeft, FileCheck2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { InspectionReportTab } from '../components/inspection-report-tab';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9', BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

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
          className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-xl"
          style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, color: K.TEXT_SECONDARY }}
        >
          <ChevronLeft className="h-4 w-4" /> Geri
        </Link>
        <nav className="text-xs" style={{ color: K.TEXT_MUTED }}>
          SMG Takibi <span className="mx-1">/</span> <span style={{ color: K.TEXT_PRIMARY }}>SKS Denetim Raporu</span>
        </nav>
      </div>

      <div
        className="rounded-2xl p-6 text-center print:p-0 print:border-0"
        style={{ background: K.PRIMARY, borderColor: 'transparent', boxShadow: K.SHADOW_CARD }}
      >
        <FileCheck2 className="h-10 w-10 mx-auto mb-2" style={{ color: '#ffffff' }} />
        <h1 className="text-2xl font-black" style={{ color: '#ffffff', fontFamily: K.FONT_DISPLAY }}>
          SKS Denetim Raporu
        </h1>
        <p className="text-sm mt-1" style={{ color: K.PRIMARY_LIGHT }}>
          Sağlık Bakanlığı SKS Denetimi için Personel Uyum Belgesi
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, boxShadow: K.SHADOW_CARD }}
      >
        <InspectionReportTab periods={periods} syncWithUrl />
      </div>
    </div>
  );
}
