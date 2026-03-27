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
import { Search, Loader2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Personel Ata</DialogTitle>
          <DialogDescription>
            Bu eğitime personel atayın. Seçilen personele bildirim gönderilecektir.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4 min-h-75">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="İsim veya departman ara..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 overflow-y-auto border rounded-xl" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
              </div>
            ) : filteredStaff.length === 0 ? (
              <div className="text-center p-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>Personel bulunamadı</div>
            ) : (
              <div className="divide-y relative" style={{ borderColor: 'var(--color-border)' }}>
                <div
                  className="sticky top-0 z-10 p-3 flex items-center gap-3 backdrop-blur-md cursor-pointer select-none"
                  style={{ background: 'var(--color-surface)99', borderBottom: '1px solid var(--color-border)' }}
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
                          borderColor: allSelected ? 'var(--color-primary)' : 'var(--color-border)',
                          background: allSelected ? 'var(--color-primary)' : 'transparent',
                          transition: 'background 150ms, border-color 150ms',
                        }}
                      >
                        {allSelected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    );
                  })()}
                  <span className="text-sm font-semibold flex-1">
                    Tümünü Seç ({filteredStaff.length})
                  </span>
                </div>
                {filteredStaff.map(s => {
                  const isChecked = selectedStaff.includes(s.id);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      onClick={() => toggleStaff(s.id, !isChecked)}
                    >
                      <div
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border"
                        style={{
                          borderColor: isChecked ? 'var(--color-primary)' : 'var(--color-border)',
                          background: isChecked ? 'var(--color-primary)' : 'transparent',
                          transition: 'background 150ms, border-color 150ms',
                        }}
                      >
                        {isChecked && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.name}</p>
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{s.department}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
          <Button 
            onClick={handleAssign} 
            disabled={assigning || selectedStaff.length === 0}
            className="gap-2 text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
            Seçili {selectedStaff.length > 0 ? `(${selectedStaff.length}) ` : ''}Ata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
