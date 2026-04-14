'use client';

import { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';

interface Period {
  id: string;
  name: string;
  requiredPoints: number;
}

interface Target {
  id: string;
  unvan: string | null;
  userId: string | null;
  requiredPoints: number;
  user: { id: string; firstName: string; lastName: string; title: string | null } | null;
}

interface TargetsData {
  targets: Target[];
}

const STANDARD_UNVANLAR = [
  'Uzman Hekim',
  'Pratisyen Hekim',
  'Hemşire',
  'Ebe',
  'Sağlık Teknikeri',
  'Sağlık Memuru',
  'Fizyoterapist',
  'Eczacı',
];

interface Props {
  periods: Period[];
}

export function TargetsTab({ periods }: Props) {
  const { toast } = useToast();
  const [periodId, setPeriodId] = useState(periods[0]?.id ?? '');
  const selectedPeriod = periods.find(p => p.id === periodId);

  const url = periodId ? `/api/admin/smg/targets?periodId=${periodId}` : null;
  const { data, refetch } = useFetch<TargetsData>(url);
  const targets = data?.targets ?? [];

  // Unvan → target map
  const byUnvan = new Map<string, Target>();
  let defaultTarget: Target | null = null;
  const userTargets: Target[] = [];
  for (const t of targets) {
    if (t.userId) userTargets.push(t);
    else if (t.unvan) byUnvan.set(t.unvan, t);
    else defaultTarget = t;
  }

  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Kişisel override formu
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; firstName: string; lastName: string; title: string | null }>>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userPoints, setUserPoints] = useState('');

  const handleUserSearch = async (q: string) => {
    setUserSearch(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/staff?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const json = await res.json();
        setSearchResults((json.users ?? json.data ?? []).slice(0, 5));
      }
    } catch {
      setSearchResults([]);
    }
  };

  const upsertUnvanTarget = async (unvan: string | null, requiredPointsStr: string) => {
    if (!periodId || !requiredPointsStr) return;
    const requiredPoints = Number(requiredPointsStr);
    if (!requiredPoints || requiredPoints < 1) return;

    const key = unvan ?? '__default__';
    setBusyKey(key);
    try {
      const existing = unvan ? byUnvan.get(unvan) : defaultTarget;
      if (existing) {
        const res = await fetch(`/api/admin/smg/targets/${existing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requiredPoints }),
        });
        if (!res.ok) {
          toast('Güncelleme başarısız.', 'error');
          return;
        }
      } else {
        const res = await fetch('/api/admin/smg/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periodId, unvan: unvan ?? undefined, requiredPoints }),
        });
        if (!res.ok) {
          toast('Ekleme başarısız.', 'error');
          return;
        }
      }
      toast('Hedef kaydedildi.', 'success');
      refetch?.();
    } finally {
      setBusyKey(null);
    }
  };

  const deleteTarget = async (id: string) => {
    if (!confirm('Bu hedefi silmek istediğinize emin misiniz?')) return;
    const res = await fetch(`/api/admin/smg/targets/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast('Silme başarısız.', 'error');
      return;
    }
    toast('Hedef silindi.', 'success');
    refetch?.();
  };

  const addUserTarget = async () => {
    if (!selectedUserId || !userPoints) {
      toast('Personel ve puan zorunlu.', 'error');
      return;
    }
    const res = await fetch('/api/admin/smg/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodId, userId: selectedUserId, requiredPoints: Number(userPoints) }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast(err.error ?? 'Ekleme başarısız.', 'error');
      return;
    }
    toast('Bireysel hedef eklendi.', 'success');
    setSelectedUserId(null);
    setUserSearch('');
    setUserPoints('');
    setSearchResults([]);
    refetch?.();
  };

  if (periods.length === 0) {
    return (
      <div className="p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Henüz SMG dönemi yok. Hedef tanımlamak için önce bir dönem oluşturun.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold" style={{ color: 'var(--color-text-secondary)' }}>Dönem:</label>
        <select
          value={periodId}
          onChange={e => setPeriodId(e.target.value)}
          className="text-sm rounded-xl px-3 py-1.5 border outline-none"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
        >
          {periods.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Unvana göre hedefler */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Unvana Göre Hedefler</h3>
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface-2)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Unvan</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Hedef Puan</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              <TargetRow
                label="Varsayılan (Tüm Personel)"
                existing={defaultTarget}
                onSave={pts => upsertUnvanTarget(null, pts)}
                onDelete={defaultTarget ? () => deleteTarget(defaultTarget!.id) : undefined}
                busy={busyKey === '__default__'}
                fallback={selectedPeriod?.requiredPoints}
              />
              {STANDARD_UNVANLAR.map(unvan => (
                <TargetRow
                  key={unvan}
                  label={unvan}
                  existing={byUnvan.get(unvan) ?? null}
                  onSave={pts => upsertUnvanTarget(unvan, pts)}
                  onDelete={byUnvan.get(unvan) ? () => deleteTarget(byUnvan.get(unvan)!.id) : undefined}
                  busy={busyKey === unvan}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bireysel override */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>Bireysel Hedef Override</h3>
        <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 relative">
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Personel Ara</label>
              <Input
                value={userSearch}
                onChange={e => handleUserSearch(e.target.value)}
                placeholder="İsim yaz..."
                className="rounded-xl"
              />
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-lg z-10 max-h-48 overflow-y-auto" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  {searchResults.map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setSelectedUserId(u.id);
                        setUserSearch(`${u.firstName} ${u.lastName}${u.title ? ` · ${u.title}` : ''}`);
                        setSearchResults([]);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:opacity-80"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {u.firstName} {u.lastName}{u.title && <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>{u.title}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--color-text-secondary)' }}>Hedef Puan</label>
              <div className="flex gap-2">
                <Input type="number" min={1} value={userPoints} onChange={e => setUserPoints(e.target.value)} className="rounded-xl" />
                <Button onClick={addUserTarget} className="gap-1 rounded-xl"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>

          {userTargets.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-sm">
                <tbody>
                  {userTargets.map(t => (
                    <tr key={t.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td className="px-4 py-2 font-medium" style={{ color: 'var(--color-text)' }}>
                        {t.user ? `${t.user.firstName} ${t.user.lastName}` : 'Silinmiş kullanıcı'}
                        {t.user?.title && <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>{t.user.title}</span>}
                      </td>
                      <td className="px-4 py-2 font-semibold" style={{ color: 'var(--color-primary)' }}>{t.requiredPoints} puan</td>
                      <td className="px-4 py-2">
                        <button onClick={() => deleteTarget(t.id)} className="p-1.5 rounded-lg" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TargetRow({
  label,
  existing,
  onSave,
  onDelete,
  busy,
  fallback,
}: {
  label: string;
  existing: Target | null;
  onSave: (pts: string) => void;
  onDelete?: () => void;
  busy: boolean;
  fallback?: number;
}) {
  const [value, setValue] = useState((existing?.requiredPoints ?? '').toString());

  return (
    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
      <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-text)' }}>
        {label}
        {!existing && fallback !== undefined && (
          <span className="text-xs ml-2" style={{ color: 'var(--color-text-muted)' }}>(dönem: {fallback})</span>
        )}
      </td>
      <td className="px-4 py-3">
        <Input
          type="number"
          min={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={() => {
            if (value && Number(value) !== existing?.requiredPoints) onSave(value);
          }}
          placeholder={existing ? '' : 'Tanımlanmamış'}
          className="rounded-xl max-w-[120px]"
        />
      </td>
      <td className="px-4 py-3">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--color-text-muted)' }} />
        ) : existing && onDelete ? (
          <button onClick={onDelete} className="p-1.5 rounded-lg" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Yeni</span>
        )}
      </td>
    </tr>
  );
}
