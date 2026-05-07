'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, UserCog, Mail, KeyRound, Copy, CheckCheck, FileDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  maxAdmins: number;
  currentCount: number;
}

type Mode = 'invite' | 'direct';

interface SuccessState {
  mode: Mode;
  email: string;
  emailSent: boolean;
  tempPassword?: string;
  tcKimlik?: string;
  fullName?: string;
  title?: string;
}

export function InviteAdminModal({ onClose, onSaved, maxAdmins, currentCount }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [mode, setMode] = useState<Mode>('invite');
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', telefon: '', unvan: '', tc: '', sifre: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<'pwd' | 'tc' | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.ad.trim()) e.ad = 'Ad zorunludur';
    if (!form.soyad.trim()) e.soyad = 'Soyad zorunludur';
    if (!form.email.trim()) e.email = 'E-posta zorunludur';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Geçerli bir e-posta girin';
    if (form.telefon && !/^0\d{10}$/.test(form.telefon.replace(/\s/g, ''))) e.telefon = 'Geçerli telefon formatı: 05XX XXX XX XX';

    const tcNorm = normalizeTcKimlik(form.tc);
    if (!tcNorm) e.tc = 'TC Kimlik No zorunludur';
    else if (!isValidTcKimlik(tcNorm)) e.tc = 'Geçersiz TC Kimlik No (kontrol haneleri uyuşmuyor)';

    if (mode === 'direct' && form.sifre.trim() && form.sifre.length < 8) {
      e.sifre = 'Şifre en az 8 karakter olmalıdır';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const tcNorm = normalizeTcKimlik(form.tc);
      const payload: Record<string, unknown> = {
        mode,
        firstName: form.ad,
        lastName: form.soyad,
        email: form.email,
        phone: form.telefon || undefined,
        title: form.unvan || undefined,
        tcKimlik: tcNorm,
      };
      if (mode === 'direct' && form.sifre.trim()) payload.password = form.sifre.trim();

      const res = await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({})) as {
        error?: string;
        emailSent?: boolean;
        tempPassword?: string;
        tcKimlik?: string;
      };
      if (!res.ok) throw new Error(body.error || 'Kayıt başarısız');

      setSuccess({
        mode,
        email: form.email,
        emailSent: body.emailSent !== false,
        tempPassword: body.tempPassword,
        tcKimlik: body.tcKimlik ?? tcNorm,
        fullName: `${form.ad} ${form.soyad}`.trim(),
        title: form.unvan || undefined,
      });

      // Direct mode'da PDF üretmeden kapatma — admin elden teslim için belge bassın
      const hasPdf = mode === 'direct' && !!body.tempPassword;
      if (mode === 'invite' && body.emailSent !== false) {
        closeTimerRef.current = setTimeout(() => { onSaved(); onClose(); }, 1800);
      } else if (!hasPdf) {
        onSaved();
      } else {
        onSaved();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, kind: 'pwd' | 'tc') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
      toast('Panoya kopyalandı', 'success');
    } catch {
      toast('Kopyalama başarısız', 'error');
    }
  };

  /**
   * Server'dan kimlik bilgileri PDF'i indirir — TC + geçici şifre + KVKK uyarısı.
   * KVKK: PDF gizli bilgi içerir, yazıcıdan basıp elden teslim edilmeli, kâğıt imha edilmeli.
   */
  const downloadCredentialsPdf = async () => {
    if (!success?.tcKimlik || !success?.tempPassword || !success?.fullName) {
      toast('PDF için gerekli bilgi eksik', 'error');
      return;
    }
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/admin/staff/credentials-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            fullName: success.fullName,
            tcKimlik: success.tcKimlik,
            email: success.email,
            tempPassword: success.tempPassword,
            department: null,
            title: success.title ?? 'Yönetici',
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
      a.download = `yonetici-giris-${success.fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('PDF indirildi — yazıcıdan basıp yöneticiye elden teslim edin', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF üretilemedi', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const fieldStyle = (field: string) => ({
    background: 'var(--k-surface)',
    borderColor: errors[field] ? 'var(--k-error)' : 'var(--k-border)',
  });

  return (
    <PremiumModal
      isOpen
      onClose={() => { if (!saving) onClose(); }}
      eyebrow="Yönetici Daveti"
      title="Yeni yönetici davet et"
      subtitle={mode === 'invite'
        ? `Davet bağlantısı maille gönderilir, 72 saat geçerlidir. (${currentCount + 1} / ${maxAdmins})`
        : `Otomatik şifre üretilir, manuel teslim için PDF basılır. (${currentCount + 1} / ${maxAdmins})`}
      size="md"
      disableEscape={saving}
      footer={
        !success ? (
          <PremiumModalFooter
            summary={<span className="text-sm" style={{ color: 'var(--k-text-muted)' }}>Zorunlu alanlar * ile işaretli</span>}
            actions={
              <>
                <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
                <PremiumButton onClick={handleSave} loading={saving} icon={<Save className="h-4 w-4" />}>
                  {saving ? 'Kaydediliyor' : (mode === 'invite' ? 'Daveti Gönder' : 'Yönetici Ekle')}
                </PremiumButton>
              </>
            }
          />
        ) : (
          <PremiumModalFooter
            actions={<PremiumButton onClick={onClose}>Kapat</PremiumButton>}
          />
        )
      }
    >
      {success ? (
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col items-center text-center gap-3 pt-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center"
                 style={{ background: 'var(--k-primary)', color: '#fff' }}>
              <UserCog className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-semibold" style={{ color: 'var(--k-text-primary)' }}>
              {success.mode === 'invite' ? 'Davet linki gönderildi' : 'Yönetici hesabı oluşturuldu'}
            </h4>
            <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              {success.mode === 'invite'
                ? <><strong>{success.email}</strong> adresine davet bağlantısı iletildi.</>
                : success.emailSent
                  ? `Hoş geldiniz e-postası ${success.email} adresine gönderildi.`
                  : 'E-posta gönderilemedi — aşağıdaki bilgileri yazıcıdan basıp elden teslim edin.'}
            </p>
          </div>

          {/* Direct mode: TC + şifre + PDF download paneli */}
          {success.mode === 'direct' && success.tcKimlik && success.tempPassword && (
            <div className="rounded-lg p-3 border-2" style={{ background: '#ecfdf5', borderColor: 'var(--k-primary, #0d9668)' }}>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold" style={{ color: 'var(--k-primary, #0d9668)' }}>
                <FileDown className="h-3.5 w-3.5" /> Resmi Giriş Belgesi
              </div>
              <p className="text-[12px] mb-3" style={{ color: 'var(--k-text-secondary)' }}>
                Yöneticinin TC, geçici şifre ve giriş bilgilerini içeren PDF belgesini yazıcıdan basıp <strong>elden teslim ediniz</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadCredentialsPdf}
                  disabled={downloadingPdf}
                  className="h-9 px-3 rounded text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-60"
                  style={{ background: 'var(--k-primary, #0d9668)', color: '#fff' }}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {downloadingPdf ? 'PDF üretiliyor…' : 'PDF Olarak İndir'}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(success.tcKimlik!, 'tc')}
                  className="h-9 px-3 rounded text-xs font-semibold inline-flex items-center gap-1.5 border"
                  style={{ background: '#fff', color: 'var(--k-text-primary)', borderColor: 'var(--k-border)' }}
                >
                  {copied === 'tc' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  TC: {success.tcKimlik}
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(success.tempPassword!, 'pwd')}
                  className="h-9 px-3 rounded text-xs font-semibold inline-flex items-center gap-1.5 border"
                  style={{ background: '#fff', color: 'var(--k-text-primary)', borderColor: 'var(--k-border)' }}
                >
                  {copied === 'pwd' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  Şifre: {success.tempPassword}
                </button>
              </div>
              <p className="text-[11px] mt-2 italic" style={{ color: 'var(--k-text-muted)' }}>
                KVKK: Bu belge gizli bilgi içerir. Yöneticiye elden teslim sonrası kâğıdı güvenli şekilde imha edin. Yönetici ilk girişte şifresini değiştirmek zorundadır.
              </p>
            </div>
          )}

          {success.mode === 'invite' && (
            <p className="text-xs text-center" style={{ color: 'var(--k-text-muted)' }}>
              Bağlantı 72 saat içinde kullanılmalıdır. Davet edilen kişi linke tıklayıp kendi şifresini belirleyecek.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Mode toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ModeOption
              active={mode === 'invite'}
              onClick={() => setMode('invite')}
              icon={<Mail className="h-4 w-4" />}
              title="Davet linki gönder"
              hint="E-posta ile bağlantı; yönetici kendi şifresini kurar."
              badge="Varsayılan"
            />
            <ModeOption
              active={mode === 'direct'}
              onClick={() => setMode('direct')}
              icon={<KeyRound className="h-4 w-4" />}
              title="Şifre belirle"
              hint="Sistem üretir, siz elden teslim edersiniz (PDF basılabilir)."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Ad *" error={errors.ad}>
              <Input placeholder="Yönetici adı" className="h-10" value={form.ad}
                     onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))}
                     style={fieldStyle('ad')} />
            </FieldRow>
            <FieldRow label="Soyad *" error={errors.soyad}>
              <Input placeholder="Yönetici soyadı" className="h-10" value={form.soyad}
                     onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))}
                     style={fieldStyle('soyad')} />
            </FieldRow>
          </div>
          <FieldRow label="E-posta *" error={errors.email}>
            <Input type="email" placeholder="ornek@hastane.com" className="h-10" value={form.email}
                   onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                   style={fieldStyle('email')} />
          </FieldRow>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldRow label="Telefon" error={errors.telefon}>
              <Input placeholder="05XX XXX XX XX" className="h-10" value={form.telefon}
                     onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                     style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
            </FieldRow>
            <FieldRow label="Unvan">
              <Input placeholder="örn. Eğitim Müdürü" className="h-10" value={form.unvan}
                     onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))}
                     style={fieldStyle('unvan')} />
            </FieldRow>
          </div>

          <FieldRow label="TC Kimlik No *" error={errors.tc}>
            <Input
              placeholder="11 haneli TC Kimlik No"
              inputMode="numeric"
              maxLength={11}
              className="h-10"
              value={form.tc}
              onChange={(e) => setForm(f => ({ ...f, tc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              style={{ ...fieldStyle('tc'), fontFamily: 'var(--font-mono)' }}
            />
            <span className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
              Resmi denetim eşleşmesi için zorunlu. AES-256-GCM ile şifreli saklanır.
            </span>
          </FieldRow>

          {/* Direct mode: opsiyonel şifre alanı */}
          {mode === 'direct' && (
            <FieldRow label="Şifre" error={errors.sifre}>
              <Input
                type="text"
                placeholder="Boş bırakın — sistem üretir"
                className="h-10"
                value={form.sifre}
                onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))}
                style={{ ...fieldStyle('sifre'), fontFamily: 'var(--font-mono)' }}
              />
              <span className="text-[11px]" style={{ color: 'var(--k-text-muted)' }}>
                Boş bırakırsanız güvenli bir şifre otomatik üretilir. Yönetici ilk girişte şifresini değiştirmek zorundadır.
              </span>
            </FieldRow>
          )}
        </div>
      )}
    </PremiumModal>
  );
}

function FieldRow({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold" style={{ color: 'var(--k-text-secondary)' }}>{label}</span>
      {children}
      {error && <span className="text-xs" style={{ color: 'var(--k-error)' }}>{error}</span>}
    </label>
  );
}

function ModeOption({ active, onClick, icon, title, hint, badge }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  hint: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left p-3 rounded-lg border transition-colors"
      style={{
        background: active ? 'var(--k-primary-light, #d1fae5)' : 'var(--k-surface)',
        borderColor: active ? 'var(--k-primary)' : 'var(--k-border)',
        borderWidth: active ? 2 : 1,
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color: active ? 'var(--k-primary)' : 'var(--k-text-secondary)' }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--k-text-primary)' }}>{title}</span>
        {badge && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider"
                style={{ background: 'var(--k-primary)', color: '#fff' }}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--k-text-muted)' }}>{hint}</p>
    </button>
  );
}
