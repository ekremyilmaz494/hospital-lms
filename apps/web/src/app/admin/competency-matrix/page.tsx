'use client';

import { CheckCircle, XCircle, Clock, Minus, AlertTriangle, Search, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useEffect, useMemo, useState } from 'react';

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

interface Cell { trainingId: string; state: string; score?: number | null }
interface StaffRow { id: string; name: string; department: string; cells: Cell[]; completionRate: number }
interface Training { id: string; title: string; isCompulsory: boolean }
interface Department { id: string; name: string }
interface MatrixData {
  trainings: Training[];
  staff: StaffRow[];
  departments: Department[];
  summary: { totalStaff: number; totalTrainings: number; compulsoryTrainings: number };
  page: number;
  limit: number;
  totalPages: number;
}

const stateConfig: Record<string, { icon: typeof CheckCircle; bg: string; border: string; color: string; label: string }> = {
  passed:      { icon: CheckCircle, bg: K.SUCCESS_BG,  border: K.SUCCESS,  color: K.SUCCESS,  label: 'Başarılı' },
  failed:      { icon: XCircle,     bg: K.ERROR_BG,    border: K.ERROR,    color: K.ERROR,    label: 'Başarısız' },
  in_progress: { icon: Clock,       bg: K.WARNING_BG, border: K.WARNING, color: K.WARNING, label: 'Devam' },
  assigned:    { icon: Clock,       bg: K.INFO_BG,     border: K.INFO,     color: K.INFO,     label: 'Atandı' },
  locked:      { icon: Lock,        bg: K.ERROR_BG,    border: K.ERROR,    color: K.ERROR,    label: 'Kilitli' },
  unassigned:  { icon: Minus,       bg: 'transparent',              border: K.BORDER_LIGHT,   color: K.TEXT_MUTED, label: 'Atanmadı' },
};

const nameHue = (name: string) => name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

export default function CompetencyMatrixPage() {
  const [page, setPage] = useState(1);
  const [departmentId, setDepartmentId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Search için 300ms debounce — her tuş vuruşunda API'ye gitme
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filtre değişince ilk sayfaya dön — render sırasında senkron reset (useEffect yerine)
  const filterKey = `${debouncedSearch}|${departmentId}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const url = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (departmentId) params.set('departmentId', departmentId);
    return `/api/admin/competency-matrix?${params.toString()}`;
  }, [page, debouncedSearch, departmentId]);

  const { data, isLoading } = useFetch<MatrixData>(url);

  if (isLoading && !data) return <PageLoading />;

  const trainings = data?.trainings ?? [];
  const staff = data?.staff ?? [];
  const departments = data?.departments ?? [];
  const totalStaff = data?.summary.totalStaff ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? page;
  const isFiltered = Boolean(debouncedSearch || departmentId);

  const summaryCards = [
    { label: 'Toplam Personel', value: data?.summary.totalStaff ?? 0, color: K.PRIMARY, bg: K.PRIMARY_LIGHT, icon: '' },
    { label: 'Aktif Eğitim',    value: data?.summary.totalTrainings ?? 0, color: K.INFO, bg: K.INFO_BG,       icon: '' },
    { label: 'Zorunlu Eğitim',  value: data?.summary.compulsoryTrainings ?? 0, color: K.ERROR, bg: K.ERROR_BG, icon: '' },
  ];

  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span data-current="true">Yetkinlik Matrisi</span>
            </div>
            <h1 className="k-page-title">Yetkinlik Matrisi</h1>
            <p className="k-page-subtitle">
              <strong style={{ color: K.TEXT_PRIMARY }}>{totalStaff}</strong> personel ×{' '}
              <strong style={{ color: K.TEXT_PRIMARY }}>{trainings.length}</strong> eğitim ısı haritası
            </p>
          </div>
        </header>
      </BlurFade>

      {/* Summary cards */}
      <BlurFade delay={0.05}>
        <div className="grid grid-cols-3 gap-4">
          {summaryCards.map(s => (
            <div key={s.label} className="k-stat-card">
              <div className="k-stat-card-rail" style={{ background: s.color }} />
              <div className="k-stat-card-head">
                <div className="k-stat-card-label">{s.label}</div>
                <div className="k-stat-card-icon" style={{ background: s.bg, color: s.color }}>
                  {s.icon}
                </div>
              </div>
              <div className="k-stat-card-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.08}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="k-input" style={{ minWidth: 220 }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Personel ara…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>

          <div className="k-input">
            <select
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
              style={{ cursor: 'pointer' }}
            >
              <option value="">Tüm Departmanlar</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {isFiltered && (
            <span className="k-badge k-badge-no-dot" style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY }}>
              {totalStaff} sonuç
            </span>
          )}
          {isLoading && data && (
            <span className="text-xs" style={{ color: K.TEXT_MUTED }}>Yükleniyor…</span>
          )}
        </div>
      </BlurFade>

      {/* Matrix table */}
      <BlurFade delay={0.12}>
        <div className="k-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: K.BG, borderBottom: '1px solid #c9c4be' }}>
                  {/* Sticky name column */}
                  <th
                    className="sticky left-0 z-10 px-5 py-3.5 text-left"
                    style={{ background: K.BG, minWidth: 192, borderRight: '1px solid #c9c4be' }}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Personel</span>
                  </th>
                  {/* Completion rate column */}
                  <th className="px-4 py-3.5 text-center" style={{ minWidth: 80 }}>
                    <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Oran</span>
                  </th>
                  {/* Training columns */}
                  {trainings.map(t => (
                    <th key={t.id} className="px-2 py-3.5 text-center" style={{ minWidth: 44, verticalAlign: 'bottom' }}>
                      <div className="flex flex-col items-center gap-1.5">
                        {t.isCompulsory && (
                          <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: K.ERROR }} />
                        )}
                        <span
                          style={{
                            writingMode: 'vertical-lr',
                            transform: 'rotate(180deg)',
                            fontSize: 10,
                            fontWeight: 600,
                            color: K.TEXT_MUTED,
                            letterSpacing: '0.03em',
                            height: 62,
                            lineHeight: 1.25,
                            display: 'block',
                            overflow: 'hidden',
                          }}
                          title={t.title}
                        >
                          {t.title.length > 14 ? t.title.slice(0, 14) + '…' : t.title}
                        </span>
                        {/* Column indicator dot */}
                        <span
                          style={{
                            width: 5, height: 5, borderRadius: '50%', display: 'block',
                            background: t.isCompulsory ? K.ERROR : K.INFO,
                          }}
                        />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.map((s, si) => {
                  const rate = s.completionRate;
                  const rateColor = rate >= 80 ? K.SUCCESS : rate >= 50 ? K.WARNING : K.ERROR;
                  const hue = nameHue(s.name);
                  return (
                    <tr
                      key={s.id}
                      style={{
                        borderBottom: si < staff.length - 1 ? `1px solid ${K.BORDER_LIGHT}` : 'none',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = K.BG)}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Sticky name cell */}
                      <td
                        className="sticky left-0 z-10 px-5 py-3"
                        style={{
                          background: K.SURFACE,
                          borderRight: `1px solid ${K.BORDER_LIGHT}`,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            style={{
                              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                              background: `hsl(${hue}, 52%, 52%)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 800, color: '#fff',
                              boxShadow: `0 1px 4px hsl(${hue}deg 52% 52% / 40%)`,
                            }}
                          >
                            {s.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{s.name}</p>
                            <p className="mt-0.5 text-[11px]" style={{ color: K.TEXT_MUTED }}>{s.department}</p>
                          </div>
                        </div>
                      </td>

                      {/* Completion rate */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-bold tabular-nums" style={{ color: rateColor }}>%{rate}</span>
                          <div style={{ width: 44, height: 4, borderRadius: 2, background: K.BORDER_LIGHT, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rate}%`, background: rateColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                      </td>

                      {/* State cells */}
                      {s.cells.map(cell => {
                        const cfg = stateConfig[cell.state] ?? stateConfig.unassigned;
                        const Icon = cfg.icon;
                        const isUnset = cell.state === 'unassigned';
                        return (
                          <td key={cell.trainingId} className="px-2 py-3 text-center">
                            <div
                              className="mx-auto flex flex-col items-center gap-0.5"
                              title={`${cfg.label}${cell.score != null ? ` — %${cell.score}` : ''}`}
                            >
                              <div
                                style={{
                                  width: 28, height: 28, borderRadius: '50%',
                                  background: cfg.bg,
                                  border: `2px solid ${cfg.border}`,
                                  opacity: isUnset ? 0.3 : 1,
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  boxShadow: isUnset ? 'none' : '0 1px 4px rgba(0,0,0,0.08)',
                                }}
                              >
                                <Icon style={{ width: 13, height: 13, color: cfg.color }} />
                              </div>
                              {cell.score != null && (
                                <span className="text-[9px] font-bold tabular-nums" style={{ color: cfg.color }}>
                                  {cell.score}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {staff.length === 0 && (
            <div className="py-16 text-center text-sm" style={{ color: K.TEXT_MUTED }}>
              Personel bulunamadı
            </div>
          )}

          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3"
              style={{ borderTop: `1px solid ${K.BORDER_LIGHT}` }}
            >
              <span className="text-xs" style={{ color: K.TEXT_MUTED }}>
                Sayfa {currentPage} / {totalPages} · toplam {totalStaff} kayıt
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoading}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  style={{ background: K.SURFACE, borderColor: K.BORDER_LIGHT }}
                >
                  <ChevronLeft className="h-3.5 w-3.5" /> Önceki
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages || isLoading}
                  className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
                  style={{ background: K.SURFACE, borderColor: K.BORDER_LIGHT }}
                >
                  Sonraki <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </BlurFade>

      {/* Legend */}
      <BlurFade delay={0.18}>
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border px-5 py-3.5"
          style={{ background: K.SURFACE, borderColor: K.BORDER_LIGHT }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Durum</span>
          <div className="h-4 w-px" style={{ background: K.BORDER_LIGHT }} />
          {Object.entries(stateConfig).map(([key, cfg]) => {
            const Icon = cfg.icon;
            return (
              <div key={key} className="flex items-center gap-2">
                <div
                  style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: cfg.bg,
                    border: `2px solid ${cfg.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Icon style={{ width: 10, height: 10, color: cfg.color }} />
                </div>
                <span className="text-xs font-medium" style={{ color: K.TEXT_SECONDARY }}>{cfg.label}</span>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-1.5 text-[11px]" style={{ color: K.TEXT_MUTED }}>
            <AlertTriangle className="h-3 w-3" style={{ color: K.ERROR }} />
            Kırmızı nokta = zorunlu eğitim
          </div>
        </div>
      </BlurFade>
    </div>
  );
}
