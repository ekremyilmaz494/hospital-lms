'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Loader2, Check, Users } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import {
  CREAM, INK, INK_SOFT, GOLD, RULE, OLIVE, CARD_BG, STATUS_TOKENS,
  FONT_DISPLAY, FONT_MONO,
} from '@/lib/editorial-palette';

interface Staff {
  id: string;
  name: string;
  department: string;
}

interface StaffResponse {
  staff: Staff[];
}

interface AssignedResponse {
  userIds: string[];
}

interface Props {
  trainingId: string;
  maxAttemptsAllowed: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AssignStaffModal({ trainingId, maxAttemptsAllowed, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const { data: staffData, isLoading } = useFetch<StaffResponse>(open ? '/api/admin/staff?limit=1000' : null);
  const { data: assignedData } = useFetch<AssignedResponse>(
    open ? `/api/admin/trainings/${trainingId}/assignments?currentPeriodOnly=1` : null,
  );

  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedStaff([]);
      setSearch('');
    }
  }, [open]);

  const allStaff = staffData?.staff || [];
  const assignedSet = useMemo(
    () => new Set(assignedData?.userIds ?? []),
    [assignedData],
  );

  const filteredStaff = useMemo(
    () => allStaff.filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.department.toLowerCase().includes(search.toLowerCase()),
    ),
    [allStaff, search],
  );

  const assignableStaff = useMemo(
    () => filteredStaff.filter(s => !assignedSet.has(s.id)),
    [filteredStaff, assignedSet],
  );

  const allAssignableSelected =
    assignableStaff.length > 0 && assignableStaff.every(s => selectedStaff.includes(s.id));

  const toggleStaff = (id: string) => {
    if (assignedSet.has(id)) return;
    setSelectedStaff(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (allAssignableSelected) {
      setSelectedStaff([]);
    } else {
      setSelectedStaff(assignableStaff.map(s => s.id));
    }
  };

  const handleAssign = async () => {
    if (selectedStaff.length === 0) {
      toast('Lütfen en az bir personel seçin', 'error');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch(`/api/admin/trainings/${trainingId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: selectedStaff,
          maxAttempts: maxAttemptsAllowed,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Atama işlemi başarısız');
      }

      toast('Personel ataması başarıyla tamamlandı', 'success');
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast((err as Error).message, 'error');
    } finally {
      setAssigning(false);
    }
  };

  const totalAssignable = allStaff.filter(s => !assignedSet.has(s.id)).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden"
        style={{
          background: '#fafaf7',
          border: `1px solid ${RULE}`,
          borderRadius: 20,
          boxShadow:
            '0 0 0 1px rgba(15, 23, 42, 0.04) inset, 0 1px 0 0 rgba(255, 255, 255, 0.9) inset, 0 18px 48px -12px rgba(15, 23, 42, 0.18), 0 40px 96px -24px rgba(15, 23, 42, 0.22)',
        }}
      >
        {/* ── Header ── */}
        <DialogHeader
          className="px-7"
          style={{
            paddingTop: 44,
            paddingBottom: 20,
            borderBottom: `1px solid ${RULE}`,
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: GOLD,
              marginBottom: 10,
            }}
          >
            № 03 · Personel Ata
          </div>
          <DialogTitle
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 28,
              fontWeight: 500,
              fontVariationSettings: "'opsz' 48, 'SOFT' 50",
              color: INK,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: 0,
            }}
          >
            Bu eğitime personel ata
          </DialogTitle>
          <DialogDescription
            style={{
              fontSize: 13,
              color: INK_SOFT,
              marginTop: 6,
              lineHeight: 1.55,
            }}
          >
            Seçilen personele bildirim ve e-posta gönderilir. Aktif dönemde zaten atanmış kullanıcılar listede pasiftir.
          </DialogDescription>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-hidden flex flex-col gap-4 px-7 py-5 min-h-105">
          {/* Search */}
          <div
            className="flex items-center gap-2.5"
            style={{
              height: 42,
              padding: '0 14px',
              background: CARD_BG,
              border: `1.5px solid ${RULE}`,
              borderRadius: 10,
              transition: 'border-color 160ms, box-shadow 160ms',
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = OLIVE;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${OLIVE}1f`;
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = RULE;
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: INK_SOFT }} />
            <input
              type="text"
              placeholder="İsim veya departman ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent border-0 outline-none text-[14px]"
              style={{
                color: INK,
                fontFamily: FONT_DISPLAY,
              }}
            />
          </div>

          {/* List card */}
          <div
            className="flex-1 overflow-hidden flex flex-col"
            style={{
              background: CARD_BG,
              border: `1px solid ${RULE}`,
              borderRadius: 14,
            }}
          >
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center p-12">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: INK_SOFT }} />
              </div>
            ) : allStaff.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 p-12">
                <Users className="h-8 w-8" style={{ color: INK_SOFT, opacity: 0.5 }} />
                <p style={{ fontSize: 13, color: INK_SOFT }}>Bu kurumda henüz personel yok</p>
              </div>
            ) : assignableStaff.length === 0 && filteredStaff.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 p-12">
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 500, color: INK }}>
                  Aramayla eşleşen personel yok
                </p>
                <p style={{ fontSize: 12, color: INK_SOFT }}>Arama terimini değiştir</p>
              </div>
            ) : (
              <>
                {/* Sticky select-all header */}
                <button
                  type="button"
                  onClick={toggleAll}
                  disabled={assignableStaff.length === 0}
                  className="sticky top-0 z-10 flex items-center gap-3 cursor-pointer select-none w-full text-left disabled:cursor-not-allowed"
                  style={{
                    padding: '12px 16px',
                    background: '#faf8f2',
                    borderBottom: `1px solid ${RULE}`,
                  }}
                >
                  <CheckBox checked={allAssignableSelected} dimmed={assignableStaff.length === 0} />
                  <span
                    className="flex-1"
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: INK_SOFT,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {allAssignableSelected ? 'Seçimi Kaldır' : 'Tümünü Seç'} · {assignableStaff.length}
                  </span>
                  {assignedSet.size > 0 && (
                    <span
                      style={{
                        fontFamily: FONT_MONO,
                        fontSize: 10,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: STATUS_TOKENS.completed.ink,
                        background: STATUS_TOKENS.completed.bg,
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {assignedSet.size} atanmış
                    </span>
                  )}
                </button>

                {/* List body */}
                <div className="flex-1 overflow-y-auto">
                  {filteredStaff.map(s => {
                    const isAssigned = assignedSet.has(s.id);
                    const isSelected = !isAssigned && selectedStaff.includes(s.id);

                    return (
                      <div
                        key={s.id}
                        onClick={() => toggleStaff(s.id)}
                        className={isAssigned ? 'cursor-not-allowed' : 'cursor-pointer'}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '11px 16px',
                          borderBottom: `1px solid ${RULE}`,
                          background: isSelected ? `${OLIVE}0a` : CARD_BG,
                          borderLeft: isSelected ? `2px solid ${OLIVE}` : '2px solid transparent',
                          opacity: isAssigned ? 0.55 : 1,
                          transition: 'background 140ms, border-color 140ms',
                        }}
                        onMouseEnter={(e) => {
                          if (isAssigned || isSelected) return;
                          e.currentTarget.style.background = '#faf8f2';
                        }}
                        onMouseLeave={(e) => {
                          if (isAssigned || isSelected) return;
                          e.currentTarget.style.background = CARD_BG;
                        }}
                      >
                        <CheckBox checked={isSelected} dimmed={isAssigned} />

                        {/* Avatar */}
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: isAssigned ? '#e7e5e4' : INK,
                            color: isAssigned ? INK_SOFT : CREAM,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            fontFamily: FONT_MONO,
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(s.name)}
                        </div>

                        {/* Name + dept */}
                        <div className="flex-1 min-w-0">
                          <p
                            style={{
                              fontSize: 13.5,
                              fontWeight: 600,
                              color: INK,
                              margin: '0 0 2px',
                              fontFamily: FONT_DISPLAY,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.name}
                          </p>
                          <p
                            style={{
                              fontSize: 11.5,
                              color: INK_SOFT,
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {s.department || '—'}
                          </p>
                        </div>

                        {/* Assigned badge */}
                        {isAssigned && (
                          <span
                            style={{
                              fontFamily: FONT_MONO,
                              fontSize: 9.5,
                              fontWeight: 700,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: STATUS_TOKENS.completed.ink,
                              background: STATUS_TOKENS.completed.bg,
                              padding: '4px 9px',
                              borderRadius: 4,
                              flexShrink: 0,
                            }}
                          >
                            Atanmış
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Hint footer */}
          {totalAssignable === 0 && allStaff.length > 0 && (
            <p
              style={{
                fontSize: 12,
                color: INK_SOFT,
                textAlign: 'center',
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              Tüm personel bu eğitime zaten atanmış.
            </p>
          )}
        </div>

        {/* ── Footer ── */}
        <DialogFooter
          className="px-7 py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-between gap-2.5 m-0"
          style={{ background: '#faf8f2', borderTop: `1px solid ${RULE}` }}
        >
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: 11,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: INK_SOFT,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {selectedStaff.length} kişi seçildi
          </span>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={assigning}
              style={{
                height: 42,
                padding: '0 18px',
                background: 'transparent',
                color: INK_SOFT,
                border: `1.5px solid ${RULE}`,
                borderRadius: 10,
                fontFamily: FONT_DISPLAY,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: assigning ? 'not-allowed' : 'pointer',
                transition: 'border-color 160ms, color 160ms',
              }}
              onMouseEnter={(e) => {
                if (assigning) return;
                e.currentTarget.style.borderColor = INK;
                e.currentTarget.style.color = INK;
              }}
              onMouseLeave={(e) => {
                if (assigning) return;
                e.currentTarget.style.borderColor = RULE;
                e.currentTarget.style.color = INK_SOFT;
              }}
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={assigning || selectedStaff.length === 0}
              style={{
                height: 42,
                padding: '0 22px',
                background: INK,
                color: CREAM,
                border: `1.5px solid ${INK}`,
                borderRadius: 10,
                fontFamily: FONT_DISPLAY,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: assigning || selectedStaff.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedStaff.length === 0 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                transition: 'background 160ms, border-color 160ms',
              }}
              onMouseEnter={(e) => {
                if (assigning || selectedStaff.length === 0) return;
                e.currentTarget.style.background = OLIVE;
                e.currentTarget.style.borderColor = OLIVE;
              }}
              onMouseLeave={(e) => {
                if (assigning || selectedStaff.length === 0) return;
                e.currentTarget.style.background = INK;
                e.currentTarget.style.borderColor = INK;
              }}
            >
              {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
              {selectedStaff.length > 0 ? `${selectedStaff.length} kişiyi ata` : 'Ata'}
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckBox({ checked, dimmed }: { checked: boolean; dimmed?: boolean }) {
  return (
    <div
      style={{
        width: 18,
        height: 18,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        border: `1.5px solid ${checked ? OLIVE : RULE}`,
        background: checked ? OLIVE : 'transparent',
        opacity: dimmed ? 0.5 : 1,
        transition: 'background 140ms, border-color 140ms',
      }}
    >
      {checked && <Check className="h-3 w-3" style={{ color: CREAM }} strokeWidth={3} />}
    </div>
  );
}
