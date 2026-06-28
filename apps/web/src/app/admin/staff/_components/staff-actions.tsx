'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  MoreHorizontal, Eye, Edit, GraduationCap, Mail, Trash2, KeyRound, UserMinus, UserCheck,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import { ResetPasswordModal } from '@/components/shared/reset-password-modal';
import { K } from '../_lib/palette';
import type { Staff } from '../_types';
import { isSyntheticEmail } from '@/lib/synthetic-email';

const AssignTrainingModal = dynamic(
  () => import('../assign-training-modal').then(m => ({ default: m.AssignTrainingModal })),
  { ssr: false }
);

export function StaffActions({ staff, onChanged }: { staff: Staff; onChanged: () => void }) {
  const router = useRouter();
  const { toast } = useToast();
  const [assignTrainingOpen, setAssignTrainingOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);

  const isPassive = staff.status === 'Pasif';

  // Doğrudan pasifleştir/aktifleştir — kırmızı "Sil" modalına girmeden (geri alınabilir işlem).
  const handleSetActive = async (active: boolean) => {
    setStatusChanging(true);
    try {
      const res = active
        ? await fetch(`/api/admin/staff/${staff.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isActive: true }),
          })
        : await fetch(`/api/admin/staff/${staff.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'İşlem başarısız');
      toast(active ? `${staff.name} aktifleştirildi` : `${staff.name} pasifleştirildi`, 'success');
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'İşlem başarısız', 'error');
    } finally {
      setStatusChanging(false);
    }
  };

  const handleDelete = async (purge: boolean) => {
    setDeleting(true);
    try {
      const url = `/api/admin/staff/${staff.id}${purge ? '?purge=true' : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Silme başarısız');
      toast(purge ? `${staff.name} kalıcı olarak silindi` : `${staff.name} pasifleştirildi`, 'success');
      setConfirmDelete(false);
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Silme başarısız', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg transition-colors duration-150 hover:bg-[var(--k-surface-hover)]" aria-label="Personel işlemleri">
          <MoreHorizontal className="h-4 w-4" style={{ color: 'var(--k-text-muted)' }} />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          style={{
            background: K.SURFACE,
            border: `1.5px solid ${K.BORDER}`,
            borderRadius: 14,
            boxShadow: K.SHADOW_CARD,
            padding: 6,
            minWidth: 200,
          }}
        >
          <DropdownMenuItem
            className="gap-2"
            onClick={() => router.push(`/admin/staff/${staff.id}`)}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <Eye className="h-4 w-4" /> Detay
          </DropdownMenuItem>
          <DropdownMenuItem
            className="gap-2"
            onClick={() => router.push(`/admin/staff/${staff.id}/edit`)}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <Edit className="h-4 w-4" /> Düzenle
          </DropdownMenuItem>
          <DropdownMenuSeparator style={{ background: K.BORDER_LIGHT, margin: '4px 0' }} />
          <DropdownMenuItem
            className="gap-2"
            onClick={() => setAssignTrainingOpen(true)}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <GraduationCap className="h-4 w-4" /> Eğitim Ata
          </DropdownMenuItem>
          {!isSyntheticEmail(staff.email) && (
            <DropdownMenuItem
              className="gap-2"
              onClick={() => { window.location.href = `mailto:${staff.email}`; }}
              style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
            >
              <Mail className="h-4 w-4" /> E-posta Gönder
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="gap-2"
            onClick={() => setResetOpen(true)}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <KeyRound className="h-4 w-4" /> Şifre Sıfırla
          </DropdownMenuItem>
          <DropdownMenuSeparator style={{ background: K.BORDER_LIGHT, margin: '4px 0' }} />
          {isPassive ? (
            <DropdownMenuItem
              className="gap-2"
              disabled={statusChanging}
              onClick={() => handleSetActive(true)}
              style={{ borderRadius: 8, color: K.PRIMARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
            >
              <UserCheck className="h-4 w-4" /> Aktifleştir
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="gap-2"
              disabled={statusChanging}
              onClick={() => handleSetActive(false)}
              style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
            >
              <UserMinus className="h-4 w-4" /> Pasifleştir
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="gap-2"
            onClick={() => setConfirmDelete(true)}
            style={{ borderRadius: 8, color: K.ERROR, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 600 }}
          >
            <Trash2 className="h-4 w-4" /> Sil
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AssignTrainingModal
        staffId={staff.id}
        staffName={staff.name}
        open={assignTrainingOpen}
        onOpenChange={setAssignTrainingOpen}
        onSuccess={onChanged}
      />

      <ResetPasswordModal
        isOpen={resetOpen}
        onClose={() => setResetOpen(false)}
        userId={staff.id}
        userName={staff.name}
        userEmail={staff.email}
        userRole="staff"
      />

      <PremiumModal
        isOpen={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        eyebrow="Tehlikeli İşlem"
        title="Personeli sil"
        subtitle={`${staff.name}${isSyntheticEmail(staff.email) ? '' : ` (${staff.email})`} için bir seçim yap.`}
        size="md"
        disableEscape={deleting}
        footer={
          <PremiumModalFooter
            actions={
              <PremiumButton variant="ghost" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Vazgeç
              </PremiumButton>
            }
          />
        }
      >
        <div className="grid gap-3">
          <button
            onClick={() => handleDelete(false)}
            disabled={deleting}
            className="text-left rounded-xl border p-5 transition-all hover:-translate-y-px disabled:opacity-50"
            style={{ borderColor: 'var(--k-border)', background: 'var(--k-surface)' }}
          >
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-2"
                  style={{ background: 'var(--k-primary-light)', color: 'var(--k-primary)' }}>
              Önerilen
            </span>
            <h4 className="text-base font-semibold mb-1" style={{ color: 'var(--k-text-primary)' }}>Pasifleştir</h4>
            <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              Personel giriş yapamaz; geçmiş sınav ve sertifika kayıtları korunur. Daha sonra yeniden aktifleştirilebilir.
            </p>
          </button>

          <button
            onClick={() => handleDelete(true)}
            disabled={deleting}
            className="text-left rounded-xl border p-5 transition-all hover:-translate-y-px disabled:opacity-50"
            style={{ borderColor: 'var(--k-error)', background: 'var(--k-error-bg)' }}
          >
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider mb-2"
                  style={{ background: 'var(--k-error)', color: '#fff' }}>
              KVKK · Geri alınamaz
            </span>
            <h4 className="text-base font-semibold mb-1" style={{ color: 'var(--k-error)' }}>Kalıcı olarak sil</h4>
            <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              Kullanıcı hesabı ve kişisel veriler tamamen kaldırılır. Bu işlem geri alınamaz.
            </p>
          </button>
        </div>
      </PremiumModal>
    </>
  );
}
