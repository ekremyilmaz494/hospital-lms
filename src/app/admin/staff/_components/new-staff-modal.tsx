'use client';

import { useState, useEffect, useRef } from 'react';
import { Save, UserPlus, Mail, KeyRound, Copy, CheckCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/shared/toast';
import { PremiumModal, PremiumModalFooter, PremiumButton } from '@/components/shared/premium-modal';
import { Field } from './field';
import type { Department } from '../_types';

type Mode = 'invite' | 'direct';

interface SuccessState {
  mode: Mode;
  email: string;
  emailSent: boolean;
  inviteUrl?: string;
  tempPassword?: string;
}

export function NewStaffModal({ onClose, departments, onSaved }: { onClose: () => void; departments: Department[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [mode, setMode] = useState<Mode>('invite');
  const [form, setForm] = useState({ ad: '', soyad: '', email: '', sifre: '', telefon: '', departman: '', unvan: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<'link' | 'pwd' | null>(null);
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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        mode,
        firstName: form.ad,
        lastName: form.soyad,
        email: form.email,
        phone: form.telefon || undefined,
        departmentId: form.departman || undefined,
        title: form.unvan || undefined,
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
      };
      if (!res.ok) throw new Error(body.error || 'Kayıt başarısız');

      setSuccess({
        mode,
        email: form.email,
        emailSent: body.emailSent !== false,
        inviteUrl: body.inviteUrl,
        tempPassword: body.tempPassword,
      });

      // Mail başarıyla gittiyse otomatik kapat; fallback varsa admin link/şifreyi kopyalasın
      if (body.emailSent !== false) {
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

  const copyToClipboard = async (text: string, kind: 'link' | 'pwd') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
      toast('Panoya kopyalandı', 'success');
    } catch {
      toast('Kopyalama başarısız', 'error');
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
