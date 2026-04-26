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

// ─── Klinova palette (sabit hex, Tailwind v4 cache'den bağımsız) ───
const K = {
  PRIMARY: '#0d9668',
  PRIMARY_HOVER: '#087a54',
  PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff',
  SURFACE_HOVER: '#f5f5f4',
  BG: '#fafaf9',
  BORDER: '#c9c4be',
  BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917',
  TEXT_SECONDARY: '#44403c',
  TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981',
  SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b',
  WARNING_BG: '#fef3c7',
  ERROR: '#ef4444',
  ERROR_BG: '#fee2e2',
  INFO: '#3b82f6',
  INFO_BG: '#dbeafe',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
} as const;

const FONT_DISPLAY = 'var(--font-display, system-ui)';

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

  // ─── Reusable inline style objects (Klinova) ───
  const cardBase: React.CSSProperties = {
    background: K.SURFACE,
    border: `1.5px solid ${K.BORDER}`,
    borderRadius: 14,
    transition: 'border-color 160ms ease, background 160ms ease, transform 160ms ease',
  };

  const inputBase: React.CSSProperties = {
    height: 40,
    border: `1.5px solid ${K.BORDER}`,
    borderRadius: 10,
    background: K.SURFACE,
    color: K.TEXT_PRIMARY,
    fontFamily: FONT_DISPLAY,
    fontSize: 13.5,
    outline: 'none',
    transition: 'border-color 160ms ease, box-shadow 160ms ease',
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
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: FONT_DISPLAY, fontSize: 13, color: K.TEXT_SECONDARY, fontVariantNumeric: 'tabular-nums' }}>
              <b style={{ fontWeight: 600, color: K.TEXT_PRIMARY }}>{selectedTrainings.size.toString().padStart(2, '0')}</b> eğitim
              <span style={{ color: K.BORDER }} aria-hidden>·</span>
              <b style={{ fontWeight: 600, color: K.TEXT_PRIMARY }}>{selectedStaff.size.toString().padStart(2, '0')}</b> personel
              {totalAssignments > 0 && (
                <>
                  <span style={{ color: K.BORDER }} aria-hidden>·</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 10px',
                    background: K.PRIMARY,
                    color: '#fff',
                    borderRadius: 999,
                    fontWeight: 500,
                    fontSize: 12,
                  }}>
                    <b style={{ fontWeight: 700 }}>{totalAssignments.toString()}</b> atama
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: '80px 20px',
          color: K.TEXT_MUTED,
          fontFamily: FONT_DISPLAY,
          fontSize: 13,
        }}>
          <div
            aria-hidden
            style={{
              width: 24,
              height: 24,
              border: `2px solid ${K.BORDER_LIGHT}`,
              borderTopColor: K.PRIMARY,
              borderRadius: '50%',
              animation: 'bam-spin 700ms linear infinite',
            }}
          />
          <p>Veriler yükleniyor…</p>
        </div>
      ) : (
        <>
          {/* ─────── STEP 1: EĞİTİMLER ─────── */}
          {step === 'trainings' && (
            <div key="trainings" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 360 }}>
              {/* Toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="bam-search-wrap" style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px',
                  ...inputBase,
                  color: K.TEXT_MUTED,
                }}>
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                  <input
                    value={trainingSearch}
                    onChange={e => setTrainingSearch(e.target.value)}
                    placeholder="Eğitim başlığında ara…"
                    aria-label="Eğitim ara"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontFamily: FONT_DISPLAY,
                      fontSize: 13.5,
                      color: K.TEXT_PRIMARY,
                      height: '100%',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={selectAllTrainings}
                  disabled={filteredTrainings.length === 0}
                  style={{
                    padding: '0 14px',
                    height: 38,
                    background: 'transparent',
                    border: `1.5px solid ${K.BORDER}`,
                    borderRadius: 999,
                    fontFamily: FONT_DISPLAY,
                    fontSize: 12,
                    fontWeight: 500,
                    color: K.TEXT_PRIMARY,
                    cursor: filteredTrainings.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: filteredTrainings.length === 0 ? 0.4 : 1,
                    transition: 'background 160ms ease, border-color 160ms ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (filteredTrainings.length === 0) return;
                    e.currentTarget.style.background = K.SURFACE_HOVER;
                    e.currentTarget.style.borderColor = K.PRIMARY;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = K.BORDER;
                  }}
                >
                  {filteredTrainings.length > 0 && filteredTrainings.every(t => selectedTrainings.has(t.id))
                    ? 'Tümünü kaldır'
                    : 'Tümünü seç'}
                </button>
              </div>

              {filteredTrainings.length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  textAlign: 'center',
                  color: K.TEXT_MUTED,
                }}>
                  <BookOpen className="h-6 w-6" strokeWidth={1.25} />
                  <p style={{ margin: '12px 0 4px', fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 500, color: K.TEXT_PRIMARY }}>
                    {trainings.length === 0 ? 'Henüz eğitim oluşturulmamış' : 'Arama sonucu yok'}
                  </p>
                  {trainings.length === 0 && (
                    <small style={{ fontFamily: FONT_DISPLAY, fontSize: 12, lineHeight: 1.5, color: K.TEXT_MUTED, maxWidth: 280 }}>
                      Toplu atama için önce eğitim kütüphanesine içerik ekleyin.
                    </small>
                  )}
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filteredTrainings.map((t) => {
                    const selected = selectedTrainings.has(t.id);
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleTraining(t.id)}
                          style={{
                            ...cardBase,
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 14,
                            padding: '12px 14px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            borderColor: selected ? K.PRIMARY : K.BORDER,
                            background: selected ? K.PRIMARY_LIGHT : K.SURFACE,
                          }}
                          onMouseEnter={(e) => {
                            if (selected) return;
                            e.currentTarget.style.borderColor = K.PRIMARY;
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            if (selected) return;
                            e.currentTarget.style.borderColor = K.BORDER;
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          <CheckBox selected={selected} />
                          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{
                              fontFamily: FONT_DISPLAY,
                              fontSize: 14,
                              fontWeight: 500,
                              color: K.TEXT_PRIMARY,
                              lineHeight: 1.35,
                            }}>{t.title}</span>
                            {t.category && (
                              <span style={{
                                fontFamily: FONT_DISPLAY,
                                fontSize: 11.5,
                                color: K.TEXT_MUTED,
                                marginTop: 3,
                              }}>{t.category}</span>
                            )}
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
            <div key="staff" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 360 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px',
                  ...inputBase,
                  color: K.TEXT_MUTED,
                }}>
                  <Search className="h-4 w-4" strokeWidth={1.5} />
                  <input
                    value={staffSearch}
                    onChange={e => setStaffSearch(e.target.value)}
                    placeholder="Personel veya departman ara…"
                    aria-label="Personel ara"
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      fontFamily: FONT_DISPLAY,
                      fontSize: 13.5,
                      color: K.TEXT_PRIMARY,
                      height: '100%',
                    }}
                  />
                </div>
                <span style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 12,
                  color: K.TEXT_MUTED,
                  fontVariantNumeric: 'tabular-nums',
                  padding: '0 12px',
                }}>
                  <b style={{ fontWeight: 600, color: K.TEXT_PRIMARY }}>
                    {Object.keys(deptGroups).length.toString().padStart(2, '0')}
                  </b> departman
                </span>
              </div>

              {Object.keys(deptGroups).length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '60px 20px',
                  textAlign: 'center',
                  color: K.TEXT_MUTED,
                }}>
                  <UsersIcon className="h-6 w-6" strokeWidth={1.25} />
                  <p style={{ margin: '12px 0 4px', fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 500, color: K.TEXT_PRIMARY }}>
                    Sonuç bulunamadı
                  </p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(deptGroups).map(([dept, members]) => {
                    const allSelected = members.every(s => selectedStaff.has(s.id));
                    const someSelected = members.some(s => selectedStaff.has(s.id));
                    const selectedCount = members.filter(s => selectedStaff.has(s.id)).length;
                    const isExpanded = expandedDepts.has(dept);
                    return (
                      <li key={dept}>
                        <div style={{
                          ...cardBase,
                          display: 'flex',
                          alignItems: 'stretch',
                          overflow: 'hidden',
                          borderColor: someSelected ? K.PRIMARY : K.BORDER,
                          background: someSelected ? K.PRIMARY_LIGHT : K.SURFACE,
                        }}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                            onClick={() => toggleDept(dept)}
                            aria-label={`${dept} departmanının tümünü seç`}
                            style={{
                              margin: '14px 0 14px 14px',
                              cursor: 'pointer',
                              background: 'transparent',
                              border: 'none',
                              padding: 0,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CheckBox selected={allSelected} mixed={someSelected && !allSelected} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setExpandedDepts(prev => {
                              const n = new Set(prev);
                              if (n.has(dept)) n.delete(dept); else n.add(dept);
                              return n;
                            })}
                            aria-expanded={isExpanded}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              padding: '12px 14px 12px 8px',
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              textAlign: 'left',
                              color: K.TEXT_PRIMARY,
                            }}
                          >
                            <span style={{
                              flex: 1,
                              fontFamily: FONT_DISPLAY,
                              fontSize: 14,
                              fontWeight: 600,
                              color: K.TEXT_PRIMARY,
                            }}>{dept}</span>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 10px',
                              borderRadius: 999,
                              background: someSelected ? K.PRIMARY : K.BORDER_LIGHT,
                              color: someSelected ? '#fff' : K.TEXT_SECONDARY,
                              fontSize: 11.5,
                              fontWeight: 600,
                              fontVariantNumeric: 'tabular-nums',
                            }}>
                              {selectedCount.toString().padStart(2, '0')}
                              <span style={{ margin: '0 3px', opacity: 0.6 }}>/</span>
                              {members.length.toString().padStart(2, '0')}
                            </span>
                            {isExpanded
                              ? <ChevronUp className="h-4 w-4" strokeWidth={1.5} />
                              : <ChevronDown className="h-4 w-4" strokeWidth={1.5} />}
                          </button>
                        </div>
                        {isExpanded && (
                          <ul style={{
                            listStyle: 'none',
                            padding: 0,
                            margin: '6px 0 0 0',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            paddingLeft: 16,
                          }}>
                            {members.map(s => {
                              const sel = selectedStaff.has(s.id);
                              return (
                                <li key={s.id}>
                                  <button
                                    type="button"
                                    role="checkbox"
                                    aria-checked={sel}
                                    onClick={() => toggleStaff(s.id)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 12,
                                      width: '100%',
                                      padding: '8px 12px',
                                      background: sel ? K.PRIMARY_LIGHT : 'transparent',
                                      border: `1.5px solid ${sel ? K.PRIMARY : 'transparent'}`,
                                      borderRadius: 10,
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      fontFamily: FONT_DISPLAY,
                                      fontSize: 13,
                                      color: K.TEXT_PRIMARY,
                                      transition: 'background 140ms ease, border-color 140ms ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (sel) return;
                                      e.currentTarget.style.background = K.SURFACE_HOVER;
                                    }}
                                    onMouseLeave={(e) => {
                                      if (sel) return;
                                      e.currentTarget.style.background = 'transparent';
                                    }}
                                  >
                                    <CheckBox selected={sel} small />
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
            <div key="review" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 360 }}>
              <div style={{ padding: '8px 0 20px', borderBottom: `1px solid ${K.BORDER_LIGHT}` }}>
                <span style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  background: K.PRIMARY_LIGHT,
                  color: K.PRIMARY,
                  borderRadius: 999,
                  fontFamily: FONT_DISPLAY,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  Onay Bekliyor
                </span>
                <h3 style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 26,
                  fontWeight: 600,
                  lineHeight: 1.2,
                  letterSpacing: '-0.015em',
                  color: K.TEXT_PRIMARY,
                  margin: '12px 0 8px',
                }}>
                  <span style={{ color: K.PRIMARY, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{totalAssignments}</span>
                  {' '}yeni atama oluşturulacak
                </h3>
                <p style={{
                  fontFamily: FONT_DISPLAY,
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: K.TEXT_SECONDARY,
                  margin: 0,
                }}>
                  {selectedTrainings.size} eğitim, {selectedStaff.size} personele atanacak.
                  Personel başına her eğitim için{' '}
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxAttempts}
                    onChange={e => setMaxAttempts(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    aria-label="Deneme hakkı"
                    style={{
                      width: 56,
                      height: 32,
                      padding: '0 8px',
                      margin: '0 4px',
                      border: `1.5px solid ${K.PRIMARY}`,
                      borderRadius: 8,
                      background: K.SURFACE,
                      textAlign: 'center',
                      fontFamily: FONT_DISPLAY,
                      fontSize: 13,
                      fontWeight: 600,
                      color: K.PRIMARY,
                      fontVariantNumeric: 'tabular-nums',
                      outline: 'none',
                    }}
                  />{' '}
                  deneme hakkı tanımlanacak.
                </p>
              </div>

              <div style={{
                display: 'flex',
                gap: 10,
                padding: '12px 14px',
                background: K.WARNING_BG,
                border: `1.5px solid ${K.WARNING}`,
                borderRadius: 10,
                color: K.TEXT_PRIMARY,
                fontFamily: FONT_DISPLAY,
                fontSize: 12.5,
                lineHeight: 1.55,
              }}>
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.8} style={{ color: K.WARNING }} />
                <span>
                  Zaten var olan atamalar atlanır, yenileri eklenir. Bu işlem geri alınamaz —
                  personele bildirim gönderilecek.
                </span>
              </div>

              <div className="bam-review-grid" style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 24,
              }}>
                <section>
                  <h4 style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: K.TEXT_MUTED,
                    margin: '0 0 12px',
                  }}>Eğitimler</h4>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}>
                    {selectedTrainingsList.map(t => (
                      <li key={t.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        background: K.SURFACE,
                        border: `1.5px solid ${K.BORDER_LIGHT}`,
                        borderRadius: 10,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 13,
                        color: K.TEXT_PRIMARY,
                      }}>
                        <span aria-hidden style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: K.PRIMARY,
                          flexShrink: 0,
                        }} />
                        <span style={{ flex: 1 }}>{t.title}</span>
                        {t.category && (
                          <em style={{
                            fontStyle: 'normal',
                            fontSize: 11,
                            color: K.TEXT_MUTED,
                            padding: '2px 8px',
                            background: K.SURFACE_HOVER,
                            borderRadius: 999,
                          }}>{t.category}</em>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
                <section>
                  <h4 style={{
                    fontFamily: FONT_DISPLAY,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    color: K.TEXT_MUTED,
                    margin: '0 0 12px',
                  }}>
                    Personel <span style={{ fontWeight: 500, color: K.TEXT_SECONDARY, letterSpacing: 0, textTransform: 'none' }}>({selectedStaff.size})</span>
                  </h4>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    maxHeight: 240,
                    overflowY: 'auto',
                  }}>
                    {Object.entries(selectedStaffByDept).map(([dept, members]) => (
                      <li key={dept} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        background: K.SURFACE,
                        border: `1.5px solid ${K.BORDER_LIGHT}`,
                        borderRadius: 10,
                        fontFamily: FONT_DISPLAY,
                        fontSize: 13,
                        color: K.TEXT_PRIMARY,
                      }}>
                        <span style={{ fontWeight: 500 }}>{dept}</span>
                        <span style={{
                          fontFamily: FONT_DISPLAY,
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#fff',
                          background: K.PRIMARY,
                          padding: '2px 10px',
                          borderRadius: 999,
                          fontVariantNumeric: 'tabular-nums',
                        }}>
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
        @keyframes bam-spin {
          to { transform: rotate(360deg); }
        }
        @media (min-width: 680px) {
          :global(.bam-review-grid) {
            grid-template-columns: 1.2fr 1fr !important;
          }
        }
        .bam-search-wrap:focus-within {
          border-color: ${K.PRIMARY} !important;
          box-shadow: 0 0 0 3px rgba(13, 150, 104, 0.15);
        }
      `}</style>
    </PremiumModal>
  );
}

// ─── Reusable check box (Klinova emerald) ───
function CheckBox({ selected, mixed, small }: { selected: boolean; mixed?: boolean; small?: boolean }) {
  const size = small ? 16 : 20;
  return (
    <span
      aria-hidden
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: small ? 5 : 6,
        border: `1.5px solid ${selected || mixed ? '#0d9668' : '#c9c4be'}`,
        background: selected ? '#0d9668' : mixed ? 'rgba(13, 150, 104, 0.18)' : '#ffffff',
        color: '#fff',
        flexShrink: 0,
        transition: 'background 160ms ease, border-color 160ms ease',
      }}
    >
      {selected && <Check className={small ? 'h-2.5 w-2.5' : 'h-3 w-3'} strokeWidth={2.8} />}
      {mixed && !selected && (
        <span style={{ width: 8, height: 1.5, background: '#0d9668', borderRadius: 1 }} />
      )}
    </span>
  );
}
