'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Loader2, Check } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
};

interface Staff {
  id: string;
  name: string;
  department: string;
}

interface StaffResponse {
  staff: Staff[];
}

interface Props {
  trainingId: string;
  maxAttemptsAllowed: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AssignStaffModal({ trainingId, maxAttemptsAllowed, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  // using large limit to get all staff for simple client side filtering
  const { data, isLoading } = useFetch<StaffResponse>('/api/admin/staff?limit=1000');

  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedStaff([]);
      setSearch('');
    }
  }, [open]);

  const allStaff = data?.staff || [];
  const filteredStaff = allStaff.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.department.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStaff = (id: string, newChecked: boolean) => {
    if (newChecked) {
      setSelectedStaff(prev => [...prev, id]);
    } else {
      setSelectedStaff(prev => prev.filter(s => s !== id));
    }
  };

  const toggleAll = (newChecked: boolean) => {
    if (newChecked) {
      setSelectedStaff(filteredStaff.map(s => s.id));
    } else {
      setSelectedStaff([]);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col" style={{ background: K.SURFACE }}>
        <DialogHeader>
          <DialogTitle style={{ fontSize: 18, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY, fontWeight: 700 }}>Personel Ata</DialogTitle>
          <DialogDescription style={{ color: K.TEXT_SECONDARY }}>
            Bu eğitime personel atayın. Seçilen personele bildirim gönderilecektir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4 min-h-75">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4" style={{ color: K.TEXT_MUTED }} />
            <Input
              placeholder="İsim veya departman ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_PRIMARY }}
            />
          </div>

          <div className="flex-1 overflow-y-auto" style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}`, borderRadius: 14, boxShadow: K.SHADOW_CARD }}>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: K.PRIMARY }} />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center p-8 text-sm" style={{ color: K.TEXT_MUTED }}>Personel bulunamadı</div>
            ) : (
              <div className="relative">
                <div
                  className="sticky top-0 z-10 p-3 flex items-center gap-3 cursor-pointer select-none"
                  style={{ background: K.BG, borderBottom: `1px solid ${K.BORDER_LIGHT}` }}
                  onClick={() => {
                    const allSelected = filteredStaff.length > 0 && filteredStaff.every(s => selectedStaff.includes(s.id));
                    toggleAll(!allSelected);
                  }}
                >
                  {(() => {
                    const allSelected = filteredStaff.length > 0 && filteredStaff.every(s => selectedStaff.includes(s.id));
                    return (
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                        style={{
                          borderColor: allSelected ? K.PRIMARY : K.BORDER,
                          background: allSelected ? K.PRIMARY : 'transparent',
                          transition: 'background 150ms, border-color 150ms',
                        }}
                      >
                        {allSelected && <Check className="h-3 w-3" style={{ color: 'white' }} strokeWidth={3} />}
                      </div>
                    );
                  })()}
                  <span className="text-[11px] font-semibold uppercase tracking-wide flex-1" style={{ color: K.TEXT_MUTED }}>
                    Tümünü Seç ({filteredStaff.length})
                  </span>
                </div>
                {filteredStaff.map(s => {
                  const isChecked = selectedStaff.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 cursor-pointer"
                      style={{ borderBottom: `1px solid ${K.BORDER_LIGHT}`, background: K.SURFACE }}
                      onClick={() => toggleStaff(s.id, !isChecked)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = K.SURFACE; }}
                    >
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                        style={{
                          borderColor: isChecked ? K.PRIMARY : K.BORDER,
                          background: isChecked ? K.PRIMARY : 'transparent',
                          transition: 'background 150ms, border-color 150ms',
                        }}
                      >
                        {isChecked && <Check className="h-3 w-3" style={{ color: 'white' }} strokeWidth={3} />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium" style={{ color: K.TEXT_PRIMARY }}>{s.name}</p>
                        <p className="text-xs" style={{ color: K.TEXT_MUTED }}>{s.department}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} style={{ background: K.SURFACE, borderColor: K.BORDER, color: K.TEXT_SECONDARY }}>İptal</Button>
          <Button
            onClick={handleAssign}
            disabled={assigning || selectedStaff.length === 0}
            className="gap-2 text-white"
            style={{ background: K.PRIMARY }}
          >
            {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
            Seçili {selectedStaff.length > 0 ? `(${selectedStaff.length}) ` : ''}Ata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
