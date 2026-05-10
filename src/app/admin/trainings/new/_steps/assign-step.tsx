'use client';

import { useMemo, useState } from 'react';
import {
  Users,
  Search,
  ChevronRight,
  ChevronDown,
  X,
  UserMinus,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useFetch } from '@/hooks/use-fetch';
import { K, type Dept, type DeptStaff } from './types';

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

type FilterMode = 'all' | 'selected' | 'excluded';
type CheckState = true | false | 'mixed';

export default function AssignStep({
  selectedDepts,
  setSelectedDepts,
  excludedStaff,
  setExcludedStaff,
  expandedDept,
  setExpandedDept,
  deptSearch,
  setDeptSearch,
}: AssignStepProps) {
  const { data: departmentsData } = useFetch<Dept[]>('/api/admin/departments');
  const departments: Dept[] = useMemo(() => departmentsData ?? [], [departmentsData]);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  // Hangi root'ların child'ları açık. Default kapalı; search varsa veya parent seçiliyse override edilir.
  const [expandedRoots, setExpandedRoots] = useState<Set<string>>(() => new Set());

  // Hiyerarşi: parentId=null → root, geri kalan parent'a göre gruplanır.
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

  // Effective: parent seçildiyse child'lar da dahil — backend expansion ile uyumlu.
  const effectiveDeptIds = useMemo(() => {
    const set = new Set<string>(selectedDepts);
    for (const id of selectedDepts) {
      const kids = childrenByParent.get(id) ?? [];
      for (const k of kids) set.add(k.id);
    }
    return set;
  }, [selectedDepts, childrenByParent]);

  // Atanacak personel sayısı: effective dept'lerin staff'ı, excluded'lar düşülmüş, dedup'lı.
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

  // Excluded staff'ın hangi departmana ait olduğunu çabuk bulmak için lookup.
  // Aynı staff birden fazla departmanda olabilir; ilk eşleşen dept'i tut, summary'de yeterli.
  const excludedStaffDetails = useMemo(() => {
    if (excludedStaff.length === 0) return [] as Array<{ staff: DeptStaff; dept: Dept }>;
    const out: Array<{ staff: DeptStaff; dept: Dept }> = [];
    const seen = new Set<string>();
    for (const dept of departments) {
      for (const s of dept.staff) {
        if (excludedStaff.includes(s.id) && !seen.has(s.id)) {
          out.push({ staff: s, dept });
          seen.add(s.id);
        }
      }
    }
    return out;
  }, [excludedStaff, departments]);

  // Bir dept (ve subtree'sindeki) staff ID'leri — parent unselect edilince excluded temizlemek için.
  const subtreeStaffIds = (deptId: string): Set<string> => {
    const ids = new Set<string>();
    const dept = deptById.get(deptId);
    if (!dept) return ids;
    for (const s of dept.staff) ids.add(s.id);
    const kids = childrenByParent.get(deptId) ?? [];
    for (const k of kids) for (const s of k.staff) ids.add(s.id);
    return ids;
  };

  const toggleDept = (id: string) => {
    setSelectedDepts((prev) => {
      if (prev.includes(id)) {
        // Unselect: bu subtree'deki excluded staff'ları da temizle (artık dahil değiller, hariç tutmak anlamsız).
        const subIds = subtreeStaffIds(id);
        setExcludedStaff((ex) => ex.filter((sid) => !subIds.has(sid)));
        return prev.filter((d) => d !== id);
      }
      return [...prev, id];
    });
  };

  const removeDept = (id: string) => {
    if (selectedDepts.includes(id)) toggleDept(id);
  };

  const restoreStaff = (staffId: string) => {
    setExcludedStaff((prev) => prev.filter((id) => id !== staffId));
  };

  const restoreAllStaff = () => setExcludedStaff([]);

  const q = deptSearch.trim().toLocaleLowerCase('tr-TR');
  const matchesQuery = (dept: Dept): boolean => {
    if (!q) return true;
    if (dept.name.toLocaleLowerCase('tr-TR').includes(q)) return true;
    return dept.staff.some((s) => s.name.toLocaleLowerCase('tr-TR').includes(q));
  };

  // Filter mode + search uygulanmış visible roots.
  const visibleRoots = useMemo(() => {
    return roots.filter((root) => {
      const kids = childrenByParent.get(root.id) ?? [];
      const queryMatch = matchesQuery(root) || kids.some(matchesQuery);
      if (!queryMatch) return false;
      if (filterMode === 'selected') {
        return effectiveDeptIds.has(root.id) || kids.some((k) => effectiveDeptIds.has(k.id));
      }
      if (filterMode === 'excluded') {
        const subIds = subtreeStaffIds(root.id);
        return excludedStaff.some((id) => subIds.has(id));
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, childrenByParent, q, filterMode, effectiveDeptIds, excludedStaff]);

  const allRootsSelected =
    roots.length > 0 && roots.every((r) => selectedDepts.includes(r.id));

  // Sheet için aktif departman.
  const activeDept = expandedDept ? deptById.get(expandedDept) : null;
  const activeDeptVisible = activeDept ? effectiveDeptIds.has(activeDept.id) : false;

  const hasSelected = selectedDepts.length > 0;
  const hasExcluded = excludedStaff.length > 0;

  return (
    <div className="space-y-5">
      <Header />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {/* SOL — Departman seçici */}
        <div className="space-y-4">
          <div
            className="rounded-2xl border bg-white p-4 sm:p-5"
            style={{ borderColor: K.BORDER_SOFT }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                  style={{ color: K.TEXT_MUTED }}
                />
                <Input
                  placeholder="Departman veya personel ara..."
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  className="h-10 pl-9"
                  aria-label="Departman veya personel ara"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedDepts(roots.map((d) => d.id))}
                  disabled={allRootsSelected}
                  className="h-10"
                >
                  Tümünü Seç
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSelectedDepts([]);
                    setExcludedStaff([]);
                  }}
                  disabled={!hasSelected && !hasExcluded}
                  className="h-10"
                >
                  Temizle
                </Button>
              </div>
            </div>

            <FilterChips
              value={filterMode}
              onChange={setFilterMode}
              hasSelected={hasSelected}
              hasExcluded={hasExcluded}
              selectedCount={effectiveDeptIds.size}
              excludedCount={excludedStaff.length}
            />
          </div>

          {/* Departman listesi */}
          <div
            className="overflow-hidden rounded-2xl border bg-white"
            style={{ borderColor: K.BORDER_SOFT }}
          >
            {visibleRoots.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Users
                  className="mx-auto mb-3 h-8 w-8 opacity-40"
                  style={{ color: K.TEXT_MUTED }}
                />
                <p className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>
                  {q
                    ? 'Aramaya uygun sonuç yok.'
                    : filterMode === 'selected'
                      ? 'Henüz departman seçmediniz.'
                      : filterMode === 'excluded'
                        ? 'Hariç tutulan personel yok.'
                        : 'Departman bulunamadı.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: K.BORDER_SOFT }}>
                {visibleRoots.map((root) => {
                  const kids = childrenByParent.get(root.id) ?? [];
                  const visibleKids = q
                    ? kids.filter((k) => matchesQuery(k) || matchesQuery(root))
                    : kids;

                  const rootSelected = selectedDepts.includes(root.id);
                  const rootExcludedCount = root.staff.filter((s) =>
                    excludedStaff.includes(s.id),
                  ).length;
                  const childSelected = kids.some((k) => selectedDepts.includes(k.id));
                  const childHasExcluded = kids.some((k) =>
                    k.staff.some((s) => excludedStaff.includes(s.id)),
                  );
                  // Indeterminate: parent değil ama child seçili VEYA seçili ama içinde hariç var
                  let rootCheck: CheckState = rootSelected;
                  if (!rootSelected && childSelected) rootCheck = 'mixed';
                  else if (rootSelected && (rootExcludedCount > 0 || childHasExcluded))
                    rootCheck = 'mixed';

                  const subtreeTotal =
                    root.staff.length + kids.reduce((s, k) => s + k.staff.length, 0);

                  // Child'ları göster: kullanıcı manuel açtı VEYA aktif arama VEYA parent/herhangi child seçili.
                  const isExpanded =
                    expandedRoots.has(root.id) ||
                    !!q ||
                    rootSelected ||
                    childSelected;

                  return (
                    <li key={root.id}>
                      <DepartmentRow
                        dept={root}
                        depth={0}
                        check={rootCheck}
                        autoIncluded={false}
                        excludedCount={rootExcludedCount}
                        secondaryLine={
                          kids.length > 0
                            ? `${subtreeTotal} personel · ${kids.length} alt birim`
                            : `${root.staff.length} personel`
                        }
                        childCount={kids.length}
                        isExpanded={isExpanded}
                        onToggleExpand={
                          kids.length > 0
                            ? () =>
                                setExpandedRoots((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(root.id)) next.delete(root.id);
                                  else next.add(root.id);
                                  return next;
                                })
                            : undefined
                        }
                        onToggle={() => toggleDept(root.id)}
                        onOpenStaff={() => setExpandedDept(root.id)}
                        canOpenStaff={effectiveDeptIds.has(root.id) && root.staff.length > 0}
                      />

                      {visibleKids.length > 0 && isExpanded && (
                        <ul
                          className="relative"
                          style={{ background: K.BG_SOFT }}
                        >
                          {/* Sol rail: child'ları parent'a görsel olarak bağlar */}
                          <span
                            aria-hidden
                            className="pointer-events-none absolute top-0 bottom-0 w-px"
                            style={{ left: 32, background: K.BORDER_SOFT }}
                          />
                          {visibleKids.map((kid) => {
                            const kidSelected = selectedDepts.includes(kid.id);
                            const autoIncluded = rootSelected;
                            const kidExcludedCount = kid.staff.filter((s) =>
                              excludedStaff.includes(s.id),
                            ).length;
                            let kidCheck: CheckState = kidSelected || autoIncluded;
                            if ((kidSelected || autoIncluded) && kidExcludedCount > 0)
                              kidCheck = 'mixed';

                            return (
                              <li key={kid.id}>
                                <DepartmentRow
                                  dept={kid}
                                  depth={1}
                                  check={kidCheck}
                                  autoIncluded={autoIncluded}
                                  excludedCount={kidExcludedCount}
                                  secondaryLine={`${kid.staff.length} personel`}
                                  onToggle={
                                    autoIncluded ? undefined : () => toggleDept(kid.id)
                                  }
                                  onOpenStaff={() => setExpandedDept(kid.id)}
                                  canOpenStaff={
                                    effectiveDeptIds.has(kid.id) && kid.staff.length > 0
                                  }
                                />
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
        </div>

        {/* SAĞ — Sticky özet */}
        <div className="lg:sticky lg:top-20 lg:self-start">
          <SummaryPanel
            totalStaff={totalSelectedStaff}
            selectedDeptCount={effectiveDeptIds.size}
            excludedCount={excludedStaff.length}
            selectedDepts={selectedDepts.map((id) => deptById.get(id)).filter(Boolean) as Dept[]}
            excludedStaffDetails={excludedStaffDetails}
            onRemoveDept={removeDept}
            onRestoreStaff={restoreStaff}
            onRestoreAll={restoreAllStaff}
          />
        </div>
      </div>

      {/* Sheet — personel detay */}
      <Sheet
        open={!!activeDept && activeDeptVisible}
        onOpenChange={(open) => {
          if (!open) setExpandedDept(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full p-0 sm:max-w-md"
          style={{ background: K.SURFACE }}
        >
          {activeDept && (
            <StaffSheet
              dept={activeDept}
              excludedStaff={excludedStaff}
              setExcludedStaff={setExcludedStaff}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---------- Header ----------

function Header() {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: K.PRIMARY_SOFT }}
      >
        <Users className="h-5 w-5" style={{ color: K.PRIMARY }} />
      </div>
      <div>
        <h3
          className="text-lg font-bold leading-tight"
          style={{ fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}
        >
          Personel Atama
        </h3>
        <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
          Departman seçin — alt birim varsa onu seçerek sadece o gruba atayabilirsiniz.
          Personel detayı için satırın sağındaki oka tıklayın.
        </p>
      </div>
    </div>
  );
}

// ---------- Filter chips ----------

interface FilterChipsProps {
  value: FilterMode;
  onChange: (v: FilterMode) => void;
  hasSelected: boolean;
  hasExcluded: boolean;
  selectedCount: number;
  excludedCount: number;
}

function FilterChips({
  value,
  onChange,
  hasSelected,
  hasExcluded,
  selectedCount,
  excludedCount,
}: FilterChipsProps) {
  const chips: Array<{
    key: FilterMode;
    label: string;
    count?: number;
    disabled?: boolean;
  }> = [
    { key: 'all', label: 'Tümü' },
    { key: 'selected', label: 'Sadece Seçili', count: selectedCount, disabled: !hasSelected },
    { key: 'excluded', label: 'Hariç tutulan', count: excludedCount, disabled: !hasExcluded },
  ];

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {chips.map((c) => {
        const active = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            disabled={c.disabled}
            onClick={() => onChange(c.key)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: active ? K.PRIMARY : K.SURFACE,
              color: active ? '#fff' : K.TEXT_SECONDARY,
              border: `1px solid ${active ? K.PRIMARY : K.BORDER_SOFT}`,
            }}
          >
            {c.label}
            {typeof c.count === 'number' && c.count > 0 && (
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-mono"
                style={{
                  background: active ? 'rgba(255,255,255,0.2)' : K.BG,
                  color: active ? '#fff' : K.TEXT_MUTED,
                }}
              >
                {c.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------- Department row ----------

interface DepartmentRowProps {
  dept: Dept;
  depth: 0 | 1;
  check: CheckState;
  autoIncluded: boolean;
  excludedCount: number;
  secondaryLine: string;
  childCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onToggle?: () => void;
  onOpenStaff: () => void;
  canOpenStaff: boolean;
}

function DepartmentRow({
  dept,
  depth,
  check,
  autoIncluded,
  excludedCount,
  secondaryLine,
  childCount,
  isExpanded,
  onToggleExpand,
  onToggle,
  onOpenStaff,
  canOpenStaff,
}: DepartmentRowProps) {
  const isOn = check === true || check === 'mixed';
  const isEmpty = dept.staff.length === 0 && (childCount ?? 0) === 0;

  return (
    <div
      className="group/row relative flex items-center gap-2.5 py-2 pr-2 transition-colors duration-150 hover:bg-stone-50"
      style={{ paddingLeft: depth === 1 ? 48 : 12 }}
    >
      {/* Custom checkbox (button, indeterminate desteği için) */}
      <button
        type="button"
        role="checkbox"
        aria-checked={check === 'mixed' ? 'mixed' : check}
        aria-label={`${dept.name} seçimi`}
        disabled={!onToggle}
        onClick={(e) => {
          e.stopPropagation();
          onToggle?.();
        }}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm transition-colors duration-150 disabled:cursor-not-allowed"
        style={{
          background: isOn ? dept.color : K.SURFACE,
          border: `1.5px solid ${isOn ? dept.color : K.BORDER}`,
          opacity: !onToggle ? 0.7 : 1,
        }}
      >
        {check === true && (
          <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="2.5,6.5 5,9 9.5,3.5" />
          </svg>
        )}
        {check === 'mixed' && (
          <span className="block h-0.5 w-2 rounded-sm bg-white" />
        )}
      </button>

      {/* Avatar */}
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="flex shrink-0 items-center disabled:cursor-not-allowed"
      >
        <div
          className="flex shrink-0 items-center justify-center rounded-md font-bold text-white"
          style={{
            background: dept.color,
            width: depth === 1 ? 26 : 30,
            height: depth === 1 ? 26 : 30,
            fontSize: depth === 1 ? 11 : 12,
            opacity: isEmpty ? 0.55 : 1,
          }}
        >
          {dept.name[0]?.toLocaleUpperCase('tr-TR')}
        </div>
      </button>

      {/* Title + secondary line */}
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-1.5">
          <p
            className="truncate font-semibold"
            style={{
              color: K.TEXT_PRIMARY,
              fontSize: depth === 1 ? 13 : 14,
            }}
          >
            {dept.name}
          </p>
          {autoIncluded && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-medium">
              otomatik
            </Badge>
          )}
          {excludedCount > 0 && (
            <Badge
              variant="outline"
              className="h-4 px-1.5 text-[9px] font-medium"
              style={{ borderColor: K.WARNING, color: K.WARNING }}
            >
              {excludedCount} hariç
            </Badge>
          )}
        </div>
        <p
          className="truncate text-[11px]"
          style={{
            color: K.TEXT_MUTED,
            fontVariantNumeric: 'tabular-nums',
            opacity: isEmpty ? 0.6 : 1,
          }}
        >
          {secondaryLine}
        </p>
      </button>

      {/* Expand children toggle (root, child'ı varsa) */}
      {onToggleExpand && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          aria-label={isExpanded ? 'Alt birimleri gizle' : 'Alt birimleri göster'}
          aria-expanded={isExpanded}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors duration-150 hover:bg-stone-100"
          style={{ color: K.TEXT_SECONDARY }}
        >
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform duration-150"
            style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}
          />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{childCount}</span>
        </button>
      )}

      {/* Open staff drawer */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenStaff();
        }}
        disabled={!canOpenStaff}
        aria-label="Personel listesini aç"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-25"
        style={{ color: K.TEXT_SECONDARY }}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------- Summary panel ----------

interface SummaryPanelProps {
  totalStaff: number;
  selectedDeptCount: number;
  excludedCount: number;
  selectedDepts: Dept[];
  excludedStaffDetails: Array<{ staff: DeptStaff; dept: Dept }>;
  onRemoveDept: (id: string) => void;
  onRestoreStaff: (id: string) => void;
  onRestoreAll: () => void;
}

function SummaryPanel({
  totalStaff,
  selectedDeptCount,
  excludedCount,
  selectedDepts,
  excludedStaffDetails,
  onRemoveDept,
  onRestoreStaff,
  onRestoreAll,
}: SummaryPanelProps) {
  const empty = totalStaff === 0 && selectedDepts.length === 0;

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: K.BORDER_SOFT }}
    >
      {/* Top metric */}
      <div
        className="px-5 py-5"
        style={{ background: empty ? K.BG : K.PRIMARY_SOFT }}
      >
        <p
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: K.TEXT_MUTED }}
        >
          Atama Özeti
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span
            className="text-4xl font-bold"
            style={{
              fontFamily: K.FONT_DISPLAY,
              color: empty ? K.TEXT_MUTED : K.PRIMARY,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {totalStaff}
          </span>
          <span className="text-sm" style={{ color: K.TEXT_SECONDARY }}>
            kişi atanacak
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span style={{ color: K.TEXT_MUTED }}>
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ background: selectedDeptCount > 0 ? K.PRIMARY : K.BORDER }}
            />
            {selectedDeptCount} departman
          </span>
          <span style={{ color: excludedCount > 0 ? K.WARNING : K.TEXT_MUTED }}>
            <span
              className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
              style={{ background: excludedCount > 0 ? K.WARNING : K.BORDER }}
            />
            {excludedCount} kişi hariç
          </span>
        </div>
      </div>

      {/* Empty state */}
      {empty && (
        <div className="px-5 py-6 text-center">
          <p className="text-sm" style={{ color: K.TEXT_MUTED }}>
            Henüz departman seçilmedi.
            <br />
            <span style={{ color: K.TEXT_SECONDARY }}>Soldan başlayın.</span>
          </p>
        </div>
      )}

      {/* Selected departments */}
      {selectedDepts.length > 0 && (
        <div className="border-t px-5 py-4" style={{ borderColor: K.BORDER_SOFT }}>
          <p
            className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
            style={{ color: K.TEXT_MUTED }}
          >
            Seçilen Departmanlar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedDepts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onRemoveDept(d.id)}
                className="group/chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:bg-stone-100"
                style={{
                  background: K.BG,
                  border: `1px solid ${K.BORDER_SOFT}`,
                  color: K.TEXT_PRIMARY,
                }}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: d.color }}
                />
                <span className="max-w-35 truncate">{d.name}</span>
                <X
                  className="h-3 w-3 opacity-50 group-hover/chip:opacity-100"
                  style={{ color: K.TEXT_MUTED }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Excluded staff */}
      {excludedStaffDetails.length > 0 && (
        <div className="border-t px-5 py-4" style={{ borderColor: K.BORDER_SOFT }}>
          <div className="mb-2 flex items-center justify-between">
            <p
              className="text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: K.TEXT_MUTED }}
            >
              Hariç Tutulan Kişiler
            </p>
            <button
              type="button"
              onClick={onRestoreAll}
              className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors duration-150 hover:underline"
              style={{ color: K.PRIMARY }}
            >
              <RotateCcw className="h-3 w-3" />
              Hepsini geri al
            </button>
          </div>
          <ul className="space-y-1.5">
            {excludedStaffDetails.map(({ staff, dept }) => (
              <li
                key={staff.id}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                style={{ background: K.BG }}
              >
                <div
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: dept.color, opacity: 0.7 }}
                >
                  {staff.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-medium"
                    style={{ color: K.TEXT_SECONDARY }}
                  >
                    {staff.name}
                  </p>
                  <p
                    className="truncate text-[10px]"
                    style={{ color: K.TEXT_MUTED }}
                  >
                    {dept.name} · {staff.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRestoreStaff(staff.id)}
                  aria-label={`${staff.name} kişisini geri al`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors duration-150 hover:bg-stone-100"
                  style={{ color: K.TEXT_MUTED }}
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------- Staff sheet ----------

interface StaffSheetProps {
  dept: Dept;
  excludedStaff: string[];
  setExcludedStaff: React.Dispatch<React.SetStateAction<string[]>>;
}

function StaffSheet({ dept, excludedStaff, setExcludedStaff }: StaffSheetProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (!q) return dept.staff;
    return dept.staff.filter(
      (s) =>
        s.name.toLocaleLowerCase('tr-TR').includes(q) ||
        s.title.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [dept.staff, search]);

  const includedCount = dept.staff.filter((s) => !excludedStaff.includes(s.id)).length;

  const toggleStaff = (id: string) => {
    setExcludedStaff((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const includeAll = () => {
    const ids = new Set(dept.staff.map((s) => s.id));
    setExcludedStaff((prev) => prev.filter((id) => !ids.has(id)));
  };

  const excludeAll = () => {
    const ids = dept.staff.map((s) => s.id);
    setExcludedStaff((prev) => Array.from(new Set([...prev, ...ids])));
  };

  return (
    <>
      <SheetHeader
        className="border-b px-5 py-4"
        style={{ borderColor: K.BORDER_SOFT, background: K.BG }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold text-white"
            style={{ background: dept.color }}
          >
            {dept.name[0]?.toLocaleUpperCase('tr-TR')}
          </div>
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-base font-bold">
              {dept.name}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {includedCount} dahil · {dept.staff.length - includedCount} hariç ·{' '}
              {dept.staff.length} toplam
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div
        className="flex items-center gap-2 border-b px-5 py-3"
        style={{ borderColor: K.BORDER_SOFT }}
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
            style={{ color: K.TEXT_MUTED }}
          />
          <Input
            placeholder="Kişi ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={includeAll} className="h-9 text-xs">
          Tümü dahil
        </Button>
        <Button variant="ghost" size="sm" onClick={excludeAll} className="h-9 text-xs">
          <UserMinus className="mr-1 h-3.5 w-3.5" />
          Tümü hariç
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm" style={{ color: K.TEXT_MUTED }}>
              {dept.staff.length === 0
                ? 'Bu departmana doğrudan bağlı personel yok.'
                : 'Aramaya uygun kişi yok.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: K.BORDER_SOFT }}>
            {filtered.map((staff) => {
              const excluded = excludedStaff.includes(staff.id);
              const included = !excluded;
              return (
                <li
                  key={staff.id}
                  className="flex items-center gap-3 px-5 py-2.5 transition-colors duration-150 hover:bg-stone-50"
                >
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={included}
                    aria-label={`${staff.name} dahil`}
                    onClick={() => toggleStaff(staff.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors duration-150"
                    style={{
                      background: included ? K.PRIMARY : K.SURFACE,
                      border: `1.5px solid ${included ? K.PRIMARY : K.BORDER}`,
                    }}
                  >
                    {included && (
                      <svg
                        viewBox="0 0 12 12"
                        className="h-3 w-3"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2.5,6.5 5,9 9.5,3.5" />
                      </svg>
                    )}
                  </button>
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{
                      background: dept.color,
                      opacity: included ? 1 : 0.4,
                    }}
                  >
                    {staff.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-sm font-medium"
                      style={{
                        color: included ? K.TEXT_PRIMARY : K.TEXT_MUTED,
                        textDecoration: excluded ? 'line-through' : 'none',
                      }}
                    >
                      {staff.name}
                    </p>
                    <p
                      className="truncate text-xs"
                      style={{ color: K.TEXT_MUTED }}
                    >
                      {staff.title}
                    </p>
                  </div>
                  {excluded && (
                    <Badge
                      variant="outline"
                      className="h-5 text-[10px]"
                      style={{ borderColor: K.WARNING, color: K.WARNING }}
                    >
                      hariç
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
