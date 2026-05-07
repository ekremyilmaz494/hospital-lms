'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, UserPlus, Mail, KeyRound, Copy, CheckCheck, FileDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import { Field } from './field';
import { isValidTcKimlik, normalizeTcKimlik } from '@/lib/tc';
import type { Department } from '../_types';

type Mode = 'invite' | 'direct';

interface SuccessState {
  mode: Mode;
  email: string;
  emailSent: boolean;
  inviteUrl?: string;
  tempPassword?: string;
  // TC ile direkt mod sonucunda PDF üretebilmek için saklanır.
  // Sadece bu admin'in oturumu içinde, modal açık kaldığı sürece tutulur.
  tcKimlik?: string;
  fullName?: string;
  department?: string;
  title?: string;
}

export function NewStaffModal({ onClose, departments, onSaved }: { onClose: () => void; departments: Department[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [mode, setMode] = useState<Mode>('invite');
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', sifre: '', telefon: '', departman: '', unvan: '', tc: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<'link' | 'pwd' | 'tc' | null>(null);
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
    if (mode === 'direct' && form.sifre.trim() && form.sifre.length < 8) e.sifre = 'Şifre en az 8 karakter olmalıdır';
    if (form.telefon && !/^0\d{10}$/.test(form.telefon.replace(/\s/g, ''))) e.telefon = 'Geçerli telefon formatı: 05XX XXX XX XX';
    if (!form.departman) e.departman = 'Departman seçiniz';

    // TC: direkt modda zorunlu (resmi denetim eşleşmesi için), invite modda opsiyonel.
    // Boş bırakılırsa atlanır; girildiyse 11 hane + checksum doğrulanır.
    const tcNorm = normalizeTcKimlik(form.tc);
    if (mode === 'direct' && !tcNorm) {
      e.tc = 'TC Kimlik No zorunludur (resmi sertifika eşleşmesi için)';
    } else if (tcNorm && !isValidTcKimlik(tcNorm)) {
      e.tc = 'Geçersiz TC Kimlik No (kontrol haneleri uyuşmuyor)';
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
        departmentId: form.departman || undefined,
        title: form.unvan || undefined,
        // TC sadece doluysa gönderilir; server checksum'ı zod refine ile yeniden doğrular.
        ...(tcNorm ? { tcKimlik: tcNorm } : {}),
      };
      if (mode === 'direct' && form.sifre.trim()) payload.password = form.sifre.trim();

      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({})) as {
        error?: string;
        emailSent?: boolean;
        inviteUrl?: string;
        tempPassword?: string;
        tcKimlik?: string;
      };
      if (!res.ok) throw new Error(body.error || 'Kayıt başarısız');

      const deptName = departments.find(d => d.id === form.departman)?.name;

      setSuccess({
        mode,
        email: form.email,
        emailSent: body.emailSent !== false,
        inviteUrl: body.inviteUrl,
        tempPassword: body.tempPassword,
        tcKimlik: body.tcKimlik ?? (tcNorm || undefined),
        fullName: `${form.ad} ${form.soyad}`.trim(),
        department: deptName,
        title: form.unvan || undefined,
      });

      // TC ile direkt kayıtta admin'in PDF'i indirebilmesi için modal açık kalır
      // (otomatik kapanma sadece davet+mail başarılı durumunda).
      const hasTcPdf = mode === 'direct' && !!tcNorm && !!body.tempPassword;
      if (body.emailSent !== false && !hasTcPdf) {
        closeTimerRef.current = setTimeout(() => { onSaved(); onClose(); }, 2000);
      } else {
        onSaved();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Bir hata oluştu', 'error');
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = async (text: string, kind: 'link' | 'pwd' | 'tc') => {
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
   * Server'dan kimlik bilgileri PDF'i indirir — TC + geçici şifre + KVKK uyarı kutusu.
   * KVKK gereği PDF gizli bilgi içerir; admin yazıcıdan basıp personele elden teslim
   * etmeli, sonra kâğıdı imha etmelidir (PDF'in altındaki uyarı kutusu hatırlatır).
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
            department: success.department ?? null,
            title: success.title ?? null,
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
      a.download = `personel-giris-${success.fullName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast('PDF indirildi — yazıcıdan basıp personele elden teslim edin', 'success');
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
      eyebrow="Personel Kaydı"
      title="Yeni personel ekle"
      subtitle={mode === 'invite'
        ? 'Davet linki gönderilir; personel kendi şifresini kuracak.'
        : 'Şifre belirleyip hesabı doğrudan oluşturur.'}
      size="lg"
      disableEscape={saving}
      footer={
        !success ? (
          <PremiumModalFooter
            summary={<span className="text-sm" style={{ color: 'var(--k-text-muted)' }}>Zorunlu alanlar * ile işaretli</span>}
            actions={
              <>
                <PremiumButton variant="ghost" onClick={onClose} disabled={saving}>İptal</PremiumButton>
                <PremiumButton onClick={handleSave} loading={saving} icon={<Save className="h-4 w-4" />}>
                  {saving ? 'Kaydediliyor' : (mode === 'invite' ? 'Daveti Gönder' : 'Personel Ekle')}
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
              <UserPlus className="h-6 w-6" />
            </div>
            <h4 className="text-lg font-semibold" style={{ color: 'var(--k-text-primary)' }}>
              {success.mode === 'invite' ? 'Davet oluşturuldu' : 'Personel başarıyla eklendi'}
            </h4>
            <p className="text-sm" style={{ color: 'var(--k-text-secondary)' }}>
              {success.emailSent
                ? `Bilgilendirme e-postası ${success.email} adresine gönderildi.`
                : 'E-posta gönderilemedi — aşağıdaki bilgiyi personele manuel iletin.'}
            </p>
          </div>

          {/* Mail gitmediyse fallback panel */}
          {!success.emailSent && success.mode === 'invite' && success.inviteUrl && (
            <div className="rounded-lg p-3 border" style={{ background: 'var(--k-warning-bg, #fef3c7)', borderColor: 'var(--k-warning, #f59e0b)' }}>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold" style={{ color: 'var(--k-warning-text, #92400e)' }}>
                <Mail className="h-3.5 w-3.5" /> Davet Linki (manuel paylaş)
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs px-2 py-1.5 rounded font-mono break-all"
                      style={{ background: '#fff', color: 'var(--k-text-primary)' }}>
                  {success.inviteUrl}
                </code>
                <button type="button"
                        onClick={() => copyToClipboard(success.inviteUrl!, 'link')}
                        className="h-8 px-2 rounded text-xs font-semibold inline-flex items-center gap-1.5"
                        style={{ background: 'var(--k-primary)', color: '#fff' }}>
                  {copied === 'link' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'link' ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
            </div>
          )}

          {!success.emailSent && success.mode === 'direct' && success.tempPassword && (
            <div className="rounded-lg p-3 border" style={{ background: 'var(--k-warning-bg, #fef3c7)', borderColor: 'var(--k-warning, #f59e0b)' }}>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold" style={{ color: 'var(--k-warning-text, #92400e)' }}>
                <KeyRound className="h-3.5 w-3.5" /> Geçici Şifre (manuel paylaş)
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm px-2 py-1.5 rounded font-mono"
                      style={{ background: '#fff', color: 'var(--k-text-primary)' }}>
                  {success.tempPassword}
                </code>
                <button type="button"
                        onClick={() => copyToClipboard(success.tempPassword!, 'pwd')}
                        className="h-8 px-2 rounded text-xs font-semibold inline-flex items-center gap-1.5"
                        style={{ background: 'var(--k-primary)', color: '#fff' }}>
                  {copied === 'pwd' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'pwd' ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
              <p className="text-[11px] mt-2" style={{ color: 'var(--k-warning-text, #92400e)' }}>
                Personel ilk girişte şifresini değiştirmek zorundadır.
              </p>
            </div>
          )}

          {/* TC ile direkt kayıt: PDF indirme paneli — yazıcıdan basıp personele elden teslim için.
              KVKK: PDF altında "imha edin" uyarısı var. Admin oturumu açık olduğu sürece üretilebilir. */}
          {success.mode === 'direct' && success.tcKimlik && success.tempPassword && (
            <div className="rounded-lg p-3 border-2" style={{ background: '#ecfdf5', borderColor: 'var(--k-primary, #0d9668)' }}>
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold" style={{ color: 'var(--k-primary, #0d9668)' }}>
                <FileDown className="h-3.5 w-3.5" /> Resmi Giriş Belgesi
              </div>
              <p className="text-[12px] mb-3" style={{ color: 'var(--k-text-secondary)' }}>
                Personelin TC, geçici şifre ve giriş bilgilerini içeren PDF belgesini yazıcıdan basıp <strong>elden teslim edebilirsiniz</strong>.
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
                KVKK: Bu belge gizli bilgi içerir. Personele elden teslim sonrası kâğıdı güvenli şekilde imha edin.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Mode toggle: davet linki / şifre belirle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <ModeOption
              active={mode === 'invite'}
              onClick={() => setMode('invite')}
              icon={<Mail className="h-4 w-4" />}
              title="Davet linki gönder"
              hint="Önerilen — personel kendi şifresini kurar, e-posta doğrulanır."
              badge="Varsayılan"
            />
            <ModeOption
              active={mode === 'direct'}
              onClick={() => setMode('direct')}
              icon={<KeyRound className="h-4 w-4" />}
              title="Şifre belirle"
              hint="Acil/offline — admin şifre verir, personel ilk girişte değiştirir."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ad *" error={errors.ad}>
              <Input placeholder="Personel adı" className="h-10" value={form.ad} onChange={(e) => setForm(f => ({ ...f, ad: e.target.value }))} style={fieldStyle('ad')} />
            </Field>
            <Field label="Soyad *" error={errors.soyad}>
              <Input placeholder="Personel soyadı" className="h-10" value={form.soyad} onChange={(e) => setForm(f => ({ ...f, soyad: e.target.value }))} style={fieldStyle('soyad')} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="E-posta *" error={errors.email}>
              <Input type="email" placeholder="ornek@hastane.com" className="h-10" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} style={fieldStyle('email')} />
            </Field>
            {mode === 'direct' ? (
              <Field label="Şifre" error={errors.sifre} hint={!errors.sifre ? 'Boş bırakın — sistem üretip personele iletir.' : undefined}>
                <Input type="password" placeholder="Boş bırakın — sistem üretir" className="h-10" value={form.sifre} onChange={(e) => setForm(f => ({ ...f, sifre: e.target.value }))} style={fieldStyle('sifre')} />
              </Field>
            ) : (
              <Field label="Telefon" error={errors.telefon}>
                <Input placeholder="05XX XXX XX XX" className="h-10"
                       value={form.telefon}
                       onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                       style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
              </Field>
            )}
          </div>
          {mode === 'direct' && (
            <Field label="Telefon" error={errors.telefon}>
              <Input placeholder="05XX XXX XX XX" className="h-10"
                     value={form.telefon}
                     onChange={(e) => setForm(f => ({ ...f, telefon: e.target.value.replace(/[^\d\s]/g, '') }))}
                     style={{ ...fieldStyle('telefon'), fontFamily: 'var(--font-mono)' }} />
            </Field>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Departman *" error={errors.departman}>
              <select
                className="h-10 w-full rounded-lg border px-3 text-sm"
                style={fieldStyle('departman')}
                value={form.departman}
                onChange={(e) => setForm(f => ({ ...f, departman: e.target.value }))}
              >
                <option value="">Seçin...</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Unvan">
              <Input placeholder="örn. Hemşire" className="h-10" value={form.unvan} onChange={(e) => setForm(f => ({ ...f, unvan: e.target.value }))} style={fieldStyle('unvan')} />
            </Field>
          </div>

          {/* TC Kimlik No — direct modda zorunlu (resmi denetim için), invite modda opsiyonel.
              KVKK: değer DB'ye AES-256-GCM ile şifreli, lookup için HMAC-SHA256 hash'li yazılır.
              Plaintext sadece form gönderim anında network'te yer alır (HTTPS). */}
          <Field
            label={mode === 'direct' ? 'TC Kimlik No *' : 'TC Kimlik No'}
            error={errors.tc}
            hint={!errors.tc ? (mode === 'direct'
              ? 'Resmi denetim ve sertifika eşleşmesi için zorunlu. AES-256-GCM ile şifreli saklanır.'
              : 'Opsiyonel — personel daveti kabul ettiğinde TC zaten istenebilir.') : undefined}
          >
            <Input
              placeholder="11 haneli TC Kimlik No"
              inputMode="numeric"
              maxLength={11}
              className="h-10"
              value={form.tc}
              onChange={(e) => setForm(f => ({ ...f, tc: e.target.value.replace(/\D/g, '').slice(0, 11) }))}
              style={{ ...fieldStyle('tc'), fontFamily: 'var(--font-mono)' }}
            />
          </Field>
        </div>
      )}
    </PremiumModal>
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
