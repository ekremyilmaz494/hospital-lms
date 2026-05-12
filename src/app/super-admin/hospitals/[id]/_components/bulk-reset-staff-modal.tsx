'use client';

import { useState } from 'react';
import { KeyRound, TriangleAlert, FileDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/shared/toast';

interface BulkResetItem {
  id: string;
  fullName: string;
  tcKimlik: string;
  email: string | null;
  tempPassword: string;
  department: string | null;
  title: string | null;
}

interface BulkResetResponse {
  succeeded: number;
  failed: number;
  total: number;
  items: BulkResetItem[];
  failedDetails?: { name: string; reason: string }[];
}

export function BulkResetStaffModal({
  open,
  onClose,
  hospitalId,
  hospitalName,
  staffCount,
}: {
  open: boolean;
  onClose: () => void;
  hospitalId: string;
  hospitalName: string;
  staffCount: number;
}) {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState('');
  const [step, setStep] = useState<'confirm' | 'processing' | 'done'>('confirm');
  const [result, setResult] = useState<BulkResetResponse | null>(null);

  const reset = () => {
    setConfirmText('');
    setStep('confirm');
    setResult(null);
  };

  const handleClose = () => {
    if (step === 'processing') return;
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (confirmText.trim() !== hospitalName) return;
    setStep('processing');
    try {
      const res = await fetch(`/api/super-admin/hospitals/${hospitalId}/staff/bulk-reset-passwords`, {
        method: 'POST',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Toplu sıfırlama başarısız');
      setResult(body as BulkResetResponse);
      setStep('done');

      if ((body as BulkResetResponse).items?.length > 0) {
        await downloadPdf(body as BulkResetResponse);
      } else {
        toast('Hiç personelin şifresi sıfırlanamadı', 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
      setStep('confirm');
    }
  };

  const downloadPdf = async (data: BulkResetResponse) => {
    try {
      const pdfRes = await fetch('/api/admin/staff/credentials-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: hospitalId,
          maskMode: 'full',
          items: data.items.map(i => ({
            fullName: i.fullName,
            tcKimlik: i.tcKimlik,
            email: i.email ?? '',
            tempPassword: i.tempPassword,
            department: i.department,
            title: i.title,
          })),
        }),
      });
      if (!pdfRes.ok) {
        const body = await pdfRes.json().catch(() => ({}));
        throw new Error(body.error || 'PDF üretilemedi');
      }
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeName = hospitalName.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40);
      link.download = `${safeName}-personel-giris-bilgileri-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast(`${data.succeeded} personelin şifresi sıfırlandı, PDF indirildi`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF indirilemedi', 'error');
    }
  };

  const handleRetryPdf = () => {
    if (result) void downloadPdf(result);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-error-bg)' }}
            >
              <TriangleAlert className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
            </div>
            <DialogTitle>Tüm Personel Şifresini Sıfırla</DialogTitle>
          </div>
          <DialogDescription>
            <span className="font-semibold">{hospitalName}</span> hastanesindeki{' '}
            <span className="font-semibold">{staffCount} aktif personelin</span> şifresi yenilenecek.
            Mevcut tüm oturumlar kapatılır; her personel için profesyonel bir PDF üretilir.
            Admin ve süper admin hesapları etkilenmez.
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-xl px-4 py-3 text-[12px] space-y-1"
              style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
              <p><strong>Bu işlem geri alınamaz.</strong></p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Personeller geçici şifrelerini PDF ile elden teslim almalı.</li>
                <li>Açık tüm oturumlar (tarayıcı, mobil) anında düşürülür.</li>
                <li>İlk girişte şifre değiştirme zorunlu olacak.</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">
                Onaylamak için hastane adını yazın:{' '}
                <span className="font-mono" style={{ color: 'var(--color-error)' }}>{hospitalName}</span>
              </Label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={hospitalName}
                className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                style={{
                  background: 'var(--color-bg)',
                  borderColor: confirmText && confirmText !== hospitalName ? 'var(--color-error)' : 'var(--color-border)',
                  color: 'var(--color-text-primary)',
                }}
              />
              {confirmText && confirmText !== hospitalName && (
                <p className="text-[11px]" style={{ color: 'var(--color-error)' }}>Hastane adı eşleşmiyor</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                className="rounded-xl border px-4 py-2 text-[13px] font-semibold"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                İptal
              </button>
              <button
                onClick={handleSubmit}
                disabled={confirmText.trim() !== hospitalName}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-40 inline-flex items-center gap-2"
                style={{ background: 'var(--color-error)' }}
              >
                <KeyRound className="h-4 w-4" />
                {staffCount} personelin şifresini sıfırla
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="h-10 w-10 rounded-full border-2 border-dashed animate-spin"
              style={{ borderColor: 'var(--color-primary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {staffCount} personel için şifreler yenileniyor…
            </p>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              Bu işlem 30 saniyeye kadar sürebilir. Sayfayı kapatmayın.
            </p>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-3">
            <div className="rounded-xl px-4 py-3 text-[13px]"
              style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
              <p className="font-semibold">
                {result.succeeded} / {result.total} personelin şifresi sıfırlandı.
              </p>
              {result.failed > 0 && (
                <p className="text-[11px] mt-1">
                  {result.failed} kullanıcı için hata oluştu — aşağıdaki listeyi kontrol edin.
                </p>
              )}
            </div>

            {result.failed > 0 && result.failedDetails && result.failedDetails.length > 0 && (
              <div className="rounded-xl border px-3 py-2 text-[11px] max-h-40 overflow-auto"
                style={{ borderColor: 'var(--color-border)' }}>
                <p className="font-semibold mb-1" style={{ color: 'var(--color-error)' }}>Başarısız olanlar:</p>
                <ul className="space-y-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {result.failedDetails.map((f, idx) => (
                    <li key={idx}>• {f.name}: {f.reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleRetryPdf}
                className="rounded-xl border px-4 py-2 text-[13px] font-semibold inline-flex items-center gap-2"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
              >
                <FileDown className="h-4 w-4" /> PDF'i tekrar indir
              </button>
              <button
                onClick={handleClose}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
