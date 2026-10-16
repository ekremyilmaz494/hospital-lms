'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, CreditCard, ArrowLeft, Save, Mail, KeyRound, FileDown, Copy, CheckCheck, UserCog } from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';

interface Plan { id: string; name: string; slug: string; priceMonthly: number | null }
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/shared/page-header';
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc';

type Mode = 'invite' | 'direct';

interface SuccessState {
  mode: Mode;
  organizationId: string;
  organizationName: string;
  ownerEmail: string;
  ownerFullName: string;
  ownerTc?: string;
  tempPassword?: string;
  inviteUrl?: string;
  emailSent: boolean;
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('invite');
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [copied, setCopied] = useState<'tc' | 'pwd' | 'link' | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { data: plansData } = useFetch<{ plans: Plan[] }>('/api/super-admin/subscriptions');
  const plans = plansData?.plans ?? [];

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    const formData = new FormData(e.currentTarget);
    const planId = formData.get('planId') as string | null;
    const tcRaw = String(formData.get('adminTcKimlik') ?? '').replace(/\D/g, '');

    // Client-side TC ön kontrolü — server zaten zod refine ile yeniden doğrular
    if (!isValidTcKimlik(tcRaw)) {
      setSaveError('Esas Yönetici TC Kimlik No geçersiz (kontrol haneleri uyuşmuyor).');
      setSaving(false);
      return;
    }

    const adminPassword = String(formData.get('adminPassword') ?? '').trim();
    const adminEmailRaw = String(formData.get('adminEmail') ?? '').trim();

    // Invite modda e-posta zorunlu — server zaten reddeder ama erken gösterelim
    if (mode === 'invite' && !adminEmailRaw) {
      setSaveError('Davet linki modu için e-posta zorunludur.');
      setSaving(false);
      return;
    }

    const body: Record<string, unknown> = {
      mode,
      name: formData.get('name'),
      code: formData.get('code'),
      address: formData.get('address'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      adminFirstName: formData.get('adminFirstName'),
      adminLastName: formData.get('adminLastName'),
      ...(adminEmailRaw && { adminEmail: adminEmailRaw }),
      adminTcKimlik: normalizeTcKimlik(tcRaw),
      ...(planId && { planId }),
      trialDays: Number(formData.get('trialDays') ?? 14),
    };
    const logoRaw = String(formData.get('logoUrl') ?? '').trim();
    if (logoRaw) body.logoUrl = logoRaw;
    if (mode === 'direct' && adminPassword) body.adminPassword = adminPassword;

    try {
      const res = await fetch('/api/super-admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const created = await res.json();
      setSuccess({
        mode: created.mode ?? mode,
        organizationId: created.id,
        organizationName: String(body.name ?? ''),
        ownerEmail: String(body.adminEmail ?? ''),
        ownerFullName: `${body.adminFirstName} ${body.adminLastName}`.trim(),
        ownerTc: created.adminTcKimlik ?? normalizeTcKimlik(tcRaw),
        tempPassword: created.tempPassword,
        inviteUrl: created.inviteUrl,
        emailSent: created.emailSent !== false,
      });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Bir hata oluştu');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, kind: 'tc' | 'pwd' | 'link') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const downloadCredentialsPdf = async () => {
    if (!success?.ownerTc || !success?.tempPassword || !success?.ownerFullName) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/admin/staff/credentials-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Super admin → kendi orgId yok, hangi hastane için ürettiği body'de zorunlu
          organizationId: success.organizationId,
          items: [{
            fullName: success.ownerFullName,
            tcKimlik: success.ownerTc,
            email: success.ownerEmail,
            tempPassword: success.tempPassword,
            department: null,
            title: 'Esas Yönetici',
          }],
          maskMode: 'full',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || 'PDF üretilemedi');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `esas-yonetici-giris-${success.ownerFullName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'PDF üretilemedi');
    } finally {
      setDownloadingPdf(false);
    }
  };

  // ── Sonuç Paneli ──
  if (success) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/super-admin/organizations')}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader title="Organizasyon Oluşturuldu" subtitle={success.organizationName} />
        </div>

        <div className="rounded-xl border p-6 max-w-3xl"
             style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full"
                 style={{ background: 'var(--color-primary)', color: '#fff' }}>
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">
                {success.mode === 'invite' ? 'Davet linki gönderildi' : 'Esas Yönetici hesabı oluşturuldu'}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {success.mode === 'invite'
                  ? success.emailSent
                    ? `${success.ownerEmail} adresine davet bağlantısı iletildi (72 saat geçerli).`
                    : 'E-posta gönderilemedi — aşağıdaki davet bağlantısını manuel iletin.'
                  : success.emailSent
                    ? `Hoş geldiniz e-postası ${success.ownerEmail} adresine gönderildi.`
                    : 'E-posta gönderilemedi — aşağıdaki bilgileri yazıcıdan basıp elden teslim edin.'}
              </p>
            </div>
          </div>

          {/* Direct mode: PDF + TC + şifre paneli */}
          {success.mode === 'direct' && success.ownerTc && success.tempPassword && (
            <div className="rounded-lg p-4 border-2 mb-4"
                 style={{ background: '#ecfdf5', borderColor: 'var(--color-primary, #0d9668)' }}>
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold"
                   style={{ color: 'var(--color-primary, #0d9668)' }}>
                <FileDown className="h-4 w-4" /> Resmi Giriş Belgesi
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                Esas Yönetici&apos;nin TC ve geçici şifresini içeren PDF belgesini yazıcıdan basıp <strong>elden teslim ediniz</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={downloadCredentialsPdf}
                  disabled={downloadingPdf}
                  className="gap-2 text-white"
                  style={{ background: 'var(--color-primary, #0d9668)' }}
                >
                  <FileDown className="h-4 w-4" />
                  {downloadingPdf ? 'PDF üretiliyor…' : 'PDF Olarak İndir'}
                </Button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(success.ownerTc!, 'tc')}
                  className="h-9 px-3 rounded text-xs font-semibold inline-flex items-center gap-1.5 border"
                  style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}
                >
                  {copied === 'tc' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  TC: {success.ownerTc}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(success.tempPassword!, 'pwd')}
                  className="h-9 px-3 rounded text-xs font-semibold inline-flex items-center gap-1.5 border"
                  style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}
                >
                  {copied === 'pwd' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Şifre: {success.tempPassword}
                </button>
              </div>
              <p className="text-xs mt-3 italic" style={{ color: 'var(--color-text-muted)' }}>
                KVKK: Bu belge gizli bilgi içerir. Esas Yönetici&apos;ye elden teslim sonrası kâğıdı güvenli şekilde imha edin. İlk girişte şifresini değiştirmek zorundadır.
              </p>
            </div>
          )}

          {/* Invite mode: email gitmediyse fallback link paneli */}
          {success.mode === 'invite' && !success.emailSent && success.inviteUrl && (
            <div className="rounded-lg p-4 border mb-4"
                 style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold" style={{ color: '#92400e' }}>
                <Mail className="h-4 w-4" /> Davet Linki (manuel paylaş)
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs px-2 py-1.5 rounded font-mono break-all"
                      style={{ background: '#fff', color: 'var(--color-text-primary)' }}>
                  {success.inviteUrl}
                </code>
                <button type="button"
                        onClick={() => copyToClipboard(success.inviteUrl!, 'link')}
                        className="h-8 px-2 rounded text-xs font-semibold inline-flex items-center gap-1.5"
                        style={{ background: 'var(--color-primary)', color: '#fff' }}>
                  {copied === 'link' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'link' ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/super-admin/organizations/${success.organizationId}`)}
            >
              Organizasyon Detayına Git
            </Button>
            <Button
              variant="ghost"
              onClick={() => router.push('/super-admin/organizations')}
            >
              Organizasyon Listesine Dön
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader title="Yeni Organizasyon Ekle" subtitle="Organizasyon bilgilerini girin ve admin hesabı oluşturun" />
      </div>

      {saveError && (
        <div className="rounded-lg border p-3" style={{ background: 'var(--color-error-bg)', borderColor: 'var(--color-error)', color: 'var(--color-error)' }}>
          <p className="text-sm">{saveError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Organization Info */}
          <div
            className="rounded-xl border p-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <Building2 className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="text-lg font-bold">
                Organizasyon Bilgileri
              </h3>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Organizasyon Adı *</Label>
                  <Input name="name" placeholder="Ornek Hastanesi" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Organizasyon Kodu *</Label>
                  <Input name="code" placeholder="DEV001" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
                </div>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Adres</Label>
                <Input name="address" placeholder="Organizasyon adresi..." className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Telefon</Label>
                  <Input name="phone" placeholder="+90 (xxx) xxx xx xx" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>E-posta</Label>
                  <Input name="email" placeholder="info@kurum.com" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Kurum Logosu</Label>
                <Input name="logoUrl" placeholder="https://.../logo.png  veya  /logos/dosya.png" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)', opacity: 0.75 }}>
                  Panelde sol üstte ve tüm resmi PDF&apos;lerde (katılım, duyuru, geri bildirim formları…) görünür. Tam URL (S3/CDN) veya paket yolu (/logos/dosya.png). Boş bırakılırsa kurum adı yazısı kullanılır.
                </p>
              </div>
            </div>
          </div>

          {/* Admin Account */}
          <div
            className="rounded-xl border p-6"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-accent-light)' }}>
                <User className="h-5 w-5" style={{ color: 'var(--color-accent)' }} />
              </div>
              <h3 className="text-lg font-bold">
                Esas Yönetici
              </h3>
            </div>

            {/* Mode toggle: davet linki / şifre belirle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setMode('invite')}
                className="text-left p-3 rounded-lg border transition-colors"
                style={{
                  background: mode === 'invite' ? 'var(--color-primary-light, #d1fae5)' : 'var(--color-surface)',
                  borderColor: mode === 'invite' ? 'var(--color-primary)' : 'var(--color-border)',
                  borderWidth: mode === 'invite' ? 2 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="h-4 w-4" style={{ color: mode === 'invite' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
                  <span className="text-sm font-semibold">Davet linki gönder</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider"
                        style={{ background: 'var(--color-primary)', color: '#fff' }}>
                    Varsayılan
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  E-posta ile bağlantı; yönetici kendi şifresini kurar.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setMode('direct')}
                className="text-left p-3 rounded-lg border transition-colors"
                style={{
                  background: mode === 'direct' ? 'var(--color-primary-light, #d1fae5)' : 'var(--color-surface)',
                  borderColor: mode === 'direct' ? 'var(--color-primary)' : 'var(--color-border)',
                  borderWidth: mode === 'direct' ? 2 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <KeyRound className="h-4 w-4" style={{ color: mode === 'direct' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
                  <span className="text-sm font-semibold">Şifre belirle</span>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                  Sistem üretir, siz elden teslim edersiniz (PDF basılabilir).
                </p>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Ad *</Label>
                  <Input name="adminFirstName" placeholder="Ahmet" autoComplete="given-name" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Soyad *</Label>
                  <Input name="adminLastName" placeholder="Yılmaz" autoComplete="family-name" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                </div>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>
                  E-posta{mode === 'invite' ? ' *' : ''}
                </Label>
                <Input name="adminEmail" placeholder="admin@kurum.com" type="email" autoComplete="email" className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }} />
                {mode === 'direct' && (
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Boş bırakılabilir — e-posta olmadan da hesap oluşturulur.
                  </p>
                )}
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>TC Kimlik No *</Label>
                <Input
                  name="adminTcKimlik"
                  placeholder="11 haneli TC Kimlik No"
                  inputMode="numeric"
                  maxLength={11}
                  pattern="\d{11}"
                  className="mt-1.5"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  KVKK gereği AES-256-GCM ile şifreli saklanır. Resmi denetim eşleşmesi için zorunlu.
                </p>
              </div>

              {/* Direct mode: opsiyonel şifre alanı */}
              {mode === 'direct' && (
                <div>
                  <Label style={{ color: 'var(--color-text-secondary)' }}>Şifre</Label>
                  <Input
                    name="adminPassword"
                    type="text"
                    placeholder="Boş bırakın — sistem üretir"
                    className="mt-1.5"
                    style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }}
                  />
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Boş bırakırsanız güvenli bir şifre otomatik üretilir. Esas Yönetici ilk girişte şifresini değiştirmek zorundadır.
                  </p>
                </div>
              )}

              <div className="rounded-lg border p-3" style={{ background: 'var(--color-info-bg, #eff6ff)', borderColor: 'var(--color-info, #3b82f6)' }}>
                <p className="text-xs" style={{ color: 'var(--color-info, #1e40af)' }}>
                  <strong>Bilgi:</strong> {mode === 'invite'
                    ? 'Davet bağlantısı bu e-posta adresine gönderilir. Esas Yönetici, bağlantıya tıklayıp kendi şifresini belirleyerek hesabını aktive eder. Bağlantı 72 saat geçerlidir.'
                    : 'Hesap anında oluşturulur, sistem geçici şifre üretir. Bilgileri yazıcıdan basıp Esas Yönetici\'ye elden teslim edersiniz. İlk girişte şifresini değiştirmek zorundadır.'}
                </p>
              </div>
            </div>

            <Separator className="my-5" style={{ background: 'var(--color-border)' }} />

            {/* Subscription */}
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--color-info-bg)' }}>
                <CreditCard className="h-5 w-5" style={{ color: 'var(--color-info)' }} />
              </div>
              <h3 className="text-lg font-bold">
                Abonelik
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Abonelik Planı *</Label>
                <select
                  name="planId"
                  className="mt-1.5 w-full rounded-md border px-3 py-2.5 text-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                >
                  <option value="">Plan seçin (isteğe bağlı)...</option>
                  {plans.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}{p.priceMonthly ? ` — ₺${p.priceMonthly}/ay` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label style={{ color: 'var(--color-text-secondary)' }}>Deneme Süresi (Gün)</Label>
                <Input name="trialDays" type="number" defaultValue={14} className="mt-1.5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
          >
            İptal
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="gap-2 font-semibold text-white"
            style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast), transform var(--transition-fast)' }}
          >
            <Save className="h-4 w-4" />
            {saving ? 'Oluşturuluyor...' : (mode === 'invite' ? 'Organizasyon Oluştur (Davet)' : 'Organizasyon Oluştur (Şifreyle)')}
          </Button>
        </div>
      </form>
    </div>
  );
}
