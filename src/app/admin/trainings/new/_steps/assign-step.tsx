'use client';

import { Users, Check, Trash2 } from 'lucide-react';
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
  const departments: Dept[] = departmentsData ?? [];

  const totalSelectedStaff = departments
    .filter(d => selectedDepts.includes(d.id))
    .reduce((sum, d) => sum + d.staff.filter(s => !excludedStaff.includes(s.id)).length, 0);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.INFO_BG }}>
          <Users className="h-5 w-5" style={{ color: K.INFO }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Personel Atama</h3>
          <p className="text-xs" style={{ color: K.TEXT_MUTED }}>Eğitimi atamak istediğiniz departmanları seçin</p>
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
          onClick={() => setSelectedDepts(selectedDepts.length === departments.length ? [] : departments.map(d => d.id))}
          className="h-11 rounded-xl"
          style={{ borderColor: K.BORDER, color: K.TEXT_SECONDARY }}
        >
          {selectedDepts.length === departments.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {departments.filter(dept => {
          const q = deptSearch.trim().toLocaleLowerCase('tr-TR');
          if (!q) return true;
          if (dept.name.toLocaleLowerCase('tr-TR').includes(q)) return true;
          return dept.staff.some(s => s.name.toLocaleLowerCase('tr-TR').includes(q));
        }).map((dept) => {
          const isSelected = selectedDepts.includes(dept.id);
          const activeStaff = dept.staff.filter(s => !excludedStaff.includes(s.id));
          const isExpanded = expandedDept === dept.id;
          return (
            <div key={dept.id} className="relative">
              <button
                type="button"
                onClick={() => toggleDept(dept.id)}
                className="relative flex w-full flex-col items-start gap-2 rounded-xl border p-4 text-left"
                style={{
                  borderColor: isSelected ? dept.color : K.BORDER,
                  background: isSelected ? K.BG : K.SURFACE,
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
              >
                {isSelected && (
                  <div className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full" style={{ background: dept.color }}>
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
                <div className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: dept.color }}>
                  {dept.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold">{dept.name}</p>
                  <p className="text-xs font-mono" style={{ color: K.TEXT_MUTED }}>
                    {isSelected ? `${activeStaff.length}/${dept.staff.length}` : `${dept.staff.length}`} kişi
                  </p>
                </div>
              </button>
              {isSelected && (
                <button
                  type="button"
                  onClick={() => setExpandedDept(isExpanded ? null : dept.id)}
                  className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors duration-150"
                  style={{ color: dept.color, background: isExpanded ? `${dept.color}10` : 'transparent' }}
                >
                  {isExpanded ? 'Gizle' : 'Kişileri Gör'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {expandedDept && selectedDepts.includes(expandedDept) && (() => {
        const dept = departments.find(d => d.id === expandedDept);
        if (!dept) return null;
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
              {dept.staff.map((staff) => {
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
