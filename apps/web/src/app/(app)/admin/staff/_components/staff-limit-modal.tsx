'use client';

import { Users, Phone } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

/**
 * Personel (seat) limiti dolduğunda gösterilen uyarı modalı. Backend `checkStaffLimit`
 * 403 + `code: 'STAFF_LIMIT_REACHED'` dönünce açılır — hem tekli personel ekleme
 * (new-staff-modal) hem toplu import (bulk-import-dialog) tarafından paylaşılır.
 *
 * Amaç: admin'e sözleşmeli sınıra ulaşıldığını ve YENİ kapasite için firma yetkilisiyle
 * (Klinovax) iletişime geçmesi gerektiğini net biçimde bildirmek.
 */
export interface StaffLimitInfo {
  /** Etkin limit (sözleşmeli koltuk sayısı) */
  limit: number;
  /** Şu an dolu koltuk (aktif personel + bekleyen davet) */
  used: number;
  /** Eklenmek istenen kişi sayısı (tekli=1, toplu=satır sayısı) */
  requested?: number;
  /** Backend'in döndürdüğü hazır mesaj (fallback) */
  message?: string;
}

export function StaffLimitModal({
  open,
  onClose,
  info,
}: {
  open: boolean;
  onClose: () => void;
  info: StaffLimitInfo | null;
}) {
  if (!info) return null;
  const remaining = Math.max(0, info.limit - info.used);
  const isBulk = (info.requested ?? 1) > 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <div className="mb-1 flex items-center gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-warning-bg, #fef3c7)' }}
            >
              <Users className="h-5 w-5" style={{ color: 'var(--color-warning, #f59e0b)' }} />
            </div>
            <DialogTitle>Personel Limitine Ulaşıldı</DialogTitle>
          </div>
          <DialogDescription>
            Kurumunuz için tanımlı <strong>{info.limit} kişilik</strong> personel sınırına ulaştınız.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Doluluk özeti */}
          <div
            className="flex items-center justify-between rounded-xl border px-4 py-3"
            style={{ background: 'var(--color-surface-hover, #f8fafc)', borderColor: 'var(--color-border)' }}
          >
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>Dolu koltuk</span>
            <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
              {info.used} / {info.limit}
            </span>
          </div>

          {isBulk && (
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <strong>{info.requested}</strong> kişi eklemek istediniz, ancak yalnızca <strong>{remaining}</strong> koltuk boş.
              Sığmayan kayıtlar için önce kapasite artırılmalıdır.
            </p>
          )}

          {/* Aksiyon çağrısı */}
          <div
            className="flex items-start gap-3 rounded-xl border px-4 py-3"
            style={{ background: 'var(--color-warning-bg, #fef3c7)', borderColor: 'var(--color-warning, #f59e0b)' }}
          >
            <Phone className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--color-warning-text, #92400e)' }} />
            <p className="text-[13px]" style={{ color: 'var(--color-warning-text, #92400e)' }}>
              Yeni personel eklemek için <strong>firma yetkilinizle (Klinovax)</strong> iletişime geçerek personel
              kapasitenizi artırın. Mevcut personelleriniz etkilenmez.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="rounded-xl px-5 py-2 text-[13px] font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            Anladım
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
