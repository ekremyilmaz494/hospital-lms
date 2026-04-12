'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Users, ThumbsUp, Star, X, ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { PageLoading } from '@/components/shared/page-loading';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CategoryAnalytics {
  categoryId: string;
  categoryName: string;
  avgScore: number | null;
  items: {
    itemId: string;
    text: string;
    questionType: 'likert_5' | 'yes_partial_no' | 'text';
    avg: number | null;
    count: number;
  }[];
}

interface AnalyticsData {
  totalResponses: number;
  passedCount: number;
  failedCount: number;
  overallAverage: number | null;
  recommendationRate: number | null;
  categories: CategoryAnalytics[];
}

interface TrainingOption { id: string; title: string; }

function scoreColor(val: number, max: number) {
  const r = val / max;
  if (r >= 0.8) return 'var(--color-success)';
  if (r >= 0.6) return 'var(--color-primary)';
  if (r >= 0.4) return 'var(--color-warning)';
  return 'var(--color-error)';
}

function ScoreRing({ value, max = 5, size = 96 }: { value: number | null; max?: number; size?: number }) {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 100); return () => clearTimeout(t); }, []);

  const pct = value !== null ? Math.min(value / max, 1) : 0;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = animated ? pct * circ : 0;
  const col = value !== null ? scoreColor(value, max) : 'var(--color-border)';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={6} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={`${circ - dash}`}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 4px ${col}60)` }} />
      </svg>
      <div className="text-center z-10">
        <p className="text-[18px] font-black tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)', color: col }}>
          {value !== null ? value.toFixed(1) : '—'}
        </p>
        <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--color-text-muted)' }}>/ {max}</p>
      </div>
    </div>
  );
}

function ScoreBar({ avg, max = 5 }: { avg: number | null; max?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(avg !== null ? (avg / max) * 100 : 0), 150); return () => clearTimeout(t); }, [avg, max]);
  if (avg === null) return <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>—</span>;
  const col = scoreColor(avg, max);
  return (
    <div className="flex items-center gap-2.5 min-w-[150px]">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
        <div className="h-full rounded-full" style={{ width: `${w}%`, background: col, boxShadow: `0 0 6px ${col}50`, transition: 'width 700ms cubic-bezier(0.34,1.56,0.64,1)' }} />
      </div>
      <span className="text-[12px] font-bold tabular-nums" style={{ color: col, minWidth: 28, textAlign: 'right' }}>{avg.toFixed(2)}</span>
    </div>
  );
}

export default function FeedbackAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainings, setTrainings] = useState<TrainingOption[]>([]);
  const [trainingId, setTrainingId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/trainings?limit=100').then(r => r.json()).then(d => {
      const list = (d.trainings ?? d.items ?? []) as Array<{ id: string; title: string }>;
      setTrainings(list.map(t => ({ id: t.id, title: t.title })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (trainingId) params.set('trainingId', trainingId);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    fetch(`/api/admin/feedback/analytics${params.toString() ? '?' + params : ''}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trainingId, dateFrom, dateTo]);

  const hasFilters = !!(trainingId || dateFrom || dateTo);
  const passRate = data && (data.passedCount + data.failedCount) > 0
    ? (data.passedCount / (data.passedCount + data.failedCount)) * 100 : null;

  if (loading && !data) return <PageLoading />;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <PageHeader
        title="Geri Bildirim Analitiği"
        subtitle="EY.FR.40 yanıtlarından çıkan eğitim kalitesi göstergeleri"
      />

      {/* Filters */}
      <div className="rounded-2xl px-5 py-4 flex flex-wrap gap-3 items-end"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>Eğitim</label>
          <select value={trainingId} onChange={e => setTrainingId(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-[13px]"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}>
            <option value="">Tüm eğitimler</option>
            {trainings.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        {[{ label: 'Başlangıç', val: dateFrom, set: setDateFrom }, { label: 'Bitiş', val: dateTo, set: setDateTo }].map(({ label, val, set }) => (
          <div key={label}>
            <label className="block text-[10px] uppercase tracking-widest font-semibold mb-1.5" style={{ color: 'var(--color-text-muted)' }}>{label}</label>
            <Input type="date" value={val} onChange={e => set(e.target.value)} />
          </div>
        ))}
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={() => { setTrainingId(''); setDateFrom(''); setDateTo(''); }} className="gap-1.5">
            <X className="w-3.5 h-3.5" /> Temizle
          </Button>
        )}
      </div>

      {!data || data.totalResponses === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--color-primary-light)' }}>
            <Star className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
          </div>
          <p className="text-[15px] font-semibold mb-1">Henüz yanıt yok</p>
          <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>Personel eğitim tamamladıkça veriler burada görünecek.</p>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Toplam Yanıt', value: String(data.totalResponses), icon: Users, accent: 'var(--color-primary)' },
              { label: 'Genel Ortalama', value: data.overallAverage?.toFixed(2) ?? '—', suffix: '/ 5', icon: Star, accent: '#f59e0b' },
              { label: 'Tavsiye Oranı', value: data.recommendationRate !== null ? `${data.recommendationRate.toFixed(1)}%` : '—', icon: ThumbsUp, accent: '#6366f1' },
              { label: 'Geçme Oranı', value: passRate !== null ? `${passRate.toFixed(0)}%` : '—', icon: TrendingUp, accent: 'var(--color-success)' },
            ].map(({ label, value, suffix, icon: Icon, accent }, i) => (
              <div key={label} className="rounded-2xl p-5 relative overflow-hidden"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', animationDelay: `${i * 60}ms` }}>
                <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full pointer-events-none"
                  style={{ background: `radial-gradient(circle, ${accent}18, transparent)` }} />
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}18` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: accent }} />
                  </div>
                </div>
                <p className="text-[26px] font-black tabular-nums leading-none" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text)' }}>
                  {value}
                  {suffix && <span className="text-[13px] font-normal ml-1.5" style={{ color: 'var(--color-text-muted)' }}>{suffix}</span>}
                </p>
              </div>
            ))}
          </div>

          {/* Score ring + pass breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl p-6 flex flex-col items-center justify-center gap-3"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--color-text-muted)' }}>Genel Puan</p>
              <ScoreRing value={data.overallAverage} max={5} size={110} />
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{data.totalResponses} yanıt üzerinden</p>
            </div>

            <div className="rounded-2xl p-6 md:col-span-2"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-[10px] uppercase tracking-widest font-semibold mb-5" style={{ color: 'var(--color-text-muted)' }}>Sınav Sonuçları</p>
              {[
                { label: 'Geçti', count: data.passedCount, col: 'var(--color-success)', bg: 'var(--color-success-bg)' },
                { label: 'Kaldı', count: data.failedCount, col: 'var(--color-error)', bg: 'var(--color-error-bg)' },
              ].map(({ label, count, col, bg }) => {
                const total = data.passedCount + data.failedCount;
                const pct = total > 0 ? (count / total) * 100 : 0;
                return (
                  <div key={label} className="mb-4 last:mb-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-semibold">{label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-black tabular-nums" style={{ color: col }}>{count}</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ background: bg, color: col }}>%{pct.toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: col, transition: 'width 800ms cubic-bezier(0.34,1.56,0.64,1)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-semibold px-1" style={{ color: 'var(--color-text-muted)' }}>Kategori Detayı</p>
            {data.categories.map((cat, ci) => {
              const isOpen = expandedCat === cat.categoryId;
              const avg = cat.avgScore;
              const col = avg !== null ? scoreColor(avg, 5) : 'var(--color-text-muted)';
              return (
                <div key={cat.categoryId} className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--color-surface)', border: `1px solid ${isOpen ? 'var(--color-primary)' : 'var(--color-border)'}`, transition: 'border-color 200ms' }}>
                  <button onClick={() => setExpandedCat(isOpen ? null : cat.categoryId)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left"
                    style={{ background: isOpen ? 'var(--color-primary-light)' : 'transparent' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                      style={{ background: isOpen ? 'var(--color-primary)' : 'var(--color-bg)', color: isOpen ? 'white' : 'var(--color-text-muted)', transition: 'all 200ms' }}>
                      {ci + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate">{cat.categoryName}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{cat.items.length} soru</p>
                    </div>
                    {avg !== null && (
                      <p className="text-[20px] font-black tabular-nums shrink-0 mr-1" style={{ color: col, fontFamily: 'var(--font-display)' }}>{avg.toFixed(2)}</p>
                    )}
                    <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--color-text-muted)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 250ms' }} />
                  </button>

                  <div style={{ display: 'grid', gridTemplateRows: isOpen ? '1fr' : '0fr', transition: 'grid-template-rows 300ms ease' }}>
                    <div className="overflow-hidden">
                      <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                        {cat.items.map((item, ii) => (
                          <div key={item.itemId} className="px-5 py-3 flex items-center gap-4"
                            style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? 'translateY(0)' : 'translateY(-6px)', transition: `opacity 220ms ease ${ii * 35}ms, transform 220ms ease ${ii * 35}ms` }}>
                            <span className="text-[10px] font-black w-5 text-center shrink-0 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{ii + 1}</span>
                            <p className="flex-1 text-[13px] leading-snug">{item.text}</p>
                            <span className="text-[11px] tabular-nums shrink-0" style={{ color: 'var(--color-text-muted)' }}>{item.count} yanıt</span>
                            <div className="w-40 shrink-0">
                              {item.questionType === 'likert_5' && <ScoreBar avg={item.avg} max={5} />}
                              {item.questionType === 'yes_partial_no' && <ScoreBar avg={item.avg} max={3} />}
                              {item.questionType === 'text' && <span className="text-[11px] italic" style={{ color: 'var(--color-text-muted)' }}>Serbest metin</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
