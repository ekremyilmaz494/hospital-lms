'use client';

import { useState } from 'react';
import { Users, Search, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import type { Staff } from '../_types';

export function AssignStaffModal({ deptId, deptName, allStaff, onClose, onSaved }: {
  deptId: string; deptName: string; allStaff: Staff[]; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const available = allStaff.filter(s =>
    s.departmentId !== deptId &&
    (search === '' ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      (s.department || '').toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleAssign = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      const results = await Promise.all([...selected].map(id =>
        fetch(`/api/admin/staff/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ departmentId: deptId }),
        })
      ));
      const failed = results.filter(r => !r.ok).length;
      const succeeded = results.length - failed;
      if (succeeded > 0) toast(`${succeeded} personel departmana eklendi`, 'success');
      if (failed > 0) toast(`${failed} personel eklenemedi`, 'error');
      if (succeeded > 0) {
        onSaved();
        onClose();
      }
    } catch {
      toast('Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PremiumModal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      eyebrow="Departman Ataması"
      title="Personel ekle"
      subtitle={`${deptName} departmanına personel ata.`}
      size="md"
      disableEscape={saving}
      footer={
        <PremiumModalFooter
          summary={
            <span className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              {selected.size > 0 ? (
                <><strong style={{ color: 'var(--k-text-primary)' }}>{selected.size}</strong> personel seçildi</>
              ) : 'Personel seçin'}
            </span>
          }
          actions={
            <>
              <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
              <PremiumButton onClick={handleAssign} disabled={selected.size === 0} loading={saving} icon={<UserPlus className="h-4 w-4" />}>
                {saving ? 'Ekleniyor' : 'Ekle'}
              </PremiumButton>
            </>
          }
        />
      }
    >
      <div className="flex flex-col gap-3">
        <div className="k-input" style={{ height: 42 }}>
          <Search size={15} />
          <input
            placeholder="İsim veya e-posta ile ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Personel ara"
            autoFocus
          />
        </div>

        <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1">
          {available.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10" style={{ color: 'var(--k-text-muted)' }}>
              <Users className="h-7 w-7" />
              <p className="text-sm">{search ? 'Sonuç bulunamadı' : 'Eklenebilecek personel yok'}</p>
            </div>
          ) : available.map(s => {
            const isSelected = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                className="flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left"
                style={{
                  borderColor: isSelected ? 'var(--k-primary)' : 'var(--k-border)',
                  background: isSelected ? 'var(--k-primary-light)' : 'var(--k-surface)',
                }}
              >
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="text-xs font-semibold text-white" style={{ background: 'var(--k-primary)' }}>{s.initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--k-text-primary)' }}>{s.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--k-text-muted)' }}>
                    {s.email}{s.department ? ` · ${s.department}` : ' · Departmansız'}
                  </p>
                </div>
                <div className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                     style={{
                       borderColor: isSelected ? 'var(--k-primary)' : 'var(--k-border-hover)',
                       background: isSelected ? 'var(--k-primary)' : 'transparent',
                       color: '#fff',
                       fontSize: 11,
                     }}>
                  {isSelected && '✓'}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </PremiumModal>
  );
}
