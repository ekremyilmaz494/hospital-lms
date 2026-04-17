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
import { Search, Loader2, BookOpen } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';

interface Training {
  id: string;
  title: string;
  category: string | null;
}

interface TrainingsResponse {
  trainings: Training[];
}

interface Props {
  staffId: string;
  staffName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

/**
 * Belirli bir personele mevcut eğitimlerden seçim yaparak atama yapar.
 * bulk-assign endpoint'ini kullanır: POST /api/admin/bulk-assign
 */
export function AssignTrainingModal({ staffId, staffName, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  // Yalnızca yayında olan eğitimler atanabilir — arşivlenmiş/taslak eğitimler hariç (feedback_archived_training_filter)
  const { data, isLoading } = useFetch<TrainingsResponse>('/api/admin/trainings?limit=100&publishStatus=published');

  const [selectedTrainings, setSelectedTrainings] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedTrainings([]);
      setSearch('');
    }
  }, [open]);

  const allTrainings = data?.trainings || [];
  const filteredTrainings = allTrainings.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.category ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const toggleTraining = (id: string, newChecked: boolean) => {
    if (newChecked) {
      setSelectedTrainings(prev => [...prev, id]);
    } else {
      setSelectedTrainings(prev => prev.filter(t => t !== id));
    }
  };

  const toggleAll = (newChecked: boolean) => {
    if (newChecked) {
      setSelectedTrainings(filteredTrainings.map(t => t.id));
    } else {
      setSelectedTrainings([]);
    }
  };

  const handleAssign = async () => {
    if (selectedTrainings.length === 0) {
      toast('Lütfen en az bir eğitim seçin', 'error');
      return;
    }

    setAssigning(true);
    try {
      const res = await fetch('/api/admin/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trainingIds: selectedTrainings,
          userIds: [staffId],
          maxAttempts: 3,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Atama işlemi başarısız');
      }

      toast(`${staffName} için eğitim ataması tamamlandı`, 'success');
      onSuccess?.();
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
          <DialogTitle>Eğitim Ata</DialogTitle>
          <DialogDescription>
            <strong>{staffName}</strong> için mevcut eğitimlerden seçim yapın.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4 min-h-75">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Eğitim adı veya kategori ara..."
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
            ) : filteredTrainings.length === 0 ? (
              <div className="text-center p-8 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {allTrainings.length === 0 ? 'Henüz hiç eğitim oluşturulmamış' : 'Eğitim bulunamadı'}
              </div>
            ) : (
              <div className="divide-y relative" style={{ borderColor: 'var(--color-border)' }}>
                {/* Tümünü Seç satırı */}
                <div
                  className="sticky top-0 z-10 p-3 flex items-center gap-3 backdrop-blur-md cursor-pointer select-none"
                  style={{ background: 'var(--color-surface)99', borderBottom: '1px solid var(--color-border)' }}
                  onClick={() => {
                    const allSelected = filteredTrainings.length > 0 && filteredTrainings.every(t => selectedTrainings.includes(t.id));
                    toggleAll(!allSelected);
                  }}
                >
                  {(() => {
                    const allSelected = filteredTrainings.length > 0 && filteredTrainings.every(t => selectedTrainings.includes(t.id));
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
                    Tümünü Seç ({filteredTrainings.length})
                  </span>
                </div>

                {/* Eğitim listesi */}
                {filteredTrainings.map(t => {
                  const isChecked = selectedTrainings.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 p-3 cursor-pointer transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                      onClick={() => toggleTraining(t.id, !isChecked)}
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
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: 'var(--color-primary)15' }}
                      >
                        <BookOpen className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        {t.category && (
                          <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{t.category}</p>
                        )}
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
            disabled={assigning || selectedTrainings.length === 0}
            className="gap-2 text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
            Seçili{selectedTrainings.length > 0 ? ` (${selectedTrainings.length}) ` : ' '}Ata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
