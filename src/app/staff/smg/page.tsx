'use client';

/**
 * SMG Puanlarım — "Clinical Editorial" redesign.
 * Notifications + Calendar ile aynı dil: cream + ink + gold + mono caps + serif display.
 * Büyük tipografik hero skor + segmented progress + editorial aktivite log'u.
 */

import { useEffect, useMemo, useState } from 'react';
import { Star, Plus, Loader2, ChevronDown, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/shared/toast';

/* ─── Domain ─── */

interface SmgPeriodSummary { id: string; name: string; isActive: boolean; }

interface SmgActivity {
  id: string;
  title: string;
  activityType: string;
  completionDate: string;
  smgPoints: number;
  approvalStatus: string;
  provider: string | null;
  rejectionReason: string | null;
}

interface MyPointsData {
  period: { id: string; name: string; requiredPoints: number; endDate: string } | null;
  periods: SmgPeriodSummary[];
  approvedPoints: number;
  pendingPoints: number;
  requiredPoints: number;
  remainingPoints: number;
  daysLeft: number | null;
  progress: number;
  approvedActivities: SmgActivity[];
  pendingActivities: SmgActivity[];
  rejectedActivities: SmgActivity[];
}

interface SmgCategoryOption {
  id: string;
  name: string;
  code: string;
  maxPointsPerActivity: number | null;
}
interface CategoriesResponse { categories: SmgCategoryOption[]; }

const activityTypeLabels: Record<string, string> = {
  EXTERNAL_TRAINING: 'Harici Eğitim',
  CONFERENCE: 'Konferans',
  PUBLICATION: 'Yayın',
  COURSE_COMPLETION: 'Kurs Tamamlama',
};

const STATUS: Record<string, { label: string; ink: string; bg: string; icon: typeof CheckCircle2 }> = {
  APPROVED: { label: 'ONAYLANDI',  ink: '#0a7a47', bg: '#eaf6ef', icon: CheckCircle2 },
  PENDING:  { label: 'BEKLİYOR',   ink: '#6a4e11', bg: '#fef6e7', icon: Clock },
  REJECTED: { label: 'REDDEDİLDİ', ink: '#b3261e', bg: '#fdf5f2', icon: XCircle },
};

/* ─── Editorial palette ─── */
const INK = '#0a1628';
const INK_SOFT = '#5b6478';
const CREAM = '#faf7f2';
const RULE = '#e5e0d5';
const GOLD = '#c9a961';
const OLIVE = '#1a3a28';

/* ─── Page ─── */

export default function StaffSmgPage() {
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    activityType: 'EXTERNAL_TRAINING',
    categoryId: '',
    title: '',
    provider: '',
    completionDate: '',
    smgPoints: '',
    certificateUrl: '',
  });
  const { toast } = useToast();

  const pointsUrl = `/api/staff/smg/my-points${selectedPeriodId ? `?periodId=${selectedPeriodId}` : ''}`;
  const { data, isLoading, refetch } = useFetch<MyPointsData>(pointsUrl);
  const { data: categoriesData } = useFetch<CategoriesResponse>('/api/admin/smg/categories');
  const categories = categoriesData?.categories ?? [];
  const selectedCategory = categories.find(c => c.id === form.categoryId);

  /* Cream theme cascade */
  useEffect(() => {
    const main = document.querySelector('main');
    if (!main) return;
    const el = main as HTMLElement;
    const prevBg = el.style.backgroundColor;
    const prevVar = el.style.getPropertyValue('--color-bg-rgb');
    el.style.backgroundColor = CREAM;
    el.style.setProperty('--color-bg-rgb', '250, 247, 242');
    return () => {
      el.style.backgroundColor = prevBg;
      if (prevVar) el.style.setProperty('--color-bg-rgb', prevVar);
      else el.style.removeProperty('--color-bg-rgb');
    };
  }, []);

  const handleSubmit = async () => {
    if (!form.title || !form.completionDate || !form.smgPoints) {
      toast('Başlık, tarih ve puan alanları zorunludur.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        completionDate: form.completionDate,
        smgPoints: Number(form.smgPoints),
        certificateUrl: form.certificateUrl || undefined,
        provider: form.provider || undefined,
      };
      if (form.categoryId) {
        payload.categoryId = form.categoryId;
      } else {
        payload.activityType = form.activityType;
      }
      const res = await fetch('/api/staff/smg/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error ?? 'Bir hata oluştu.', 'error');
        return;
      }
      toast('Aktivite başarıyla eklendi. Onay bekleniyor.', 'success');
      setModalOpen(false);
      setForm({ activityType: 'EXTERNAL_TRAINING', categoryId: '', title: '', provider: '', completionDate: '', smgPoints: '', certificateUrl: '' });
      refetch?.();
    } finally {
      setSubmitting(false);
    }
  };

  const approved = data?.approvedPoints ?? 0;
  const pending = data?.pendingPoints ?? 0;
  const remaining = data?.remainingPoints ?? 0;
  const required = data?.requiredPoints ?? 0;
  const daysLeft = data?.daysLeft ?? null;

  const allActivities = useMemo(
    () => [
      ...(data?.approvedActivities ?? []),
      ...(data?.pendingActivities ?? []),
      ...(data?.rejectedActivities ?? []),
    ].sort((a, b) => new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime()),
    [data],
  );

  const periods = data?.periods ?? [];
  const activeTab = data?.period;
  const approvedPct = required > 0 ? Math.min(100, (approved / required) * 100) : 0;
  const pendingPct = required > 0 ? Math.min(100 - approvedPct, (pending / required) * 100) : 0;

  return (
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{
        backgroundColor: CREAM,
        color: INK,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(10, 22, 40, 0.035) 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
    >
      <div className="relative px-6 sm:px-10 lg:px-16 pt-8 pb-16">
        {/* ───── Masthead ───── */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b pb-5"
          style={{ borderColor: INK }}
        >
          <div className="flex items-end gap-4">
            <p
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              № 03 · SMG
            </p>
            <h1
              className="text-[36px] sm:text-[44px] leading-[0.95] font-semibold tracking-[-0.025em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              puan karnesi<span style={{ color: GOLD }}>.</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {periods.length > 0 && (
              <div className="relative">
                <select
                  value={selectedPeriodId}
                  onChange={e => setSelectedPeriodId(e.target.value)}
                  className="appearance-none cursor-pointer text-[11px] font-semibold uppercase tracking-[0.14em] py-2 pl-3 pr-8 focus:outline-none"
                  style={{
                    color: INK,
                    backgroundColor: 'transparent',
                    border: `1px solid ${INK}`,
                    borderRadius: '2px',
                    fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                  }}
                >
                  <option value="">AKTİF DÖNEM</option>
                  {periods.map(p => <option key={p.id} value={p.id}>{p.name.toUpperCase()}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" style={{ color: INK }} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{
                color: CREAM,
                backgroundColor: INK,
                borderRadius: '2px',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                transition: 'background-color 160ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = OLIVE; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = INK; }}
            >
              <Plus className="h-3.5 w-3.5" style={{ color: GOLD }} />
              Aktivite Ekle
            </button>
          </div>
        </header>

        <p
          className="mt-3 text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          Sürekli Mesleki Gelişim — {activeTab?.name ?? 'Dönem bulunamadı'}
        </p>

        {isLoading && !data ? (
          <SmgSkeleton />
        ) : (
          <>
            {/* ───── HERO: Big score ───── */}
            <section className="mt-10 grid gap-10 lg:grid-cols-[1.6fr_1fr] items-end">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.22em]"
                  style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  Toplam onaylı puan
                </p>
                <div className="mt-3 flex items-baseline gap-3">
                  <span
                    className="text-[120px] sm:text-[160px] leading-none font-semibold tabular-nums tracking-[-0.04em]"
                    style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    {approved}
                  </span>
                  <span
                    className="text-[28px] sm:text-[36px] font-semibold tabular-nums tracking-[-0.02em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    / {required}
                  </span>
                  <span
                    className="ml-2 text-[11px] font-semibold uppercase tracking-[0.18em] pb-3"
                    style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    puan
                  </span>
                </div>

                {/* Segmented progress bar */}
                <div className="mt-6 w-full">
                  <div
                    className="relative h-[6px] w-full overflow-hidden"
                    style={{ backgroundColor: RULE, borderRadius: '1px' }}
                  >
                    <div
                      className="absolute left-0 top-0 h-full"
                      style={{ width: `${approvedPct}%`, backgroundColor: OLIVE }}
                    />
                    <div
                      className="absolute top-0 h-full"
                      style={{ left: `${approvedPct}%`, width: `${pendingPct}%`, backgroundColor: GOLD }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span
                      className="text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      0
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      %{Math.round(approvedPct)} tamamlandı
                    </span>
                    <span
                      className="text-[10px] uppercase tracking-[0.14em]"
                      style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                    >
                      {required}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: breakdown table */}
              <div
                className="grid gap-0 border"
                style={{ borderColor: RULE, backgroundColor: '#ffffff', borderRadius: '4px' }}
              >
                <BreakdownRow
                  swatch={OLIVE}
                  label="Onaylı"
                  value={approved}
                  suffix="puan"
                />
                <BreakdownRow
                  swatch={GOLD}
                  label="Bekliyor"
                  value={pending}
                  suffix="puan"
                />
                <BreakdownRow
                  swatch={RULE}
                  label="Kalan"
                  value={remaining}
                  suffix="puan"
                  muted
                />
                <BreakdownRow
                  swatch="transparent"
                  label="Son tarih"
                  value={daysLeft != null ? daysLeft : '—'}
                  suffix={daysLeft != null ? 'gün' : ''}
                  tone={daysLeft != null && daysLeft <= 14 ? '#b3261e' : INK}
                  last
                />
              </div>
            </section>

            {/* ───── Activity log ───── */}
            <section className="mt-16">
              <header
                className="grid items-end gap-4 pb-3 border-b"
                style={{ gridTemplateColumns: '40px 1fr max-content', borderColor: RULE }}
              >
                <span
                  className="text-[11px] font-semibold tracking-[0.2em]"
                  style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  I.
                </span>
                <div>
                  <h2
                    className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
                    style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    Aktivite kaydı
                  </h2>
                  <p
                    className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    Girdiğin tüm SMG aktiviteleri — son tarih sıralı
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold tabular-nums"
                  style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  [{allActivities.length.toString().padStart(2, '0')}]
                </span>
              </header>

              {allActivities.length === 0 ? (
                <div
                  className="mt-5 flex flex-col items-center justify-center text-center px-6 py-14"
                  style={{
                    border: `1px dashed ${RULE}`,
                    borderRadius: '4px',
                    backgroundColor: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 44, height: 44, backgroundColor: CREAM,
                      border: `1px solid ${RULE}`, borderRadius: '2px',
                    }}
                  >
                    <Star style={{ width: 20, height: 20, color: INK_SOFT }} />
                  </div>
                  <p
                    className="mt-3 text-[15px] font-semibold tracking-[-0.01em]"
                    style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    Aktivite kaydın yok
                  </p>
                  <p className="mt-1 text-[12px] max-w-sm" style={{ color: INK_SOFT }}>
                    Harici eğitim, konferans veya yayınlarını ekleyerek puan biriktirmeye başla.
                  </p>
                  <button
                    type="button"
                    onClick={() => setModalOpen(true)}
                    className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      color: CREAM, backgroundColor: INK, borderRadius: '2px',
                      fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                    }}
                  >
                    <Plus className="h-3 w-3" style={{ color: GOLD }} />
                    İlk aktiviteyi ekle
                  </button>
                </div>
              ) : (
                <ul className="mt-5 space-y-2.5">
                  {allActivities.map((a, idx) => <ActivityRow key={a.id} a={a} index={idx + 1} />)}
                </ul>
              )}
            </section>
          </>
        )}
      </div>

      {/* ───── Add activity modal ───── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          className="sm:max-w-md p-0 gap-0 border-0"
          style={{ backgroundColor: CREAM, borderRadius: '4px', color: INK }}
        >
          <DialogHeader className="px-6 pt-6 pb-3 border-b" style={{ borderColor: INK }}>
            <div className="flex items-center justify-between">
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                № 03.01 · YENİ KAYIT
              </p>
            </div>
            <DialogTitle
              className="text-[22px] font-semibold tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif', color: INK }}
            >
              aktivite ekle<span style={{ color: GOLD }}>.</span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <FormField label="Aktivite kategorisi">
              {categories.length > 0 ? (
                <EditorialSelect
                  value={form.categoryId}
                  onChange={v => setForm(f => ({ ...f, categoryId: v }))}
                >
                  <option value="">Seçiniz...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </EditorialSelect>
              ) : (
                <EditorialSelect
                  value={form.activityType}
                  onChange={v => setForm(f => ({ ...f, activityType: v }))}
                >
                  <option value="EXTERNAL_TRAINING">Harici Eğitim</option>
                  <option value="CONFERENCE">Konferans</option>
                  <option value="PUBLICATION">Yayın</option>
                  <option value="COURSE_COMPLETION">Kurs Tamamlama</option>
                </EditorialSelect>
              )}
            </FormField>

            <FormField label="Başlık" required>
              <EditorialInput
                value={form.title}
                onChange={v => setForm(f => ({ ...f, title: v }))}
                placeholder="Aktivite başlığı"
              />
            </FormField>

            <FormField label="Sağlayıcı / Kurum">
              <EditorialInput
                value={form.provider}
                onChange={v => setForm(f => ({ ...f, provider: v }))}
                placeholder="Üniversite, dernek, kurum adı"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Tamamlanma tarihi" required>
                <EditorialInput
                  type="date"
                  value={form.completionDate}
                  onChange={v => setForm(f => ({ ...f, completionDate: v }))}
                />
              </FormField>
              <FormField label="SMG puanı" required>
                <EditorialInput
                  type="number"
                  min={1}
                  max={selectedCategory?.maxPointsPerActivity ?? 999}
                  value={form.smgPoints}
                  onChange={v => setForm(f => ({ ...f, smgPoints: v }))}
                  placeholder="1–999"
                />
                {selectedCategory?.maxPointsPerActivity && (
                  <p className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}>
                    Max {selectedCategory.maxPointsPerActivity} p
                  </p>
                )}
              </FormField>
            </div>

            <FormField label="Sertifika URL (opsiyonel)">
              <EditorialInput
                value={form.certificateUrl}
                onChange={v => setForm(f => ({ ...f, certificateUrl: v }))}
                placeholder="https://..."
              />
            </FormField>
          </div>

          <DialogFooter className="px-6 py-4 border-t flex flex-row gap-2" style={{ borderColor: RULE }}>
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              disabled={submitting}
              className="flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] py-2.5"
              style={{
                color: INK, backgroundColor: 'transparent',
                border: `1px solid ${INK}`, borderRadius: '2px',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 inline-flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] py-2.5"
              style={{
                color: CREAM, backgroundColor: INK,
                borderRadius: '2px',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Kaydet
              {!submitting && <span style={{ color: GOLD }}>→</span>}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Atoms
   ───────────────────────────────────────────────────── */

function BreakdownRow({
  swatch, label, value, suffix, muted, last, tone,
}: {
  swatch: string; label: string; value: number | string; suffix: string;
  muted?: boolean; last?: boolean; tone?: string;
}) {
  return (
    <div
      className="grid items-center gap-3 px-4 py-3"
      style={{
        gridTemplateColumns: '12px 1fr max-content',
        borderBottom: last ? 'none' : `1px solid ${RULE}`,
      }}
    >
      <span
        className="h-3 w-3 inline-block"
        style={{
          backgroundColor: swatch,
          border: swatch === 'transparent' ? 'none' : 'none',
          borderRadius: '1px',
        }}
      />
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{
          color: muted ? INK_SOFT : INK,
          fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
        }}
      >
        {label}
      </span>
      <span className="flex items-baseline gap-1">
        <span
          className="text-[20px] font-semibold tabular-nums tracking-[-0.02em]"
          style={{
            color: tone ?? (muted ? INK_SOFT : INK),
            fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
          }}
        >
          {value}
        </span>
        {suffix && (
          <span
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {suffix}
          </span>
        )}
      </span>
    </div>
  );
}

function ActivityRow({ a, index }: { a: SmgActivity; index: number }) {
  const status = STATUS[a.approvalStatus] ?? STATUS.PENDING;
  const Icon = status.icon;

  return (
    <li
      style={{
        backgroundColor: '#ffffff',
        border: `1px solid ${RULE}`,
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    >
      <div
        className="grid items-center gap-4 px-5 py-4"
        style={{ gridTemplateColumns: '36px 1fr max-content max-content' }}
      >
        <span
          className="text-[11px] font-semibold tabular-nums"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          {index.toString().padStart(2, '0')}
        </span>

        <div className="min-w-0">
          <p
            className="truncate text-[14px] font-semibold tracking-[-0.01em]"
            style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
          >
            {a.title}
          </p>
          <p
            className="mt-0.5 text-[11px] uppercase tracking-[0.12em] truncate"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            {activityTypeLabels[a.activityType] ?? a.activityType}
            {a.provider && <span> · {a.provider}</span>}
            <span> · {new Date(a.completionDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </p>
        </div>

        <span className="flex items-baseline gap-1">
          <span
            className="text-[22px] font-semibold tabular-nums tracking-[-0.02em]"
            style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
          >
            {a.smgPoints}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.14em]"
            style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            p
          </span>
        </span>

        <span
          className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-[10px] font-semibold tracking-[0.12em] leading-none"
          style={{
            color: status.ink,
            backgroundColor: status.bg,
            fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
          }}
        >
          <Icon className="h-3 w-3" />
          {status.label}
        </span>
      </div>

      {a.approvalStatus === 'REJECTED' && a.rejectionReason && (
        <div
          className="grid items-start gap-3 px-5 py-3"
          style={{
            gridTemplateColumns: '36px 1fr',
            borderTop: `1px solid ${RULE}`,
            backgroundColor: '#fdf5f2',
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 ml-auto" style={{ color: '#b3261e' }} />
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.14em] font-semibold"
              style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              Red nedeni
            </p>
            <p className="mt-0.5 text-[12px]" style={{ color: INK }}>
              {a.rejectionReason}
            </p>
          </div>
        </div>
      )}
    </li>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5 block"
        style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      >
        {label}
        {required && <span style={{ color: GOLD }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function EditorialInput({
  value, onChange, placeholder, type = 'text', min, max,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; min?: number; max?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[13px] px-3 py-2 focus:outline-none focus:ring-0"
      style={{
        backgroundColor: '#ffffff',
        color: INK,
        border: `1px solid ${RULE}`,
        borderRadius: '2px',
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
      }}
    />
  );
}

function EditorialSelect({
  value, onChange, children,
}: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full appearance-none cursor-pointer text-[13px] px-3 py-2 pr-8 focus:outline-none"
        style={{
          backgroundColor: '#ffffff',
          color: INK,
          border: `1px solid ${RULE}`,
          borderRadius: '2px',
          fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
        }}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: INK_SOFT }} />
    </div>
  );
}

function SmgSkeleton() {
  return (
    <div className="mt-10 space-y-10">
      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <div className="h-3 w-40" style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '2px' }} />
          <div className="mt-4 h-[140px] w-56" style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '4px' }} />
          <div className="mt-6 h-[6px] w-full" style={{ backgroundColor: 'rgba(0,0,0,0.06)' }} />
        </div>
        <div className="h-[200px]" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
      </div>
      <div className="space-y-2.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 w-full" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
        ))}
      </div>
    </div>
  );
}
