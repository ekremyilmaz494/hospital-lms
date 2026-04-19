'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Check, ChevronDown, ChevronUp, BookOpen, Users as UsersIcon, AlertCircle } from 'lucide-react';
import { PremiumModal, PremiumModalFooter, PremiumButton } from './premium-modal';
import { useToast } from '@/components/shared/toast';

interface Training { id: string; title: string; category: string | null; }
interface Staff { id: string; name: string; department: string; }

interface BulkAssignModalProps {
  trainings: Training[];
  staff: Staff[];
  onClose: () => void;
  onSuccess: () => void;
}

type StepId = 'trainings' | 'staff' | 'review';

export function BulkAssignModal({
  trainings: trainingsFromProps,
  staff: staffFromProps,
  onClose,
  onSuccess,
}: BulkAssignModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<StepId>('trainings');

  const [fetchedTrainings, setFetchedTrainings] = useState<Training[] | null>(null);
  const [fetchedStaff, setFetchedStaff] = useState<Staff[] | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (trainingsFromProps.length > 0 && staffFromProps.length > 0) return;
    setDataLoading(true);
    Promise.all([
      trainingsFromProps.length === 0
        ? fetch('/api/admin/trainings?limit=100').then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
      staffFromProps.length === 0
        ? fetch('/api/admin/staff?limit=500').then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
    ]).then(([tData, sData]) => {
      if (tData?.trainings) setFetchedTrainings(tData.trainings.map((t: { id: string; title: string; category: string | null }) => ({ id: t.id, title: t.title, category: t.category })));
      if (sData?.staff) setFetchedStaff(sData.staff.map((s: { id: string; name: string; department: string }) => ({ id: s.id, name: s.name, department: s.department ?? '' })));
    }).finally(() => setDataLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const trainings = fetchedTrainings ?? trainingsFromProps;
  const staff = fetchedStaff ?? staffFromProps;

  const [selectedTrainings, setSelectedTrainings] = useState<Set<string>>(new Set());
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [trainingSearch, setTrainingSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [loading, setLoading] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const filteredTrainings = useMemo(
    () => trainings.filter(t => t.title.toLowerCase().includes(trainingSearch.toLowerCase())),
    [trainings, trainingSearch]
  );

  const filteredStaff = useMemo(
    () => staff.filter(
      s => s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
           s.department.toLowerCase().includes(staffSearch.toLowerCase())
    ),
    [staff, staffSearch]
  );

  // Departmana göre grupla — departman sırası: alfabetik (stable)
  const deptGroups = useMemo(() => {
    const groups = filteredStaff.reduce<Record<string, Staff[]>>((acc, s) => {
      const dept = s.department || 'Atanmamış';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(s);
      return acc;
    }, {});
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'tr'))
    );
  }, [filteredStaff]);

  const toggleTraining = (id: string) => setSelectedTrainings(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleStaff = (id: string) => setSelectedStaff(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleDept = (dept: string) => {
    const deptStaff = deptGroups[dept] ?? [];
    const allSelected = deptStaff.every(s => selectedStaff.has(s.id));
    setSelectedStaff(prev => {
      const next = new Set(prev);
      if (allSelected) {
        deptStaff.forEach(s => next.delete(s.id));
      } else {
        deptStaff.forEach(s => next.add(s.id));
      }
      return next;
    });
  };

  const selectAllTrainings = () => {
    const allIds = filteredTrainings.map(t => t.id);
    const allSelected = allIds.length > 0 && allIds.every(id => selectedTrainings.has(id));
    setSelectedTrainings(new Set(allSelected ? [] : allIds));
  };

  const handleAssign = async () => {
    if (selectedTrainings.size === 0 || selectedStaff.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingIds: Array.from(selectedTrainings),
          userIds: Array.from(selectedStaff),
          maxAttempts,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Atama başarısız');
      toast(
        `${data.created} atama oluşturuldu${data.skipped > 0 ? `, ${data.skipped} zaten mevcuttu` : ''}`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  const totalAssignments = selectedTrainings.size * selectedStaff.size;

  // Seçili eğitimleri/personelleri özet için hazırla
  const selectedTrainingsList = useMemo(
    () => trainings.filter(t => selectedTrainings.has(t.id)),
    [trainings, selectedTrainings]
  );
  const selectedStaffByDept = useMemo(() => {
    const list = staff.filter(s => selectedStaff.has(s.id));
    return list.reduce<Record<string, Staff[]>>((acc, s) => {
      const d = s.department || 'Atanmamış';
      if (!acc[d]) acc[d] = [];
      acc[d].push(s);
      return acc;
    }, {});
  }, [staff, selectedStaff]);

  const steps = [
    {
      id: 'trainings' as const,
      label: 'Eğitimler',
      caption: 'Ne atanacak?',
      complete: selectedTrainings.size > 0,
    },
    {
      id: 'staff' as const,
      label: 'Personel',
      caption: 'Kime atanacak?',
      complete: selectedStaff.size > 0,
    },
    {
      id: 'review' as const,
      label: 'Özet',
      caption: 'Onayla ve ata',
      complete: false,
    },
  ];

  const handleStepChange = (id: string) => {
    if (id === 'staff' && selectedTrainings.size === 0) {
      toast('Önce en az bir eğitim seçin', 'warning');
      return;
    }
    if (id === 'review' && (selectedTrainings.size === 0 || selectedStaff.size === 0)) {
      toast('Önce eğitim ve personel seçin', 'warning');
      return;
    }
    setStep(id as StepId);
  };

  return (
    <PremiumModal
      isOpen
      onClose={onClose}
      eyebrow="Toplu İşlem"
      title="Eğitim Atama"
      subtitle="Birden fazla personele aynı anda eğitim tanımlayın. Her adım kaydedilir."
      steps={steps}
      activeStep={step}
      onStepChange={handleStepChange}
      size="xl"
      disableEscape={loading}
      footer={
        <PremiumModalFooter
          summary={
            <span className="bam-summary">
              <b>{selectedTrainings.size.toString().padStart(2, '0')}</b> eğitim
              <span className="bam-dot" aria-hidden>·</span>
              <b>{selectedStaff.size.toString().padStart(2, '0')}</b> personel
              {totalAssignments > 0 && (
                <>
                  <span className="bam-dot" aria-hidden>·</span>
                  <span className="bam-accent">
                    <b>{totalAssignments.toString()}</b> atama oluşacak
                  </span>
                </>
              )}
            </span>
          }
          actions={
            step === 'trainings' ? (
              <>
                <PremiumButton variant="ghost" onClick={onClose}>İptal</PremiumButton>
                <PremiumButton
                  disabled={selectedTrainings.size === 0}
                  onClick={() => setStep('staff')}
                >
                  Personel Seç
                </PremiumButton>
              </>
            ) : step === 'staff' ? (
              <>
                <PremiumButton variant="ghost" onClick={() => setStep('trainings')}>Geri</PremiumButton>
                <PremiumButton
                  disabled={selectedStaff.size === 0}
                  onClick={() => setStep('review')}
                >
                  Özeti İncele
                </PremiumButton>
              </>
            ) : (
              <>
                <PremiumButton variant="ghost" onClick={() => setStep('staff')} disabled={loading}>
                  Geri
                </PremiumButton>
                <PremiumButton
                  loading={loading}
                  disabled={totalAssignments === 0}
                  onClick={handleAssign}
                  icon={<Check className="h-4 w-4" strokeWidth={2} />}
                >
                  {totalAssignments} Atamayı Onayla
                </PremiumButton>
              </>
            )
          }
        />
      }
    >
      {dataLoading ? (
        <div className="bam-loading">
          <div className="bam-spinner" aria-hidden />
          <p>Veriler yükleniyor…</p>
        </div>
      ) : (
        <>
          {/* ─────── STEP 1: EĞİTİMLER ─────── */}
          {step === 'trainings' && (
            <div className="bam-step" key="trainings">
              <div className="bam-toolbar">
                <div className="bam-search">
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                  <input
                    value={trainingSearch}
                    onChange={e => setTrainingSearch(e.target.value)}
                    placeholder="Eğitim başlığında ara…"
                    aria-label="Eğitim ara"
                  />
                </div>
                <button
                  type="button"
                  onClick={selectAllTrainings}
                  className="bam-chip"
                  disabled={filteredTrainings.length === 0}
                >
                  {filteredTrainings.length > 0 && filteredTrainings.every(t => selectedTrainings.has(t.id))
                    ? 'Tümünü kaldır'
                    : 'Tümünü seç'}
                </button>
              </div>

              {filteredTrainings.length === 0 ? (
                <div className="bam-empty">
                  <BookOpen className="h-6 w-6" strokeWidth={1.25} />
                  <p>{trainings.length === 0 ? 'Henüz eğitim oluşturulmamış' : 'Arama sonucu yok'}</p>
                  {trainings.length === 0 && (
                    <small>Toplu atama için önce eğitim kütüphanesine içerik ekleyin.</small>
                  )}
                </div>
              ) : (
                <ul className="bam-list">
                  {filteredTrainings.map((t, i) => {
                    const selected = selectedTrainings.has(t.id);
                    return (
                      <li key={t.id} style={{ animationDelay: `${Math.min(i * 18, 300)}ms` }}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleTraining(t.id)}
                          className={`bam-row ${selected ? 'bam-row-selected' : ''}`}
                        >
                          <span className={`bam-check ${selected ? 'bam-check-on' : ''}`} aria-hidden>
                            {selected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                          </span>
                          <span className="bam-row-main">
                            <span className="bam-row-title">{t.title}</span>
                            {t.category && <span className="bam-row-meta">{t.category}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ─────── STEP 2: PERSONEL ─────── */}
          {step === 'staff' && (
            <div className="bam-step" key="staff">
              <div className="bam-toolbar">
                <div className="bam-search">
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                  <input
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    placeholder="Personel veya departman ara…"
                    aria-label="Personel ara"
                  />
                </div>
                <span className="bam-hint">
                  <b>{Object.keys(deptGroups).length.toString().padStart(2, '0')}</b> departman
                </span>
              </div>

              {Object.keys(deptGroups).length === 0 ? (
                <div className="bam-empty">
                  <UsersIcon className="h-6 w-6" strokeWidth={1.25} />
                  <p>Sonuç bulunamadı</p>
                </div>
              ) : (
                <ul className="bam-dept-list">
                  {Object.entries(deptGroups).map(([dept, members], i) => {
                    const allSelected = members.every(s => selectedStaff.has(s.id));
                    const someSelected = members.some(s => selectedStaff.has(s.id));
                    const selectedCount = members.filter(s => selectedStaff.has(s.id)).length;
                    const isExpanded = expandedDepts.has(dept);
                    return (
                      <li key={dept} style={{ animationDelay: `${Math.min(i * 24, 300)}ms` }}>
                        <div className={`bam-dept ${someSelected ? 'bam-dept-active' : ''}`}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                            onClick={() => toggleDept(dept)}
                            className={`bam-check bam-check-dept ${allSelected ? 'bam-check-on' : someSelected ? 'bam-check-mixed' : ''}`}
                            aria-label={`${dept} departmanının tümünü seç`}
                          >
                            {allSelected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                            {someSelected && !allSelected && <span className="bam-check-dash" aria-hidden />}
                          </button>
                          <button
                            type="button"
                            className="bam-dept-main"
                            onClick={() => setExpandedDepts(prev => {
                              const n = new Set(prev);
                              if (n.has(dept)) n.delete(dept); else n.add(dept);
                              return n;
                            })}
                            aria-expanded={isExpanded}
                          >
                            <span className="bam-dept-name">{dept}</span>
                            <span className="bam-dept-count">
                              <b>{selectedCount.toString().padStart(2, '0')}</b>
                              <span className="bam-dept-slash">/</span>
                              {members.length.toString().padStart(2, '0')}
                            </span>
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                              : <ChevronDown className="h-4 w-4" strokeWidth={1.5} />}
                          </button>
                        </div>
                        {isExpanded && (
                          <ul className="bam-staff-list">
                            {members.map(s => {
                              const sel = selectedStaff.has(s.id);
                              return (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={sel}
                                    onClick={() => toggleStaff(s.id)}
                                    className={`bam-staff ${sel ? 'bam-staff-selected' : ''}`}
                                  >
                                    <span className={`bam-check bam-check-sm ${sel ? 'bam-check-on' : ''}`} aria-hidden>
                                      {sel && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                                    </span>
                                    <span>{s.name}</span>
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* ─────── STEP 3: ÖZET ─────── */}
          {step === 'review' && (
            <div className="bam-step" key="review">
              <div className="bam-review-hero">
                <span className="bam-eyebrow-sm">Onay Bekliyor</span>
                <h3 className="bam-review-title">
                  <em>{totalAssignments}</em> yeni atama oluşturulacak
                </h3>
                <p className="bam-review-sub">
                  {selectedTrainings.size} eğitim, {selectedStaff.size} personele atanacak.
                  Personel başına her eğitim için{' '}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxAttempts}
                    onChange={e => setMaxAttempts(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    className="bam-attempts"
                    aria-label="Deneme hakkı"
                  />{' '}
                  deneme hakkı tanımlanacak.
                </p>
              </div>

              <div className="bam-review-warn">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.8} />
                <span>
                  Zaten var olan atamalar atlanır, yenileri eklenir. Bu işlem geri alınamaz —
                  personele bildirim gönderilecek.
                </span>
              </div>

              <div className="bam-review-grid">
                <section>
                  <h4>Eğitimler</h4>
                  <ul className="bam-review-list">
                    {selectedTrainingsList.map(t => (
                      <li key={t.id}>
                        <span className="bam-bullet" aria-hidden />
                        <span>{t.title}</span>
                        {t.category && <em>{t.category}</em>}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4>Personel <span className="bam-review-count">({selectedStaff.size})</span></h4>
                  <ul className="bam-review-list">
                    {Object.entries(selectedStaffByDept).map(([dept, members]) => (
                      <li key={dept} className="bam-review-dept">
                        <span className="bam-review-deptname">{dept}</span>
                        <span className="bam-review-deptcount">
                          {members.length.toString().padStart(2, '0')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            </div>
          )}
        </>
      )}

      <style jsx>{`
        .bam-step {
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 360px;
        }

        /* ───── Toolbar ───── */
        .bam-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .bam-search {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          height: 42px;
          background: #fff;
          border: 1px solid #ebe7df;
          border-radius: 12px;
          color: #8a8578;
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }
        .bam-search:focus-within {
          border-color: #0a0a0a;
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.04);
        }
        .bam-search input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-family: var(--font-display, system-ui);
          font-size: 13.5px;
          color: #0a0a0a;
        }
        .bam-search input::placeholder {
          color: #a7a296;
        }
        .bam-chip {
          padding: 8px 14px;
          background: transparent;
          border: 1px solid #d9d4c4;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 500;
          color: #0a0a0a;
          cursor: pointer;
          transition: background 160ms ease, border-color 160ms ease;
          white-space: nowrap;
        }
        .bam-chip:hover:not(:disabled) {
          background: rgba(15, 23, 42, 0.03);
          border-color: #b8b1a0;
        }
        .bam-chip:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .bam-hint {
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          color: #8a8578;
          font-variant-numeric: tabular-nums;
          padding: 0 12px;
        }
        .bam-hint b {
          font-weight: 600;
          color: #0a0a0a;
        }

        /* ───── Checkbox ───── */
        .bam-check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          border-radius: 5px;
          border: 1.5px solid #cdc6b4;
          background: #fff;
          color: #fff;
          flex-shrink: 0;
          transition: background 160ms ease, border-color 160ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .bam-check-on {
          background: var(--color-primary);
          border-color: var(--color-primary);
        }
        .bam-check-mixed {
          background: rgba(13, 150, 104, 0.15);
          border-color: var(--color-primary);
        }
        .bam-check-dash {
          width: 8px;
          height: 1.5px;
          background: var(--color-primary);
          border-radius: 1px;
        }
        .bam-check-sm {
          width: 15px;
          height: 15px;
          border-radius: 4px;
        }
        .bam-check-dept {
          margin: 14px 0 14px 16px;
          cursor: pointer;
        }

        /* ───── Training list ───── */
        .bam-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bam-list li {
          animation: bam-fade-up 340ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }
        .bam-row {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 16px;
          background: #fff;
          border: 1px solid #ebe7df;
          border-radius: 12px;
          cursor: pointer;
          text-align: left;
          transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
        }
        .bam-row:hover {
          border-color: #cdc6b4;
        }
        .bam-row-selected {
          background: #fffefa;
          border-color: var(--color-primary);
          box-shadow: inset 0 0 0 1px var(--color-primary);
        }
        .bam-row-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }
        .bam-row-title {
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 500;
          color: #0a0a0a;
          letter-spacing: -0.005em;
          line-height: 1.35;
        }
        .bam-row-meta {
          font-family: var(--font-display, system-ui);
          font-size: 11.5px;
          color: #8a8578;
          margin-top: 3px;
          letter-spacing: 0.01em;
        }

        /* ───── Department list ───── */
        .bam-dept-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .bam-dept-list > li {
          animation: bam-fade-up 340ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
        }
        .bam-dept {
          display: flex;
          align-items: stretch;
          background: #fff;
          border: 1px solid #ebe7df;
          border-radius: 12px;
          overflow: hidden;
          transition: border-color 160ms ease;
        }
        .bam-dept:hover {
          border-color: #cdc6b4;
        }
        .bam-dept-active {
          border-color: var(--color-primary);
          background: #fffefa;
        }
        .bam-dept-main {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px 12px 4px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
        }
        .bam-dept-name {
          flex: 1;
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 600;
          color: #0a0a0a;
          letter-spacing: -0.005em;
        }
        .bam-dept-count {
          font-family: var(--font-mono, monospace);
          font-size: 11.5px;
          color: #8a8578;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.02em;
        }
        .bam-dept-count b {
          font-weight: 500;
          color: #0a0a0a;
        }
        .bam-dept-slash {
          margin: 0 2px;
          opacity: 0.5;
        }
        .bam-staff-list {
          list-style: none;
          padding: 0;
          margin: 0;
          border-top: 1px solid #ebe7df;
        }
        .bam-staff {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 16px 10px 38px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          color: #0a0a0a;
          transition: background 140ms ease;
        }
        .bam-staff:hover {
          background: rgba(15, 23, 42, 0.025);
        }
        .bam-staff-selected {
          background: rgba(13, 150, 104, 0.04);
        }

        /* ───── Review step ───── */
        .bam-review-hero {
          padding: 20px 0 24px;
          border-bottom: 1px solid #ebe7df;
        }
        .bam-eyebrow-sm {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-primary);
        }
        .bam-review-title {
          font-family: var(--font-editorial, Georgia, serif);
          font-size: 30px;
          font-weight: 400;
          line-height: 1.15;
          letter-spacing: -0.02em;
          color: #0a0a0a;
          margin: 8px 0 8px;
          font-variation-settings: 'opsz' 48;
        }
        .bam-review-title em {
          font-style: italic;
          font-weight: 500;
          color: var(--color-primary);
          font-variant-numeric: tabular-nums;
        }
        .bam-review-sub {
          font-family: var(--font-display, system-ui);
          font-size: 13.5px;
          line-height: 1.6;
          color: #4a4a42;
          margin: 0;
        }
        .bam-attempts {
          width: 44px;
          padding: 2px 6px;
          margin: 0 2px;
          border: none;
          border-bottom: 1.5px solid var(--color-primary);
          background: transparent;
          text-align: center;
          font-family: var(--font-mono, monospace);
          font-size: 14px;
          font-weight: 600;
          color: var(--color-primary);
          font-variant-numeric: tabular-nums;
          outline: none;
        }
        .bam-attempts::-webkit-inner-spin-button,
        .bam-attempts::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .bam-review-warn {
          display: flex;
          gap: 10px;
          padding: 12px 16px;
          margin: 18px 0 20px;
          background: rgba(245, 158, 11, 0.06);
          border: 1px solid rgba(245, 158, 11, 0.22);
          border-radius: 10px;
          color: #78551a;
          font-family: var(--font-display, system-ui);
          font-size: 12.5px;
          line-height: 1.55;
        }
        .bam-review-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 28px;
        }
        @media (min-width: 680px) {
          .bam-review-grid {
            grid-template-columns: 1.2fr 1fr;
          }
        }
        .bam-review-grid section h4 {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #8a8578;
          margin: 0 0 12px;
        }
        .bam-review-count {
          font-weight: 500;
          color: #4a4a42;
          letter-spacing: 0;
        }
        .bam-review-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 240px;
          overflow-y: auto;
        }
        .bam-review-list li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 0;
          border-bottom: 1px solid #f0ece3;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          color: #1a1a1a;
        }
        .bam-review-list li em {
          margin-left: auto;
          font-style: normal;
          font-size: 11px;
          color: #8a8578;
          letter-spacing: 0.02em;
        }
        .bam-bullet {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-primary);
          flex-shrink: 0;
        }
        .bam-review-dept {
          justify-content: space-between;
        }
        .bam-review-deptname {
          font-weight: 500;
        }
        .bam-review-deptcount {
          font-family: var(--font-mono, monospace);
          font-size: 12px;
          color: #0a0a0a;
          font-variant-numeric: tabular-nums;
          background: rgba(13, 150, 104, 0.08);
          padding: 2px 8px;
          border-radius: 999px;
        }

        /* ───── Empty state ───── */
        .bam-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
          color: #8a8578;
        }
        .bam-empty p {
          margin: 12px 0 4px;
          font-family: var(--font-display, system-ui);
          font-size: 14px;
          font-weight: 500;
          color: #0a0a0a;
        }
        .bam-empty small {
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          line-height: 1.5;
          color: #8a8578;
          max-width: 280px;
        }

        /* ───── Loading ───── */
        .bam-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 80px 20px;
          color: #8a8578;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
        }
        .bam-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid #ebe7df;
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: bam-spin 700ms linear infinite;
        }
        @keyframes bam-spin {
          to { transform: rotate(360deg); }
        }

        /* ───── Footer summary ───── */
        .bam-summary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-variant-numeric: tabular-nums;
        }
        .bam-summary b {
          font-weight: 600;
          color: #0a0a0a;
        }
        .bam-dot {
          color: #c9c4b4;
        }
        .bam-accent {
          color: var(--color-primary);
          font-weight: 500;
        }

        /* ───── Animations ───── */
        @keyframes bam-fade-up {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .bam-list li,
          .bam-dept-list > li {
            animation: none;
          }
          .bam-spinner {
            animation-duration: 2s;
          }
        }
      `}</style>
    </PremiumModal>
  );
}
