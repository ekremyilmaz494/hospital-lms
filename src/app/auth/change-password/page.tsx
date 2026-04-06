'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor');
      setSaving(false);
      return;
    }

    if (newPassword.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalıdır');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      setSuccess(true);
      // 2 saniye sonra dashboard'a yönlendir
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div
          className="w-full max-w-md rounded-2xl border p-8 text-center"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        >
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-success-bg)' }}
          >
            <CheckCircle className="h-8 w-8" style={{ color: 'var(--color-success)' }} />
          </div>
          <h2 className="text-xl font-bold mb-2">Şifreniz Güncellendi</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Şifreniz başarıyla değiştirildi. Yönlendiriliyorsunuz...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-md rounded-2xl border p-8"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Header */}
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-primary-light)' }}
          >
            <Lock className="h-7 w-7" style={{ color: 'var(--color-primary)' }} />
          </div>
          <h1 className="text-2xl font-bold">Şifre Değiştir</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Güvenliğiniz için şifrenizi güncellemeniz gerekmektedir
          </p>
        </div>

        {error && (
          <div
            className="mb-4 rounded-lg border p-3"
            style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
          >
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mevcut Şifre */}
          <div>
            <Label style={{ color: 'var(--color-text-secondary)' }}>Mevcut Şifre</Label>
            <div className="relative mt-1.5">
              <Input
                name="currentPassword"
                type={showCurrent ? 'text' : 'password'}
                placeholder="Mevcut şifrenizi girin"
                required
                autoComplete="current-password"
                className="pr-10"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Yeni Şifre */}
          <div>
            <Label style={{ color: 'var(--color-text-secondary)' }}>Yeni Şifre</Label>
            <div className="relative mt-1.5">
              <Input
                name="newPassword"
                type={showNew ? 'text' : 'password'}
                placeholder="En az 8 karakter"
                required
                minLength={8}
                autoComplete="new-password"
                className="pr-10"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Şifre Tekrar */}
          <div>
            <Label style={{ color: 'var(--color-text-secondary)' }}>Yeni Şifre (Tekrar)</Label>
            <div className="relative mt-1.5">
              <Input
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Yeni şifrenizi tekrar girin"
                required
                minLength={8}
                autoComplete="new-password"
                className="pr-10"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={saving}
            className="w-full gap-2 font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            <Lock className="h-4 w-4" />
            {saving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
          </Button>
        </form>
      </div>
    </div>
  );
}
