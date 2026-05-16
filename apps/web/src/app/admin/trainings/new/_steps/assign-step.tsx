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
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Star,
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
import { K, isSuggestedDeptForCategory, type Dept, type DeptStaff } from './types';

interface AssignStepProps {
  selectedDepts: string[];
  setSelectedDepts: React.Dispatch<React.SetStateAction<string[]>>;
  excludedStaff: string[];
  setExcludedStaff: React.Dispatch<React.SetStateAction<string[]>>;
  expandedDept: string | null;
  setExpandedDept: (v: string | null) => void;
  deptSearch: string;
  setDeptSearch: (v: string) => void;
  /** Cross-step rollup — yayın öncesi özet panel ve uyarılar için. */
  trainingSummary?: {
    title: string;
    category: string;
    videoCount: number;
    audioCount: number;
    pdfCount: number;
    totalDurationSeconds: number;
    questionCount: number;
    passingScore: number;
    examDurationMinutes: number;
    isCompulsory: boolean;
    renewalPeriodMonths: number | null;
    startDate: string;
    endDate: string;
  };
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
  trainingSummary,
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

  // Filter mode + search uygulanmış visible roots — kategori için "önerilen" olanlar
  // önce gösterilir (admin'in dikkati ilk oraya çekilsin).
  const visibleRoots = useMemo(() => {
    const filtered = roots.filter((root) => {
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
    const category = trainingSummary?.category;
    if (!category) return filtered;
    return [...filtered].sort((a, b) => {
      const aSug = isSuggestedDeptForCategory(category, a.name) ? 0 : 1;
      const bSug = isSuggestedDeptForCategory(category, b.name) ? 0 : 1;
      return aSug - bSug;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, childrenByParent, q, filterMode, effectiveDeptIds, excludedStaff, trainingSummary?.category]);

  const allRootsSelected =
    roots.length > 0 && roots.every((r) => selectedDepts.includes(r.id));

  // Sheet için aktif departman.
  const activeDept = expandedDept ? deptById.get(expandedDept) : null;
  const activeDeptVisible = activeDept ? effectiveDeptIds.has(activeDept.id) : false;

  const hasSelected = selectedDepts.length > 0;
  const hasExcluded = excludedStaff.length > 0;

  // Cross-step uyarı koşulları (rollup verisinden türetilir)
  const compulsoryExcludedWarn = !!trainingSummary?.isCompulsory && hasExcluded;
  const compulsoryNoDeptWarn = !!trainingSummary?.isCompulsory && !hasSelected;

  return (
    <div className="space-y-5">
      <Header />

      {/* Cross-step uyarıları — Step 1'deki isCompulsory ile bu adımdaki seçim arasındaki çelişkiler */}
      {(compulsoryNoDeptWarn || compulsoryExcludedWarn) && (
        <div className="space-y-2">
          {compulsoryNoDeptWarn && (
            <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: K.ERROR_BG, border: `1.5px solid ${K.ERROR}` }}>
              <ShieldCheck className="h-5 w-5 mt-0.5 shrink-0" style={{ color: K.ERROR }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: K.ERROR }}>Zorunlu eğitim için atama gerekli</p>
                <p className="mt-0.5 text-xs" style={{ color: K.TEXT_SECONDARY }}>
                  Bu eğitim &quot;Zorunlu&quot; olarak işaretlendi (Temel Bilgiler adımı). Yayınlanabilmesi için en az bir departman seçmelisiniz.
                </p>
              </div>
            </div>
          )}
          {compulsoryExcludedWarn && (
            <div className="flex items-start gap-3 rounded-xl p-4" style={{ background: K.WARNING_BG, border: `1.5px solid ${K.WARNING}` }}>
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" style={{ color: K.WARNING }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Compliance uyarısı: zorunlu eğitimden personel hariç tutuldu</p>
                <p className="mt-0.5 text-xs" style={{ color: K.TEXT_SECONDARY }}>
                  Zorunlu eğitimlerden personel muaf tutmak denetim sorumluluğu gerektirir. Resmi muafiyet belgesi olmadan bu kişiler için yasal risk doğabilir.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cross-step rollup — neyi yayınlıyoruz? */}
      {trainingSummary && (
        <div className="rounded-xl p-4" style={{ background: K.BG, border: `1.5px solid ${K.BORDER_SOFT}` }}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: K.TEXT_MUTED }}>Yayına Hazır Özet</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs" style={{ color: K.TEXT_SECONDARY }}>
            <span><strong style={{ color: K.TEXT_PRIMARY }}>{trainingSummary.title || '(Adsız)'}</strong></span>
            <span>•</span>
            <span>
              <strong style={{ color: K.TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{trainingSummary.videoCount + trainingSummary.audioCount}</strong> medya
              {trainingSummary.pdfCount > 0 && <> + <strong style={{ color: K.TEXT_PRIMARY }}>{trainingSummary.pdfCount}</strong> doküman</>}
            </span>
            {trainingSummary.totalDurationSeconds > 0 && (
              <>
                <span>•</span>
                <span>İçerik <strong style={{ color: K.TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{Math.round(trainingSummary.totalDurationSeconds / 60)} dk</strong></span>
              </>
            )}
            <span>•</span>
            <span><strong style={{ color: K.TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{trainingSummary.questionCount}</strong> soru / <strong style={{ color: K.TEXT_PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{trainingSummary.examDurationMinutes} dk</strong> sınav</span>
            <span>•</span>
            <span>Baraj <strong style={{ color: K.PRIMARY, fontVariantNumeric: 'tabular-nums' }}>{trainingSummary.passingScore}</strong></span>
            {trainingSummary.isCompulsory && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1" style={{ color: K.WARNING }}>
                  <ShieldCheck className="h-3 w-3" /> Zorunlu
                </span>
              </>
            )}
            {trainingSummary.renewalPeriodMonths && (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-1" style={{ color: K.INFO }}>
                  <RefreshCw className="h-3 w-3" /> {trainingSummary.renewalPeriodMonths} ay yenileme
                </span>
              </>
            )}
          </div>
        </div>
      )}

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

          {/* Departman kart grid'i */}
          {visibleRoots.length === 0 ? (
            <div
              className="rounded-2xl border bg-white px-6 py-14 text-center"
              style={{ borderColor: K.BORDER_SOFT }}
            >
              <Users
                className="mx-auto mb-3 h-10 w-10 opacity-40"
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
            // Responsive grid: mobile 1 kolon, md 2 kolon (sağ panel altta stack), lg 1 kolon
            // (sağ panel devreye girer, sol bölüm dar), xl 2 kolon (sol bölüm tekrar geniş).
            <div className="grid auto-rows-max grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

                // Child'ları göster: kullanıcı manuel açtı VEYA aktif arama VEYA bir alt birim seçili.
                // Parent ticklenmesi otomatik açma TETİKLEMEZ — bilinçli karar (UX).
                const isExpanded =
                  expandedRoots.has(root.id) || !!q || childSelected;

                const isSuggestedDept = isSuggestedDeptForCategory(trainingSummary?.category, root.name);

                return (
                  <DepartmentCard
                    key={root.id}
                    dept={root}
                    check={rootCheck}
                    excludedCount={rootExcludedCount}
                    totalStaffCount={subtreeTotal}
                    childCount={kids.length}
                    isExpanded={isExpanded}
                    suggested={isSuggestedDept}
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
                    canOpenStaff={effectiveDeptIds.has(root.id) && (root.staff.length > 0 || kids.some(k => k.staff.length > 0))}
                  >
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
                        <SubDeptRow
                          key={kid.id}
                          dept={kid}
                          check={kidCheck}
                          autoIncluded={autoIncluded}
                          excludedCount={kidExcludedCount}
                          onToggle={autoIncluded ? undefined : () => toggleDept(kid.id)}
                          onOpenStaff={() => setExpandedDept(kid.id)}
                          canOpenStaff={
                            effectiveDeptIds.has(kid.id) && kid.staff.length > 0
                          }
                        />
                      );
                    })}
                  </DepartmentCard>
                );
              })}
            </div>
          )}
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
              childDepts={childrenByParent.get(activeDept.id) ?? []}
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

// ---------- Department card (root) ----------

interface DepartmentCardProps {
  dept: Dept;
  check: CheckState;
  excludedCount: number;
  totalStaffCount: number;
  childCount: number;
  isExpanded: boolean;
  onToggleExpand?: () => void;
  onToggle: () => void;
  onOpenStaff: () => void;
  canOpenStaff: boolean;
  suggested?: boolean;
  children?: React.ReactNode;
}

function DepartmentCard({
  dept,
  check,
  excludedCount,
  totalStaffCount,
  childCount,
  isExpanded,
  onToggleExpand,
  onToggle,
  onOpenStaff,
  canOpenStaff,
  suggested = false,
  children,
}: DepartmentCardProps) {
  const isOn = check === true || check === 'mixed';
  const isEmpty = totalStaffCount === 0 && childCount === 0;

  // Selected: 8-digit hex (renk + alpha) — color-mix() Safari < 16.2 desteklemiyor.
  // ${color}14 ≈ %8 alpha; ${color}33 ≈ %20 alpha.
  const tintBg = isOn ? `${dept.color}14` : K.SURFACE;
  const dividerColor = isOn ? `${dept.color}33` : K.BORDER_SOFT;

  return (
    <article
      className="group/card relative flex flex-col self-start overflow-hidden rounded-2xl border"
      style={{
        background: tintBg,
        borderColor: isOn ? K.BORDER : K.BORDER_SOFT,
        boxShadow: isOn ? K.SHADOW_CARD : 'none',
        transition: 'box-shadow 150ms ease, border-color 150ms ease',
      }}
    >
      {/* Sol accent şerit — seçim göstergesi */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-0 bottom-0 left-0"
        style={{
          width: 4,
          background: isOn ? dept.color : 'transparent',
          opacity: check === 'mixed' ? 0.5 : 1,
        }}
      />

      {/* Header — uniform yükseklik */}
      <div className="flex items-start gap-3 px-4 py-4 pl-5">
        {/* Avatar (büyük, kart hiyerarşisinde dominant) */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={`${dept.name} seç`}
          className="shrink-0"
        >
          <div
            className="flex items-center justify-center rounded-xl font-bold text-white"
            style={{
              background: dept.color,
              width: 44,
              height: 44,
              fontSize: 16,
              fontFamily: K.FONT_DISPLAY,
              opacity: isEmpty ? 0.5 : 1,
            }}
          >
            {dept.name[0]?.toLocaleUpperCase('tr-TR')}
          </div>
        </button>

        {/* Başlık + sayım */}
        <button
          type="button"
          onClick={onToggle}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-1.5">
            <p
              className="truncate font-bold leading-snug"
              style={{
                fontFamily: K.FONT_DISPLAY,
                fontSize: 16,
                color: K.TEXT_PRIMARY,
                opacity: isEmpty ? 0.6 : 1,
              }}
            >
              {dept.name}
            </p>
            {suggested && (
              <span
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                style={{ background: K.PRIMARY_LIGHT, color: K.PRIMARY_HOVER }}
                title="Bu kategori için önerilen departman"
              >
                <Star className="h-2.5 w-2.5" fill="currentColor" />
                Önerilen
              </span>
            )}
          </div>
          <p
            className="mt-1 truncate text-xs font-medium"
            style={{
              color: K.TEXT_MUTED,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <span style={{ color: K.TEXT_SECONDARY }}>{totalStaffCount}</span> personel
            {childCount > 0 && (
              <>
                {' · '}
                <span style={{ color: K.TEXT_SECONDARY }}>{childCount}</span> alt birim
              </>
            )}
          </p>
          {excludedCount > 0 && (
            <span
              className="mt-1.5 inline-flex h-4 items-center rounded px-1.5 text-[9px] font-semibold"
              style={{
                background: K.WARNING_BG,
                color: K.WARNING,
                border: `1px solid ${K.WARNING}40`,
              }}
            >
              {excludedCount} hariç
            </span>
          )}
        </button>

        {/* Checkbox */}
        <button
          type="button"
          role="checkbox"
          aria-checked={check === 'mixed' ? 'mixed' : check}
          aria-label={`${dept.name} seçimi`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-colors duration-150"
          style={{
            background: isOn ? dept.color : K.SURFACE,
            border: `1.5px solid ${isOn ? dept.color : K.BORDER}`,
          }}
        >
          {check === true && (
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
          {check === 'mixed' && (
            <span className="block h-0.5 w-2.5 rounded-sm bg-white" />
          )}
        </button>
      </div>

      {/* Action satırı: drawer + expand */}
      <div
        className="flex items-center justify-between border-t px-3 py-2 pl-5"
        style={{ borderColor: dividerColor }}
      >
        <button
          type="button"
          onClick={onOpenStaff}
          disabled={!canOpenStaff}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium transition-colors duration-150 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
          style={{ color: K.TEXT_SECONDARY }}
        >
          Personeli görüntüle
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {onToggleExpand && (
          <button
            type="button"
            onClick={onToggleExpand}
            aria-label={isExpanded ? 'Alt birimleri gizle' : 'Alt birimleri göster'}
            aria-expanded={isExpanded}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium transition-colors duration-150 hover:bg-white"
            style={{ color: K.TEXT_SECONDARY }}
          >
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {childCount} alt birim
            </span>
            <ChevronDown
              className="h-3.5 w-3.5"
              style={{
                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 150ms ease',
              }}
            />
          </button>
        )}
      </div>

      {/* Expanded alt birim listesi */}
      {isExpanded && children && (
        <ul
          className="border-t pl-1"
          style={{
            borderColor: dividerColor,
            background: K.BG_SOFT,
          }}
        >
          {children}
        </ul>
      )}
    </article>
  );
}

// ---------- Sub-department row (kart içi alt birim) ----------

interface SubDeptRowProps {
  dept: Dept;
  check: CheckState;
  autoIncluded: boolean;
  excludedCount: number;
  onToggle?: () => void;
  onOpenStaff: () => void;
  canOpenStaff: boolean;
}

function SubDeptRow({
  dept,
  check,
  autoIncluded,
  excludedCount,
  onToggle,
  onOpenStaff,
  canOpenStaff,
}: SubDeptRowProps) {
  const isOn = check === true || check === 'mixed';

  return (
    <li
      className="flex items-center gap-2.5 px-4 py-2 transition-colors duration-150 hover:bg-white"
    >
      {/* Renk dot — alt birim kimliği */}
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: dept.color, opacity: isOn ? 1 : 0.45 }}
      />

      {/* İsim + badge'ler */}
      <button
        type="button"
        onClick={onToggle}
        disabled={!onToggle}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
      >
        <div className="flex items-center gap-1.5">
          <span
            className="truncate font-semibold"
            style={{ color: K.TEXT_PRIMARY, fontSize: 13 }}
          >
            {dept.name}
          </span>
          {autoIncluded && (
            <span
              className="inline-flex h-4 items-center rounded px-1.5 text-[9px] font-semibold"
              style={{
                background: K.SURFACE,
                color: K.TEXT_MUTED,
                border: `1px solid ${K.BORDER_SOFT}`,
              }}
            >
              otomatik
            </span>
          )}
          {excludedCount > 0 && (
            <span
              className="inline-flex h-4 items-center rounded px-1.5 text-[9px] font-semibold"
              style={{
                background: K.WARNING_BG,
                color: K.WARNING,
                border: `1px solid ${K.WARNING}40`,
              }}
            >
              {excludedCount} hariç
            </span>
          )}
        </div>
      </button>

      {/* Personel sayısı */}
      <span
        className="shrink-0 text-[11px] font-medium"
        style={{
          color: K.TEXT_MUTED,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {dept.staff.length}
      </span>

      {/* Checkbox */}
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
          <svg
            viewBox="0 0 12 12"
            className="h-2.5 w-2.5"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="2.5,6.5 5,9 9.5,3.5" />
          </svg>
        )}
        {check === 'mixed' && (
          <span className="block h-0.5 w-2 rounded-sm bg-white" />
        )}
      </button>

      {/* Drawer trigger */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenStaff();
        }}
        disabled={!canOpenStaff}
        aria-label="Personel listesini aç"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors duration-150 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-25"
        style={{ color: K.TEXT_MUTED }}
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </li>
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
  childDepts: Dept[];
  excludedStaff: string[];
  setExcludedStaff: React.Dispatch<React.SetStateAction<string[]>>;
}

function StaffSheet({ dept, childDepts, excludedStaff, setExcludedStaff }: StaffSheetProps) {
  const [search, setSearch] = useState('');

  // Tüm gruplar: önce parent'ın direkt personeli, sonra her alt birimin personeli.
  const groups = useMemo<Array<{ dept: Dept; staff: DeptStaff[] }>>(() => {
    const result: Array<{ dept: Dept; staff: DeptStaff[] }> = [];
    if (dept.staff.length > 0) result.push({ dept, staff: dept.staff });
    for (const child of childDepts) {
      if (child.staff.length > 0) result.push({ dept: child, staff: child.staff });
    }
    return result;
  }, [dept, childDepts]);

  const allStaff = useMemo(() => groups.flatMap(g => g.staff), [groups]);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    if (!q) return groups;
    return groups
      .map(g => ({
        dept: g.dept,
        staff: g.staff.filter(
          s => s.name.toLocaleLowerCase('tr-TR').includes(q) ||
               s.title.toLocaleLowerCase('tr-TR').includes(q),
        ),
      }))
      .filter(g => g.staff.length > 0);
  }, [groups, search]);

  const totalCount = allStaff.length;
  const includedCount = allStaff.filter(s => !excludedStaff.includes(s.id)).length;

  const toggleStaff = (id: string) => {
    setExcludedStaff(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const includeAll = () => {
    const ids = new Set(allStaff.map(s => s.id));
    setExcludedStaff(prev => prev.filter(id => !ids.has(id)));
  };

  const excludeAll = () => {
    const ids = allStaff.map(s => s.id);
    setExcludedStaff(prev => Array.from(new Set([...prev, ...ids])));
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
              {includedCount} dahil · {totalCount - includedCount} hariç ·{' '}
              {totalCount} toplam
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
        {filteredGroups.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm" style={{ color: K.TEXT_MUTED }}>
              {totalCount === 0
                ? 'Bu departmana bağlı personel yok.'
                : 'Aramaya uygun kişi yok.'}
            </p>
          </div>
        ) : (
          <div>
            {filteredGroups.map((group, gIdx) => (
              <div key={group.dept.id}>
                {/* Alt birim başlığı — birden fazla grup varsa göster */}
                {filteredGroups.length > 1 && (
                  <div
                    className="flex items-center gap-2 px-5 py-2"
                    style={{ background: K.BG, borderTop: gIdx > 0 ? `1px solid ${K.BORDER_SOFT}` : undefined }}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: group.dept.color }}
                    />
                    <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: K.TEXT_MUTED }}>
                      {group.dept.name}
                    </span>
                    <span className="text-[10px]" style={{ color: K.TEXT_MUTED }}>
                      ({group.staff.length})
                    </span>
                  </div>
                )}
                <ul className="divide-y" style={{ borderColor: K.BORDER_SOFT }}>
                  {group.staff.map((staff) => {
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
                            background: group.dept.color,
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
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
