'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, BookOpen, Check } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';

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
 * POST /api/admin/bulk-assign
 */
export function AssignTrainingModal({ staffId, staffName, open, onOpenChange, onSuccess }: Props) {
  const { toast } = useToast();
  const { data, isLoading } = useFetch<TrainingsResponse>(
    open ? '/api/admin/trainings?limit=500&publishStatus=published' : null
  );

  const [selectedTrainings, setSelectedTrainings] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (!open) {
      setSelectedTrainings([]);
      setSearch('');
    }
  }, [open]);

  const allTrainings = useMemo(() => data?.trainings ?? [], [data]);

  const filteredTrainings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allTrainings;
    return allTrainings.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q)
    );
  }, [allTrainings, search]);

  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Training[]>();
    for (const t of filteredTrainings) {
      const key = t.category?.trim() || 'Kategorisiz';
      const arr = map.get(key);
      if (arr) arr.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr'));
  }, [filteredTrainings]);

  const toggleTraining = (id: string) => {
    setSelectedTrainings(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredTrainings.length > 0 &&
    filteredTrainings.every(t => selectedTrainings.includes(t.id));

  const toggleAll = () => {
    if (allFilteredSelected) {
      const filteredIds = new Set(filteredTrainings.map(t => t.id));
      setSelectedTrainings(prev => prev.filter(id => !filteredIds.has(id)));
    } else {
      setSelectedTrainings(prev => {
        const set = new Set(prev);
        for (const t of filteredTrainings) set.add(t.id);
        return [...set];
      });
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
    <PremiumModal
      isOpen={open}
      onClose={() => { if (!assigning) onOpenChange(false); }}
      eyebrow="Eğitim Ataması"
      title="Eğitim ata"
      subtitle={`${staffName} için yayındaki eğitimlerden seç.`}
      size="lg"
      disableEscape={assigning}
      footer={
        <PremiumModalFooter
          summary={
            <span>
              {selectedTrainings.length > 0
                ? <><strong style={{ color: '#0a0a0a' }}>{selectedTrainings.length.toString().padStart(2, '0')}</strong> eğitim seçildi</>
                : 'Eğitim seç'}
            </span>
          }
          actions={
            <>
              <PremiumButton variant="ghost" onClick={() => onOpenChange(false)} disabled={assigning}>
                İptal
              </PremiumButton>
              <PremiumButton
                onClick={handleAssign}
                disabled={selectedTrainings.length === 0}
                loading={assigning}
                icon={<Check className="h-4 w-4" />}
              >
                {assigning ? 'Atanıyor' : selectedTrainings.length > 0 ? `${selectedTrainings.length} Eğitimi Ata` : 'Ata'}
              </PremiumButton>
            </>
          }
        />
      }
    >
      <div className="atm-root">
        {/* Search */}
        <div className="atm-search">
          <Search className="atm-search-icon" />
          <input
            className="atm-search-input"
            placeholder="Eğitim adı veya kategori ara..."
            aria-label="Eğitim ara"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {filteredTrainings.length > 0 && (
            <button
              type="button"
              onClick={toggleAll}
              className="atm-all"
              aria-pressed={allFilteredSelected}
            >
              {allFilteredSelected ? 'Seçimi kaldır' : 'Tümünü seç'}
            </button>
          )}
        </div>

        {/* List */}
        <div className="atm-list">
          {isLoading ? (
            <div className="atm-status">
              <Loader2 className="atm-spin" />
              <p>Yayındaki eğitimler yükleniyor…</p>
            </div>
          ) : filteredTrainings.length === 0 ? (
            <div className="atm-status">
              <div className="atm-empty-icon">
                <BookOpen className="h-5 w-5" />
              </div>
              <p>
                {allTrainings.length === 0
                  ? 'Henüz yayında eğitim yok. Önce bir eğitim oluşturup yayınla.'
                  : 'Arama kriterine uyan eğitim bulunamadı.'}
              </p>
            </div>
          ) : (
            <>
              {groupedByCategory.map(([category, items]) => (
                <section key={category} className="atm-group">
                  <h5 className="atm-group-head">
                    <span>{category}</span>
                    <span className="atm-group-count">{items.length.toString().padStart(2, '0')}</span>
                  </h5>
                  <ul className="atm-items">
                    {items.map((t, i) => {
                      const isChecked = selectedTrainings.includes(t.id);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => toggleTraining(t.id)}
                            className={`atm-item ${isChecked ? 'atm-item-on' : ''}`}
                            style={{ animationDelay: `${Math.min(i * 18, 240)}ms` }}
                            aria-pressed={isChecked}
                          >
                            <span className={`atm-check ${isChecked ? 'atm-check-on' : ''}`}>
                              {isChecked && <Check className="h-3 w-3" />}
                            </span>
                            <span className="atm-item-icon">
                              <BookOpen className="h-3.5 w-3.5" />
                            </span>
                            <span className="atm-item-body">
                              <span className="atm-item-title">{t.title}</span>
                              {t.category && <span className="atm-item-cat">{t.category}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .atm-root { display: flex; flex-direction: column; gap: 14px; }

        /* ── Search ── */
        .atm-search {
          position: relative;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        :global(.atm-search-icon) {
          position: absolute;
          left: 14px;
          width: 16px;
          height: 16px;
          color: #8a8578;
          pointer-events: none;
        }
        .atm-search-input {
          flex: 1;
          height: 44px;
          padding: 0 14px 0 40px;
          border-radius: 10px;
          border: 1px solid #ebe7df;
          background: #ffffff;
          font-size: 14px;
          color: #0a0a0a;
          outline: none;
          font-family: inherit;
          transition: border-color 160ms ease, box-shadow 160ms ease;
        }
        .atm-search-input:focus {
          border-color: #0a0a0a;
          box-shadow: 0 0 0 3px rgba(10, 10, 10, 0.06);
        }
        .atm-all {
          display: inline-flex;
          align-items: center;
          height: 44px;
          padding: 0 14px;
          border-radius: 999px;
          background: transparent;
          color: #6b6a63;
          border: 1px solid #ebe7df;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .atm-all:hover { background: #0a0a0a; color: #fafaf7; border-color: #0a0a0a; }
        .atm-all[aria-pressed="true"] { background: #faf8f2; border-color: #0a0a0a; color: #0a0a0a; }

        /* ── List ── */
        .atm-list {
          max-height: 420px;
          overflow-y: auto;
          padding-right: 4px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .atm-list::-webkit-scrollbar { width: 8px; }
        .atm-list::-webkit-scrollbar-track { background: transparent; }
        .atm-list::-webkit-scrollbar-thumb { background: #ebe7df; border-radius: 4px; }

        .atm-group { display: flex; flex-direction: column; gap: 4px; }
        .atm-group-head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 2px;
          font-family: var(--font-editorial, serif);
          font-size: 13px;
          font-weight: 500;
          color: #0a0a0a;
          font-variation-settings: 'opsz' 24;
          letter-spacing: -0.005em;
          margin: 0;
          border-bottom: 1px dashed #ebe7df;
          padding-bottom: 8px;
        }
        .atm-group-count {
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          color: #8a8578;
          letter-spacing: 0.06em;
          font-variant-numeric: tabular-nums;
        }

        .atm-items {
          list-style: none;
          margin: 0;
          padding: 6px 0 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .atm-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid transparent;
          text-align: left;
          cursor: pointer;
          font-family: inherit;
          opacity: 0;
          animation: atm-in 320ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: border-color 160ms ease, background 160ms ease;
        }
        @keyframes atm-in {
          from { opacity: 0; transform: translateY(3px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .atm-item:hover { border-color: #ebe7df; background: #faf8f2; }
        .atm-item-on {
          background: #0a0a0a;
          border-color: #0a0a0a;
        }
        .atm-item-on:hover { background: #0a0a0a; border-color: #0a0a0a; }
        .atm-item:focus-visible { outline: 2px solid #0a0a0a; outline-offset: 2px; }

        .atm-check {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          border-radius: 999px;
          border: 1.5px solid #d9d4c4;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: #0a0a0a;
          transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
        }
        .atm-check-on {
          background: #fafaf7;
          border-color: #fafaf7;
          color: #0a0a0a;
        }

        .atm-item-icon {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #faf8f2;
          color: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 160ms ease, color 160ms ease;
        }
        .atm-item-on .atm-item-icon {
          background: rgba(255, 255, 255, 0.14);
          color: #fafaf7;
        }

        .atm-item-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .atm-item-title {
          font-family: var(--font-editorial, serif);
          font-size: 14px;
          font-weight: 500;
          font-variation-settings: 'opsz' 24;
          color: #0a0a0a;
          letter-spacing: -0.005em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .atm-item-on .atm-item-title { color: #fafaf7; }
        .atm-item-cat {
          font-size: 11px;
          color: #6b6a63;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .atm-item-on .atm-item-cat { color: rgba(250, 250, 247, 0.65); }

        /* ── Status / Empty ── */
        .atm-status {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 48px 20px;
          gap: 12px;
          color: #8a8578;
        }
        :global(.atm-spin) {
          width: 24px;
          height: 24px;
          color: #0a0a0a;
          animation: atm-rot 900ms linear infinite;
        }
        @keyframes atm-rot { to { transform: rotate(360deg); } }
        .atm-empty-icon {
          width: 44px;
          height: 44px;
          border-radius: 999px;
          background: #faf8f2;
          color: #0a0a0a;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .atm-status p {
          font-size: 13px;
          line-height: 1.55;
          max-width: 360px;
          margin: 0;
        }

        @media (max-width: 520px) {
          .atm-search { flex-wrap: wrap; }
          .atm-all { flex: 1; justify-content: center; }
        }
      `}</style>
    </PremiumModal>
  );
}
