'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle, KeyRound } from 'lucide-react';
import { PremiumModal, PremiumModalFooter, PremiumButton } from './premium-modal';
import { useToast } from './toast';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  userEmail: string;
  /** 'staff' | 'admin' — hangi UI tonu kullanılacak (admin reset daha güçlü uyarı) */
  userRole: 'staff' | 'admin';
  /**
   * POST edilecek endpoint. Default: `/api/admin/users/${userId}/reset-password` (admin caller).
   * Süper admin akışı için `/api/super-admin/users/${userId}/reset-password` geçilir.
   */
  endpoint?: string;
  /** Çağıran rol — onay metnini biçimlendirmek için. Default 'admin'. */
  caller?: 'admin' | 'super_admin';
  onSuccess?: () => void;
}

interface ResetResponse {
  success: boolean;
  tempPassword: string;
  emailSent: boolean;
  email: string;
  firstName: string;
  lastName: string;
}

/**
 * Yönetici tarafından şifre sıfırlama akışı.
 *
 * İki aşamalı: önce onay (uyarı + neden gösterir), sonra geçici şifre + kopyala butonu.
 * Mail başarısız olursa kullanıcıya bilgi verir; admin geçici şifreyi panodan kopyalayıp
 * elden teslim edebilir.
 */
export function ResetPasswordModal({
  isOpen,
  onClose,
  userId,
  userName,
  userEmail,
  userRole,
  endpoint,
  caller = 'admin',
  onSuccess,
}: ResetPasswordModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ResetResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const resolvedEndpoint = endpoint ?? `/api/admin/users/${userId}/reset-password`;

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(resolvedEndpoint, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || 'Şifre sıfırlama başarısız');
      }
      setResult(body as ResetResponse);
      onSuccess?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      toast('Geçici şifre panoya kopyalandı', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast('Kopyalama başarısız — şifreyi manuel seçip kopyalayın', 'error');
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setResult(null);
    setCopied(false);
    onClose();
  };

  // ── Onay aşaması ──────────────────────────────────────────────────────────
  if (!result) {
    return (
      <PremiumModal
        isOpen={isOpen}
        onClose={handleClose}
        eyebrow={userRole === 'admin' ? 'Yönetici Hesabı' : 'Personel Hesabı'}
        title="Şifre sıfırla"
        subtitle={`${userName} (${userEmail}) için şifre sıfırlanacak.`}
        size="md"
        disableEscape={submitting}
        footer={
          <PremiumModalFooter
            actions={
              <>
                <PremiumButton variant="ghost" onClick={handleClose} disabled={submitting}>
                  Vazgeç
                </PremiumButton>
                <PremiumButton variant="primary" onClick={handleConfirm} disabled={submitting}>
                  {submitting ? 'Sıfırlanıyor…' : 'Şifreyi Sıfırla'}
                </PremiumButton>
              </>
            }
          />
        }
      >
        <div className="grid gap-4">
          <div
            className="flex items-start gap-3 rounded-xl border p-4"
            style={{ borderColor: 'var(--k-border)', background: 'var(--k-surface-muted, #fafaf9)' }}
          >
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--k-warning, #d97706)' }} />
            <div className="text-sm leading-relaxed" style={{ color: 'var(--k-text-secondary)' }}>
              Sistem yeni bir <strong>geçici şifre</strong> üretecek ve kullanıcının e-posta adresine gönderecek.
              Kullanıcı bir sonraki girişinde şifresini değiştirmek zorunda kalacak.
              {userRole === 'admin' && caller === 'admin' && (
                <>
                  <br /><br />
                  <strong>Yönetici hesabı sıfırlıyorsunuz.</strong> Bu işlem yalnızca Esas Yönetici tarafından yapılabilir.
                </>
              )}
              {userRole === 'admin' && caller === 'super_admin' && (
                <>
                  <br /><br />
                  <strong>Hastane yöneticisinin şifresini sıfırlıyorsunuz.</strong> İşlem audit log’a kaydedilecek ve mail kullanıcının organizasyonu adına gönderilecek.
                </>
              )}
            </div>
          </div>

          <div
            className="rounded-xl border p-4 text-sm leading-relaxed"
            style={{
              borderColor: 'var(--k-border)',
              background: 'var(--k-surface)',
              color: 'var(--k-text-secondary)',
            }}
          >
            <p className="mb-2">
              <strong>Mail gönderilemezse</strong> sistem geçici şifreyi size gösterecek; panodan kopyalayıp
              kullanıcıya elden teslim edebilirsiniz.
            </p>
            <p style={{ color: 'var(--k-text-muted)', fontSize: 12 }}>
              Eski şifre artık çalışmayacak. Bu işlem geri alınamaz.
            </p>
          </div>
        </div>
      </PremiumModal>
    );
  }

  // ── Sonuç aşaması — geçici şifre + kopyala ────────────────────────────────
  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={handleClose}
      eyebrow="Tamamlandı"
      title="Şifre sıfırlandı"
      subtitle={`${result.firstName} ${result.lastName} için yeni geçici şifre üretildi.`}
      size="md"
      footer={
        <PremiumModalFooter
          actions={
            <PremiumButton variant="primary" onClick={handleClose}>
              Kapat
            </PremiumButton>
          }
        />
      }
    >
      <div className="grid gap-4">
        <div
          className="flex items-start gap-3 rounded-xl border p-4"
          style={{
            borderColor: result.emailSent ? 'var(--k-primary)' : 'var(--k-warning, #d97706)',
            background: result.emailSent ? 'var(--k-primary-light, #ecfdf5)' : '#fffbeb',
          }}
        >
          {result.emailSent ? (
            <Check className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--k-primary)' }} />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--k-warning, #d97706)' }} />
          )}
          <div className="text-sm leading-relaxed" style={{ color: 'var(--k-text-primary)' }}>
            {result.emailSent ? (
              <>
                <strong>{result.email}</strong> adresine yeni şifre maili gönderildi.
                Kullanıcı maili kontrol etmezse aşağıdaki şifreyi de iletebilirsiniz.
              </>
            ) : (
              <>
                <strong>Mail gönderilemedi.</strong> Aşağıdaki geçici şifreyi panodan kopyalayıp
                kullanıcıya doğrudan iletmeniz gerekiyor.
              </>
            )}
          </div>
        </div>

        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wider mb-2 block"
                 style={{ color: 'var(--k-text-muted)' }}>
            Geçici Şifre
          </label>
          <div className="flex items-stretch gap-2">
            <code
              className="flex-1 rounded-xl border px-4 py-3 font-mono text-sm select-all"
              style={{
                borderColor: 'var(--k-border)',
                background: 'var(--k-surface-muted, #fafaf9)',
                color: 'var(--k-text-primary)',
                letterSpacing: '0.05em',
              }}
            >
              {result.tempPassword}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-2 rounded-xl border px-4 font-medium transition-colors hover:bg-[var(--k-surface-hover)]"
              style={{
                borderColor: 'var(--k-border)',
                background: 'var(--k-surface)',
                color: 'var(--k-text-primary)',
                fontSize: 13,
              }}
              aria-label="Şifreyi kopyala"
            >
              {copied ? <Check className="h-4 w-4" style={{ color: 'var(--k-primary)' }} /> : <Copy className="h-4 w-4" />}
              {copied ? 'Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </div>

        <div
          className="flex items-start gap-3 rounded-xl border p-4 text-xs leading-relaxed"
          style={{
            borderColor: 'var(--k-border)',
            background: 'var(--k-surface)',
            color: 'var(--k-text-muted)',
          }}
        >
          <KeyRound className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Bu şifre tek kullanımlıktır. Kullanıcı ilk girişinde kendi şifresini belirleyecek.
            Şifreyi yazılı not olarak <strong>bırakmayın</strong> — sözlü iletip kullanıcının ilk girişi yapmasını sağlayın.
          </div>
        </div>
      </div>
    </PremiumModal>
  );
}
