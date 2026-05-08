'use client';

import { useMemo } from 'react';
import { Users, Check, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFetch } from '@/hooks/use-fetch';
import { K, type Dept } from './types';

interface AssignStepProps {
  selectedDepts: string[];
  setSelectedDepts: React.Dispatch<React.SetStateAction<string[]>>;
  excludedStaff: string[];
  setExcludedStaff: React.Dispatch<React.SetStateAction<string[]>>;
  expandedDept: string | null;
  setExpandedDept: (v: string | null) => void;
  deptSearch: string;
  setDeptSearch: (v: string) => void;
}

export default function AssignStep({
  selectedDepts, setSelectedDepts,
  excludedStaff, setExcludedStaff,
  expandedDept, setExpandedDept,
  deptSearch, setDeptSearch,
}: AssignStepProps) {
  // 4. adıma kadar fetch atılmaz — wizard performansı için step içinde tutulur.
  const { data: departmentsData } = useFetch<Dept[]>('/api/admin/departments');
  const departments: Dept[] = useMemo(() => departmentsData ?? [], [departmentsData]);

  // Hiyerarşi gruplandırması: roots (parentId=null) + her root için children listesi.
  const { roots, childrenByParent, deptById } = useMemo(() => {
    const roots: Dept[] = [];
    const childrenByParent = new Map<string, Dept[]>();
    const deptById = new Map<string, Dept>();
    for (const d of departments) {
      deptById.set(d.id, d);
      if (!d.parentId) {
        roots.push(d);
      } else {
        const list = childrenByParent.get(d.parentId) ?? [];
        list.push(d);
        childrenByParent.set(d.parentId, list);
      }
    }
    return { roots, childrenByParent, deptById };
  }, [departments]);

  // Effective selection: kullanıcı parent seçtiyse child'ları da dahildir (backend expansion'la
  // uyumlu). UI ve count hesabı bu effective set üzerinden yapılır.
  const effectiveDeptIds = useMemo(() => {
    const set = new Set<string>(selectedDepts);
    for (const id of selectedDepts) {
      const kids = childrenByParent.get(id) ?? [];
      for (const k of kids) set.add(k.id);
    }
    return set;
  }, [selectedDepts, childrenByParent]);

  // Toplam seçili personel: effective dept'lerin staff'ından excluded olanları çıkar.
  // Parent + child kombinasyonunda aynı user iki kez sayılmasın diye Set kullanılıyor.
  const totalSelectedStaff = useMemo(() => {
    const userIds = new Set<string>();
    for (const id of effectiveDeptIds) {
      const dept = deptById.get(id);
      if (!dept) continue;
      for (const s of dept.staff) {
        if (!excludedStaff.includes(s.id)) userIds.add(s.id);
      }
    }
    return userIds.size;
  }, [effectiveDeptIds, excludedStaff, deptById]);

  const toggleDept = (id: string) => {
    setSelectedDepts(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const toggleStaffExclusion = (staffId: string) => {
    setExcludedStaff(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const q = deptSearch.trim().toLocaleLowerCase('tr-TR');
  const matchesQuery = (dept: Dept): boolean => {
    if (!q) return true;
    if (dept.name.toLocaleLowerCase('tr-TR').includes(q)) return true;
    return dept.staff.some(s => s.name.toLocaleLowerCase('tr-TR').includes(q));
  };

  // Filtre: bir root görünür eğer kendisi veya child'ı eşleşir.
  const visibleRoots = roots.filter(root => {
    if (matchesQuery(root)) return true;
    const kids = childrenByParent.get(root.id) ?? [];
    return kids.some(matchesQuery);
  });

  // "Tümünü Seç/Kaldır" — sadece kök departmanları toggle eder; child'lar parent'a bağlı.
  const allRootsSelected = roots.length > 0 && roots.every(r => selectedDepts.includes(r.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.INFO_BG }}>
          <Users className="h-5 w-5" style={{ color: K.INFO }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Personel Atama</h3>
          <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
            Departman seçin — alt birim varsa onu seçerek sadece o gruba atayabilirsiniz.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Departman veya personel ara..."
          value={deptSearch}
          onChange={(e) => setDeptSearch(e.target.value)}
          className="max-w-sm h-11"
          style={{ background: K.BG, borderColor: K.BORDER, borderRadius: 10 }}
        />
        <Button
          variant="outline"
          onClick={() => setSelectedDepts(allRootsSelected ? [] : roots.map(d => d.id))}
          className="h-11 rounded-xl"
          style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
        >
          {allRootsSelected ? 'Tümünü Kaldır' : 'Tümünü Seç'}
        </Button>
      </div>

      <div className="space-y-4">
        {visibleRoots.map((root) => {
          const isRootSelected = selectedDepts.includes(root.id);
          const rootKids = childrenByParent.get(root.id) ?? [];
          const visibleKids = q ? rootKids.filter(k => matchesQuery(k) || matchesQuery(root)) : rootKids;
          const rootActiveStaff = root.staff.filter(s => !excludedStaff.includes(s.id));
          const isRootExpanded = expandedDept === root.id;
          // Toplam etki: root + tüm child'lar (effective dahil)
          const subtreeStaffTotal = root.staff.length + rootKids.reduce((sum, k) => sum + k.staff.length, 0);

          return (
            <div key={root.id} className="space-y-2">
              {/* Root departman kartı */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDept(root.id)}
                  className="relative flex w-full items-start gap-3 rounded-xl border p-4 text-left"
                  style={{
                    borderColor: isRootSelected ? root.color : K.BORDER,
                    background: isRootSelected ? K.BG : K.SURFACE,
                    transition: 'border-color 150ms ease, background 150ms ease',
                  }}
                >
                  {isRootSelected && (
                    <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: root.color }}>
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg text-base font-bold text-white" style={{ background: root.color }}>
                    {root.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{root.name}</p>
                    <p className="text-xs font-mono" style={{ color: K.TEXT_MUTED }}>
                      {isRootSelected ? `${rootActiveStaff.length}/${root.staff.length}` : `${root.staff.length}`} kişi (direkt)
                      {rootKids.length > 0 && ` · ${rootKids.length} alt birim · toplam ${subtreeStaffTotal} kişi`}
                    </p>
                  </div>
                </button>
                {isRootSelected && (
                  <button
                    type="button"
                    onClick={() => setExpandedDept(isRootExpanded ? null : root.id)}
                    className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors duration-150"
                    style={{ color: root.color, background: isRootExpanded ? `${root.color}10` : 'transparent' }}
                  >
                    {isRootExpanded ? 'Gizle' : 'Direkt bağlı kişileri gör'}
                  </button>
                )}
              </div>

              {/* Alt birim kartları (indented) */}
              {visibleKids.length > 0 && (
                <div className="ml-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {visibleKids.map((kid) => {
                    const isKidSelected = selectedDepts.includes(kid.id);
                    const kidActiveStaff = kid.staff.filter(s => !excludedStaff.includes(s.id));
                    const isKidExpanded = expandedDept === kid.id;
                    const isKidAutoIncluded = isRootSelected; // parent seçiliyse child otomatik dahil
                    const isKidEffective = isKidAutoIncluded || isKidSelected;

                    return (
                      <div key={kid.id} className="relative">
                        <button
                          type="button"
                          onClick={() => !isKidAutoIncluded && toggleDept(kid.id)}
                          disabled={isKidAutoIncluded}
                          className="relative flex w-full items-start gap-2 rounded-lg border p-3 text-left disabled:cursor-not-allowed"
                          style={{
                            borderColor: isKidEffective ? kid.color : K.BORDER,
                            background: isKidEffective ? K.BG : K.SURFACE,
                            opacity: isKidAutoIncluded ? 0.85 : 1,
                            transition: 'border-color 150ms ease, background 150ms ease',
                          }}
                        >
                          <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: K.TEXT_MUTED }} />
                          <div className="flex h-7 w-7 items-center justify-center rounded text-[11px] font-bold text-white shrink-0" style={{ background: kid.color }}>
                            {kid.name[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{kid.name}</p>
                            <p className="text-[10px] font-mono" style={{ color: K.TEXT_MUTED }}>
                              {isKidEffective ? `${kidActiveStaff.length}/${kid.staff.length}` : `${kid.staff.length}`} kişi
                            </p>
                          </div>
                          {isKidAutoIncluded && (
                            <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ background: `${kid.color}20`, color: kid.color }}>
                              Otomatik
                            </span>
                          )}
                          {!isKidAutoIncluded && isKidSelected && (
                            <div className="flex h-4 w-4 items-center justify-center rounded-full" style={{ background: kid.color }}>
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                          )}
                        </button>
                        {isKidEffective && (
                          <button
                            type="button"
                            onClick={() => setExpandedDept(isKidExpanded ? null : kid.id)}
                            className="mt-1 flex w-full items-center justify-center gap-1 rounded py-1 text-[10px] font-medium"
                            style={{ color: kid.color, background: isKidExpanded ? `${kid.color}10` : 'transparent' }}
                          >
                            {isKidExpanded ? 'Gizle' : 'Kişileri gör'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {expandedDept && (() => {
        const dept = deptById.get(expandedDept);
        if (!dept) return null;
        // Görünür olması için ya direkt seçili olmalı ya da parent'ı seçili olmalı.
        const isVisible = effectiveDeptIds.has(dept.id);
        if (!isVisible) return null;
        return (
          <div
            className="rounded-xl border overflow-hidden"
            style={{ borderColor: dept.color, background: K.SURFACE }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ background: `${dept.color}10`, borderBottom: `1px solid ${dept.color}30` }}>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ background: dept.color }} />
                <span className="text-sm font-bold">{dept.name}</span>
                <span className="text-xs font-mono" style={{ color: K.TEXT_MUTED }}>
                  {dept.staff.filter(s => !excludedStaff.includes(s.id)).length}/{dept.staff.length} kişi seçili
                </span>
              </div>
              <button
                type="button"
                onClick={() => setExpandedDept(null)}
                className="text-xs font-medium px-2 py-1 rounded-md"
                style={{ color: K.TEXT_MUTED }}
              >
                Kapat
              </button>
            </div>
            <div className="divide-y" style={{ borderColor: K.BORDER }}>
              {dept.staff.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs" style={{ color: K.TEXT_MUTED }}>
                  Bu departmana doğrudan bağlı personel yok.
                </div>
              ) : dept.staff.map((staff) => {
                const isExcluded = excludedStaff.includes(staff.id);
                return (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between px-4 py-2.5 transition-colors duration-100"
                    style={{ background: isExcluded ? K.ERROR_BG : 'transparent' }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: isExcluded ? K.TEXT_MUTED : dept.color, opacity: isExcluded ? 0.5 : 1 }}
                      >
                        {staff.initials}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ textDecoration: isExcluded ? 'line-through' : 'none', opacity: isExcluded ? 0.5 : 1 }}>{staff.name}</p>
                        <p className="text-[11px]" style={{ color: K.TEXT_MUTED }}>{staff.title}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleStaffExclusion(staff.id)}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors duration-150"
                      style={{
                        background: isExcluded ? K.SUCCESS_BG : K.ERROR_BG,
                        color: isExcluded ? K.SUCCESS : K.ERROR,
                      }}
                    >
                      {isExcluded ? (
                        <><Check className="h-3 w-3" /> Dahil Et</>
                      ) : (
                        <><Trash2 className="h-3 w-3" /> Çıkar</>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div
        className="flex items-center justify-between rounded-xl px-5 py-4"
        style={{
          background: totalSelectedStaff > 0 ? K.PRIMARY : K.BG,
          border: totalSelectedStaff > 0 ? 'none' : `1.5px solid ${K.BORDER}`,
        }}
      >
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5" style={{ color: totalSelectedStaff > 0 ? 'rgba(255,255,255,0.7)' : K.TEXT_MUTED }} />
          <span className="text-sm font-medium" style={{ color: totalSelectedStaff > 0 ? 'white' : K.TEXT_SECONDARY }}>
            Seçili personel sayısı
          </span>
        </div>
        <span
          className="text-lg font-bold"
          style={{ fontFamily: K.FONT_MONO, color: totalSelectedStaff > 0 ? 'white' : K.TEXT_MUTED }}
        >
          {totalSelectedStaff}
        </span>
      </div>
    </div>
  );
}
