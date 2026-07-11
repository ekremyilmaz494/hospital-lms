'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Boxes, ArrowLeft, Copy, CheckCircle2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useToast } from '@/components/shared/toast';

interface CreatedResult {
  id: string;
  name: string;
  tempPassword: string;
  ownerEmail: string;
  emailSent: boolean;
}

export default function NewGroupPage() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    maxOrganizations: '',
    ownerFirstName: '',
    ownerLastName: '',
    ownerEmail: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        ownerFirstName: form.ownerFirstName.trim(),
        ownerLastName: form.ownerLastName.trim(),
        ownerEmail: form.ownerEmail.trim(),
      };
      if (form.code.trim()) payload.code = form.code.trim();
      if (form.maxOrganizations.trim()) payload.maxOrganizations = Number(form.maxOrganizations);

      const res = await fetch('/api/super-admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Grup oluşturulamadı');
      setCreated({
        id: body.id,
        name: body.name,
        tempPassword: body.tempPassword,
        ownerEmail: form.ownerEmail.trim(),
        emailSent: body.emailSent,
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const copyPassword = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast('Kopyalanamadı', 'error');
    }
  };

  if (created) {
    return (
      <div className="space-y-6 max-w-2xl">
        <BlurFade delay={0.01}>
          <div className="flex flex-col items-center rounded-2xl border p-8 text-center" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-success)', boxShadow: 'var(--shadow-sm)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-success-bg)' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: 'var(--color-success)' }} />
            </div>
            <h2 className="text-lg font-bold mb-1">Grup oluşturuldu</h2>
            <p className="text-[13px] mb-6" style={{ color: 'var(--color-text-muted)' }}>
              <strong>{created.name}</strong> grubu ve grup yöneticisi hesabı hazır.
            </p>

            <div className="w-full rounded-xl border p-4 text-left" style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
                <span className="text-[13px] font-semibold">Grup Yöneticisi Giriş Bilgileri</span>
              </div>
              <div className="space-y-2 text-[13px]">
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: 'var(--color-text-muted)' }}>E-posta</span>
                  <span className="font-mono">{created.ownerEmail}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span style={{ color: 'var(--color-text-muted)' }}>Geçici Şifre</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono font-bold">{created.tempPassword}</span>
                    <button onClick={copyPassword} className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                      {copied ? <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--color-success)' }} /> : <Copy className="h-4 w-4" />}
                    </button>
                  </span>
                </div>
              </div>
              <p className="text-[11px] mt-3" style={{ color: 'var(--color-text-muted)' }}>
                Yönetici ilk girişte şifresini değiştirecek. {created.emailSent ? 'Hoş geldiniz e-postası gönderildi.' : 'E-posta gönderilemedi — bilgileri elden iletin.'}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <Link href={`/super-admin/groups/${created.id}`}>
                <Button className="gap-2 rounded-xl text-white font-semibold" style={{ background: 'var(--color-primary)' }}>
                  Gruba Hastane Ekle
                </Button>
              </Link>
              <Link href="/super-admin/groups">
                <Button variant="outline" className="rounded-xl">Listeye Dön</Button>
              </Link>
            </div>
          </div>
        </BlurFade>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <BlurFade delay={0.01}>
        <Link href="/super-admin/groups" className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
          <ArrowLeft className="h-4 w-4" /> Gruplar
        </Link>
        <PageHeader title="Yeni Hastane Grubu" subtitle="Grup ve grup yöneticisini (esas yönetici) oluşturun" />
      </BlurFade>

      <BlurFade delay={0.03}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <Boxes className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              <h3 className="text-[14px] font-bold">Grup Bilgileri</h3>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">Grup Adı *</Label>
              <Input required value={form.name} onChange={set('name')} placeholder="Ör: Özel Devakent Sağlık Grubu" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Grup Kodu</Label>
                <Input value={form.code} onChange={set('code')} placeholder="Boş bırak → addan üretilir" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Hastane Limiti</Label>
                <Input type="number" min={1} value={form.maxOrganizations} onChange={set('maxOrganizations')} placeholder="Boş → sınırsız" />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" style={{ color: 'var(--color-warning)' }} />
              <h3 className="text-[14px] font-bold">Grup Yöneticisi (Esas Yönetici)</h3>
            </div>
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              Bu kişi tüm grup hastanelerini konsolide görür ve istediği hastaneye girip yönetebilir. Sistem geçici şifre üretir.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Ad *</Label>
                <Input required value={form.ownerFirstName} onChange={set('ownerFirstName')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">Soyad *</Label>
                <Input required value={form.ownerLastName} onChange={set('ownerLastName')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[13px] font-semibold">E-posta *</Label>
              <Input required type="email" value={form.ownerEmail} onChange={set('ownerEmail')} placeholder="yonetici@grup.com" />
            </div>
          </section>

          <div className="flex items-center justify-end gap-2">
            <Link href="/super-admin/groups">
              <Button type="button" variant="outline" className="rounded-xl">İptal</Button>
            </Link>
            <Button type="submit" disabled={submitting} className="gap-2 rounded-xl text-white font-semibold disabled:opacity-40" style={{ background: 'var(--color-primary)' }}>
              {submitting ? 'Oluşturuluyor...' : 'Grubu Oluştur'}
            </Button>
          </div>
        </form>
      </BlurFade>
    </div>
  );
}
