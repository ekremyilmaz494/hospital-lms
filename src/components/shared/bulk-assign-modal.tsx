'use client';

import { useState, useEffect } from 'react';
import { X, Search, GraduationCap, Users, Check, Loader2, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';

interface Training { id: string; title: string; category: string | null; }
interface Staff { id: string; name: string; department: string; }

interface BulkAssignModalProps {
  trainings: Training[];
  staff: Staff[];
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkAssignModal({ trainings: trainingsFromProps, staff: staffFromProps, onClose, onSuccess }: BulkAssignModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);

  // Props boş gelirse kendi fetch'ini yap
  const [fetchedTrainings, setFetchedTrainings] = useState<Training[] | null>(null);
  const [fetchedStaff, setFetchedStaff] = useState<Staff[] | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (trainingsFromProps.length > 0 && staffFromProps.length > 0) return; // props yeterliyse skip
    setDataLoading(true);
    Promise.all([
      trainingsFromProps.length === 0
        ? fetch('/api/admin/trainings?limit=100').then(r => r.ok ? r.json() : null).catch(() => null)
        : Promise.resolve(null),
      staffFromProps.length === 0
        ? fetch('/api/admin/staff?limit=200').then(r => r.ok ? r.json() : null).catch(() => null)
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

  const filteredTrainings = trainings.filter(t => t.title.toLowerCase().includes(trainingSearch.toLowerCase()));
  const filteredStaff = staff.filter(s => s.name.toLowerCase().includes(staffSearch.toLowerCase()) || s.department.toLowerCase().includes(staffSearch.toLowerCase()));

  // Personeli departmana göre grupla
  const deptGroups = filteredStaff.reduce<Record<string, Staff[]>>((acc, s) => {
    const dept = s.department || 'Diğer';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(s);
    return acc;
  }, {});

  const toggleTraining = (id: string) => setSelectedTrainings(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleStaff = (id: string) => setSelectedStaff(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleDept = (dept: string) => {
    const deptStaff = deptGroups[dept] ?? [];
    const allSelected = deptStaff.every(s => selectedStaff.has(s.id));
    setSelectedStaff(prev => {
      const next = new Set(prev);
      allSelected ? deptStaff.forEach(s => next.delete(s.id)) : deptStaff.forEach(s => next.add(s.id));
      return next;
    });
  };

  const selectAllTrainings = () => {
    const allIds = filteredTrainings.map(t => t.id);
    const allSelected = allIds.every(id => selectedTrainings.has(id));
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
      toast(`${data.created} atama oluşturuldu${data.skipped > 0 ? `, ${data.skipped} zaten mevcuttu` : ''}`, 'success');
      onSuccess();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-3xl rounded-2xl flex flex-col" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-xl)', maxHeight: '90vh' }}>
        {/* Başlık */}
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h3 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>Toplu Eğitim Atama</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {step === 1 ? 'Eğitimleri seçin' : 'Personeli seçin'}
            </p>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step göstergesi */}
        <div className="flex px-6 pt-4 gap-2">
          {[{ n: 1, label: 'Eğitimler', icon: GraduationCap }, { n: 2, label: 'Personel', icon: Users }].map(s => (
            <button key={s.n} type="button" onClick={() => s.n < step || (s.n === 2 && selectedTrainings.size > 0) ? setStep(s.n as 1 | 2) : null}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: step === s.n ? 'var(--color-primary)' : 'var(--color-bg)', color: step === s.n ? 'white' : 'var(--color-text-muted)', border: `1px solid ${step === s.n ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
              <s.icon className="h-4 w-4" />
              {s.label}
              {s.n === 1 && selectedTrainings.size > 0 && <span className="rounded-full px-1.5 py-0.5 text-xs font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>{selectedTrainings.size}</span>}
              {s.n === 2 && selectedStaff.size > 0 && <span className="rounded-full px-1.5 py-0.5 text-xs font-bold" style={{ background: 'rgba(255,255,255,0.25)' }}>{selectedStaff.size}</span>}
            </button>
          ))}
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto p-6">
          {dataLoading && (
            <div className="flex items-center justify-center py-12 gap-3">
              <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
              <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Veriler yükleniyor…</span>
            </div>
          )}
          {!dataLoading && <>
          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                  <Input value={trainingSearch} onChange={e => setTrainingSearch(e.target.value)} placeholder="Eğitim ara..." className="pl-9 h-10" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
                </div>
                <button type="button" onClick={selectAllTrainings} className="shrink-0 text-xs font-medium px-3 py-2 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  {filteredTrainings.length > 0 && filteredTrainings.every(t => selectedTrainings.has(t.id)) ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                </button>
              </div>
              {filteredTrainings.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10">
                  <BookOpen className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                    {trainings.length === 0 ? 'Henüz eğitim bulunmuyor' : 'Arama sonucu bulunamadı'}
                  </p>
                  {trainings.length === 0 && (
                    <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                      Toplu atama yapabilmek için önce eğitim oluşturun.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTrainings.map(t => {
                    const selected = selectedTrainings.has(t.id);
                    return (
                      <button key={t.id} type="button" onClick={() => toggleTraining(t.id)}
                        role="checkbox"
                        aria-checked={selected}
                        aria-label={t.title}
                        className="w-full flex items-center gap-3 rounded-xl p-3 text-left"
                        style={{
                          background: selected ? '#dcfce7' : 'var(--color-surface)',
                          border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}`,
                          transition: 'border-color var(--transition-fast), background var(--transition-fast)',
                        }}>
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                          style={{ background: selected ? 'var(--color-primary)' : 'transparent', border: `2px solid ${selected ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                          {selected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{t.title}</p>
                          {t.category && <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{t.category}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                <Input value={staffSearch} onChange={e => setStaffSearch(e.target.value)} placeholder="Personel veya departman ara..." className="pl-9 h-10" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }} />
              </div>
              <div className="space-y-2">
                {Object.entries(deptGroups).map(([dept, members]) => {
                  const allSelected = members.every(s => selectedStaff.has(s.id));
                  const someSelected = members.some(s => selectedStaff.has(s.id));
                  const isExpanded = expandedDepts.has(dept);
                  return (
                    <div key={dept} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${someSelected ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                      <div className="flex items-center gap-3 p-3" style={{ background: someSelected ? 'var(--color-primary-light)' : 'var(--color-bg)' }}>
                        <button type="button" onClick={() => toggleDept(dept)}
                          role="checkbox"
                          aria-checked={allSelected ? true : someSelected ? 'mixed' : false}
                          aria-label={dept}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                          style={{ background: allSelected ? 'var(--color-primary)' : someSelected ? 'var(--color-primary-light)' : 'var(--color-surface)', border: `1px solid ${allSelected || someSelected ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                          {allSelected && <Check className="h-3 w-3 text-white" />}
                          {someSelected && !allSelected && <div className="h-2 w-2 rounded-sm" style={{ background: 'var(--color-primary)' }} />}
                        </button>
                        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>{dept}</span>
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{members.filter(s => selectedStaff.has(s.id)).length}/{members.length}</span>
                        <button type="button" onClick={() => setExpandedDepts(prev => { const n = new Set(prev); n.has(dept) ? n.delete(dept) : n.add(dept); return n; })}>
                          {isExpanded ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />}
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                          {members.map(s => {
                            const sel = selectedStaff.has(s.id);
                            return (
                              <button key={s.id} type="button" onClick={() => toggleStaff(s.id)}
                                role="checkbox"
                                aria-checked={sel}
                                aria-label={s.name}
                                className="w-full flex items-center gap-3 px-3 py-2.5"
                                style={{ background: sel ? 'var(--color-primary-light)' : 'var(--color-surface)' }}>
                                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded" style={{ background: sel ? 'var(--color-primary)' : 'transparent', border: `1px solid ${sel ? 'var(--color-primary)' : 'var(--color-border)'}` }}>
                                  {sel && <Check className="h-2.5 w-2.5 text-white" />}
                                </div>
                                <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>{s.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </>}
        </div>

        {/* Alt bar */}
        <div className="flex items-center justify-between p-6 border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
          <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <span>{selectedTrainings.size} eğitim</span>
            <span>·</span>
            <span>{selectedStaff.size} personel</span>
            {selectedTrainings.size > 0 && selectedStaff.size > 0 && (
              <>
                <span>·</span>
                <span className="font-semibold" style={{ color: 'var(--color-primary)' }}>{selectedTrainings.size * selectedStaff.size} atama oluşacak</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 1 ? (
              <button
                type="button"
                disabled={selectedTrainings.size === 0}
                onClick={() => setStep(2)}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{
                  background: selectedTrainings.size === 0 ? 'var(--color-border)' : 'var(--color-primary)',
                  color: selectedTrainings.size === 0 ? 'var(--color-text-muted)' : 'white',
                  cursor: selectedTrainings.size === 0 ? 'not-allowed' : 'pointer',
                  transition: 'background var(--transition-fast)',
                }}>
                Personel Seç →
              </button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl" style={{ borderColor: 'var(--color-border)' }}>
                  ← Geri
                </Button>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Deneme:</span>
                  <input type="number" min={1} max={10} value={maxAttempts} onChange={e => setMaxAttempts(Number(e.target.value))}
                    className="w-14 h-9 rounded-lg border text-center text-sm"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }} />
                </div>
                <button
                  type="button"
                  disabled={loading || selectedStaff.size === 0}
                  onClick={handleAssign}
                  className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
                  style={{
                    background: loading || selectedStaff.size === 0 ? 'var(--color-border)' : 'var(--color-primary)',
                    color: loading || selectedStaff.size === 0 ? 'var(--color-text-muted)' : 'white',
                    cursor: loading || selectedStaff.size === 0 ? 'not-allowed' : 'pointer',
                    transition: 'background var(--transition-fast)',
                  }}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Ata ({selectedTrainings.size * selectedStaff.size})
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
