'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  MoreHorizontal, Eye, Edit, GraduationCap, Mail, Trash2,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import { K } from '../_lib/palette';
import type { Staff } from '../_types';

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
          <DropdownMenuItem
            className="gap-2"
            onClick={() => { window.location.href = `mailto:${staff.email}`; }}
            style={{ borderRadius: 8, color: K.TEXT_SECONDARY, fontFamily: K.FONT_DISPLAY, fontSize: 13, fontWeight: 500 }}
          >
            <Mail className="h-4 w-4" /> E-posta Gönder
          </DropdownMenuItem>
          <DropdownMenuSeparator style={{ background: K.BORDER_LIGHT, margin: '4px 0' }} />
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
      />

      <PremiumModal
        isOpen={confirmDelete}
        onClose={() => !deleting && setConfirmDelete(false)}
        eyebrow="Tehlikeli İşlem"
        title="Personeli sil"
        subtitle={`${staff.name} (${staff.email}) için bir seçim yap.`}
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
