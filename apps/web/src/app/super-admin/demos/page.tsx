'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FlaskConical,
  Plus,
  MoreHorizontal,
  Ban,
  CheckCircle,
  Users,
  GraduationCap,
  Search,
  TriangleAlert,
  Shield,
  Trash2,
  Copy,
  CheckCheck,
  FileDown,
  KeyRound,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface DemoRaw {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
  users: { email: string; firstName: string; lastName: string }[];
  subscription?: {
    status: string;
    plan: { name: string; slug: string };
  };
  _count: { users: number; trainings: number };
}

interface DemosResponse {
  demos: DemoRaw[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface DemoCredentials {
  orgId: string;
  orgName: string;
  adminEmail: string;
  adminTc: string;
  tempPassword: string;
  staffEmail?: string;
  staffTc?: string;
}

type StatusFilter = 'all' | 'active' | 'suspended';
type SuspendTarget = { demo: DemoRaw; mode: 'suspend' | 'activate' };

export default function DemosPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [suspendTarget, setSuspendTarget] = useState<SuspendTarget | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DemoRaw | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [credentials, setCredentials] = useState<DemoCredentials | null>(null);
  const [accessInfoTarget, setAccessInfoTarget] = useState<DemoRaw | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creatingMode, setCreatingMode] = useState<'filled' | 'empty' | null>(null);
  const [copied, setCopied] = useState<'tc' | 'pwd' | 'email' | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data, isLoading, error, refetch } = useFetch<DemosResponse>('/api/super-admin/demos?limit=500');
  const demos = data?.demos ?? [];

  const filtered = demos.filter((demo) => {
    const matchesSearch = !search ||
      demo.name.toLowerCase().includes(search.toLowerCase()) ||
      demo.code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && demo.isActive && !demo.isSuspended) ||
      (statusFilter === 'suspended' && demo.isSuspended);
    return matchesSearch && matchesStatus;
  });

  const activeCount = demos.filter((d) => d.isActive && !d.isSuspended).length;
  const suspendedCount = demos.filter((d) => d.isSuspended).length;
  const totalStaff = demos.reduce((sum, d) => sum + d._count.users, 0);

  const createDemo = async (filled: boolean) => {
    setCreatingMode(filled ? 'filled' : 'empty');
    try {
      const res = await fetch('/api/super-admin/demos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filled }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Demo oluşturulamadı');
      }
      const result = await res.json() as DemoCredentials;
      setCredentials(result);
      toast(filled ? 'Dolu demo oluşturuldu' : 'Boş demo oluşturuldu', 'success');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Demo oluşturulamadı', 'error');
    } finally {
      setCreatingMode(null);
    }
  };

  const openSuspendModal = (demo: DemoRaw) => {
    setSuspendTarget({ demo, mode: demo.isSuspended ? 'activate' : 'suspend' });
    setSuspendReason('');
    setConfirmText('');
  };

  const closeSuspendModal = () => {
    setSuspendTarget(null);
    setSuspendReason('');
    setConfirmText('');
  };

  const handleSuspendConfirm = async () => {
    if (!suspendTarget) return;
    const { demo, mode } = suspendTarget;
    if (mode === 'suspend' && confirmText.trim() !== demo.name.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/organizations/${demo.id}/suspend`, {
        method: mode === 'suspend' ? 'POST' : 'DELETE',
        headers: mode === 'suspend' ? { 'Content-Type': 'application/json' } : undefined,
        body: mode === 'suspend' ? JSON.stringify({ reason: suspendReason.trim() || null }) : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'İşlem başarısız');
      }
      toast(mode === 'suspend' ? 'Demo erişimi kesildi' : 'Demo erişimi açıldı', 'success');
      closeSuspendModal();
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata oluştu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteConfirmText.trim() !== deleteTarget.name.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/demos/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Demo silinemedi');
      }
      toast('Demo kalıcı olarak silindi', 'success');
      setDeleteTarget(null);
      setDeleteConfirmText('');
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Demo silinemedi', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = async (text: string, kind: 'tc' | 'pwd' | 'email') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  const downloadCredentialsPdf = async () => {
    if (!credentials) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch('/api/admin/staff/credentials-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: credentials.orgId,
          items: [
            {
              fullName: 'Demo Yönetici',
              tcKimlik: credentials.adminTc,
              email: credentials.adminEmail,
              tempPassword: credentials.tempPassword,
              department: null,
              title: 'Esas Yönetici',
            },
            ...(credentials.staffEmail && credentials.staffTc ? [{
              fullName: 'Demo Personel',
              tcKimlik: credentials.staffTc,
              email: credentials.staffEmail,
              tempPassword: credentials.tempPassword,
              department: 'Örnek Birim',
              title: 'Örnek Personel',
            }] : [])
          ],
          maskMode: 'full',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'PDF üretilemedi');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `demo-giris-${credentials.orgName.replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'PDF üretilemedi', 'error');
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) return <div className="flex h-64 items-center justify-center"><div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div></div>;

  const statusFilters: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Tümü', count: demos.length },
    { key: 'active', label: 'Aktif', count: activeCount },
    { key: 'suspended', label: 'Erişimi Kesik', count: suspendedCount },
  ];

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <div className="flex items-start justify-between gap-4">
          <PageHeader title="Demo Yönetimi" subtitle="Otomatik demo ortamları oluştur ve yönet" />
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={creatingMode !== null}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: 'var(--color-primary)' }}
            >
              <Plus className="h-4 w-4" />
              {creatingMode ? 'Oluşturuluyor...' : 'Demo Oluştur'}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => createDemo(true)}>
                <GraduationCap className="h-4 w-4" /> Dolu Demo
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => createDemo(false)}>
                <FlaskConical className="h-4 w-4" /> Boş Demo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </BlurFade>

      <BlurFade delay={0.03}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: 'Toplam Demo', value: demos.length, icon: FlaskConical, color: 'var(--color-primary)' },
            { label: 'Aktif', value: activeCount, icon: CheckCircle, color: 'var(--color-success)' },
            { label: 'Erişimi Kesik', value: suspendedCount, icon: Ban, color: 'var(--color-warning)' },
            { label: 'Demo Kullanıcı', value: totalStaff, icon: Users, color: 'var(--color-info)' },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-2xl border p-4"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${s.color}12` }}>
                <s.icon className="h-5 w-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                <p className="font-mono text-xl font-bold">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1 rounded-xl border p-1" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            {statusFilters.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors duration-150"
                style={{
                  background: statusFilter === f.key ? 'var(--color-primary)' : 'transparent',
                  color: statusFilter === f.key ? 'white' : 'var(--color-text-secondary)',
                }}
              >
                {f.label}
                <span
                  className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                  style={{
                    background: statusFilter === f.key ? 'rgba(255,255,255,0.2)' : 'var(--color-bg)',
                    color: statusFilter === f.key ? 'white' : 'var(--color-text-muted)',
                  }}
                >
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
            <Input
              placeholder="Demo ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}
            />
          </div>
        </div>
      </BlurFade>

      <BlurFade delay={0.07}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border py-16" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-bg)' }}>
              <FlaskConical className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="mb-1 text-[15px] font-bold">Demo bulunamadı</p>
            <p className="mb-4 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
              {search ? 'Arama kriterlerinizi değiştirmeyi deneyin' : 'Henüz demo oluşturulmamış'}
            </p>
            {!search && (
              <Button onClick={() => createDemo(true)} className="gap-2 rounded-xl font-semibold text-white" style={{ background: 'var(--color-primary)' }}>
                <Plus className="h-4 w-4" /> İlk Demoyu Oluştur
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((demo) => {
              const createdDate = new Date(demo.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const status = demo.isSuspended
                ? { label: 'Erişimi Kesik', color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' }
                : { label: 'Aktif', color: 'var(--color-success)', bg: 'var(--color-success-bg)' };
              const admin = demo.users[0];

              return (
                <div
                  key={demo.id}
                  className="group relative overflow-hidden rounded-2xl border transition-transform duration-200 hover:-translate-y-0.5"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: demo.isSuspended ? 'var(--color-warning)' : 'var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                    opacity: demo.isSuspended ? 0.85 : 1,
                  }}
                >
                  <div className="absolute bottom-0 left-0 top-0 w-1.5 rounded-l-2xl" style={{ background: 'linear-gradient(180deg, var(--color-primary), var(--color-info))' }} />
                  <div className="flex items-center gap-5 p-5 pl-7">
                    <Avatar className="h-12 w-12 shrink-0 transition-transform duration-200 group-hover:scale-105">
                      <AvatarFallback className="text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-info))' }}>
                        {demo.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="truncate text-[15px] font-bold">{demo.name}</h3>
                        <span className="rounded px-1.5 py-0.5 font-mono text-[11px]" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                          {demo.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {demo._count.users} kullanıcı</span>
                        <span className="flex items-center gap-1"><GraduationCap className="h-3.5 w-3.5" /> {demo._count.trainings} eğitim</span>
                        <span className="font-mono">{createdDate}</span>
                        {admin && <span className="truncate">{admin.email}</span>}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-info-bg)', color: 'var(--color-info)' }}>
                        {demo._count.trainings > 0 ? 'Dolu' : 'Boş'}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: status.bg, color: status.color }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.color }} />
                        {status.label}
                      </span>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ color: 'var(--color-text-muted)' }}>
                        <MoreHorizontal className="h-5 w-5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => router.push(`/super-admin/organizations/${demo.id}`)}>
                          <FlaskConical className="h-4 w-4" /> Demo Detayı
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => {
                            if (credentials?.orgId === demo.id) setCredentials(credentials);
                            else setAccessInfoTarget(demo);
                          }}
                        >
                          <KeyRound className="h-4 w-4" /> Giriş Bilgileri
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          style={{ color: demo.isSuspended ? 'var(--color-success)' : 'var(--color-error)' }}
                          onClick={() => openSuspendModal(demo)}
                        >
                          {demo.isSuspended ? <><CheckCircle className="h-4 w-4" /> Erişimi Aç</> : <><Ban className="h-4 w-4" /> Erişimi Kes</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="gap-2 cursor-pointer"
                          style={{ color: 'var(--color-error)' }}
                          onClick={() => {
                            setDeleteTarget(demo);
                            setDeleteConfirmText('');
                          }}
                        >
                          <Trash2 className="h-4 w-4" /> Kalıcı Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </BlurFade>

      {filtered.length > 0 && (
        <div className="text-center">
          <p className="font-mono text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} / {demos.length} demo gösteriliyor
          </p>
        </div>
      )}

      <Dialog open={credentials !== null} onOpenChange={(open) => { if (!open) setCredentials(null); }}>
        <DialogContent showCloseButton>
          {credentials && (
            <>
              <DialogHeader>
                <div className="mb-1 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-success-bg)' }}>
                    <KeyRound className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                  </div>
                  <DialogTitle>Demo Giriş Bilgileri</DialogTitle>
                </div>
                <DialogDescription>{credentials.orgName}</DialogDescription>
              </DialogHeader>

              <div className="rounded-lg border-2 p-4" style={{ background: '#ecfdf5', borderColor: 'var(--color-primary, #0d9668)' }}>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-primary, #0d9668)' }}>
                  <FileDown className="h-4 w-4" /> Demo Yönetici Hesabı
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => copyToClipboard(credentials.adminEmail, 'email')} className="inline-flex h-9 items-center gap-1.5 rounded border px-3 text-xs font-semibold" style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                    {copied === 'email' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {credentials.adminEmail}
                  </button>
                  <button type="button" onClick={() => copyToClipboard(credentials.adminTc, 'tc')} className="inline-flex h-9 items-center gap-1.5 rounded border px-3 text-xs font-semibold" style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                    {copied === 'tc' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    TC: {credentials.adminTc}
                  </button>
                  <button type="button" onClick={() => copyToClipboard(credentials.tempPassword, 'pwd')} className="inline-flex h-9 items-center gap-1.5 rounded border px-3 text-xs font-semibold" style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                    {copied === 'pwd' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Şifre: {credentials.tempPassword}
                  </button>
                </div>
              </div>

              {credentials.staffEmail && credentials.staffTc && (
                <div className="rounded-lg border-2 p-4" style={{ background: 'var(--color-info-bg)', borderColor: 'var(--color-info)' }}>
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-info)' }}>
                    <Users className="h-4 w-4" /> Örnek Personel Hesabı
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => copyToClipboard(credentials.staffEmail!, 'email')} className="inline-flex h-9 items-center gap-1.5 rounded border px-3 text-xs font-semibold" style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                      {copied === 'email' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {credentials.staffEmail}
                    </button>
                    <button type="button" onClick={() => copyToClipboard(credentials.staffTc!, 'tc')} className="inline-flex h-9 items-center gap-1.5 rounded border px-3 text-xs font-semibold" style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                      {copied === 'tc' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      TC: {credentials.staffTc}
                    </button>
                    <button type="button" onClick={() => copyToClipboard(credentials.tempPassword, 'pwd')} className="inline-flex h-9 items-center gap-1.5 rounded border px-3 text-xs font-semibold" style={{ background: '#fff', color: 'var(--color-text-primary)', borderColor: 'var(--color-border)' }}>
                      {copied === 'pwd' ? <CheckCheck className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Şifre: {credentials.tempPassword}
                    </button>
                  </div>
                </div>
              )}

              <div className="flex pt-2">
                 <Button type="button" onClick={downloadCredentialsPdf} disabled={downloadingPdf} className="w-full gap-2 text-white" style={{ background: 'var(--color-primary, #0d9668)' }}>
                  <FileDown className="h-4 w-4" />
                  {downloadingPdf ? 'PDF üretiliyor...' : 'Giriş Bilgilerini PDF Olarak İndir'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={accessInfoTarget !== null} onOpenChange={(open) => { if (!open) setAccessInfoTarget(null); }}>
        <DialogContent showCloseButton>
          {accessInfoTarget && (
            <>
              <DialogHeader>
                <div className="mb-1 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-info-bg)' }}>
                    <KeyRound className="h-5 w-5" style={{ color: 'var(--color-info)' }} />
                  </div>
                  <DialogTitle>Giriş Bilgileri</DialogTitle>
                </div>
                <DialogDescription>{accessInfoTarget.name}</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-xl border p-4" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Demo Yönetici E-postası</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded px-2 py-1.5 text-xs" style={{ background: 'var(--color-bg)' }}>
                      {accessInfoTarget.users[0]?.email ?? 'Yönetici bulunamadı'}
                    </code>
                    {accessInfoTarget.users[0]?.email && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(accessInfoTarget.users[0].email, 'email')}
                      >
                        {copied === 'email' ? <CheckCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border p-4" style={{ background: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)40' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-warning)' }}>
                    Şifre yalnız demo oluşturulduğu anda gösterilir.
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    Şifre kaybolduysa bu demoyu silip yeni bir demo oluşturun.
                  </p>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={suspendTarget !== null} onOpenChange={(open) => { if (!open) closeSuspendModal(); }}>
        <DialogContent showCloseButton>
          {suspendTarget && (
            <>
              <DialogHeader>
                <div className="mb-1 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: suspendTarget.mode === 'suspend' ? 'var(--color-error-bg)' : 'var(--color-success-bg)' }}>
                    {suspendTarget.mode === 'suspend'
                      ? <TriangleAlert className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
                      : <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />}
                  </div>
                  <DialogTitle>{suspendTarget.mode === 'suspend' ? 'Demo Erişimini Kes' : 'Demo Erişimini Aç'}</DialogTitle>
                </div>
                <DialogDescription>
                  {suspendTarget.mode === 'suspend'
                    ? `"${suspendTarget.demo.name}" kullanıcıları sisteme erişemez.`
                    : `"${suspendTarget.demo.name}" kullanıcıları tekrar sisteme erişebilir.`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {suspendTarget.mode === 'suspend' && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold">Erişimi Kesme Nedeni</Label>
                      <textarea
                        rows={3}
                        placeholder="Ör: Demo süresi tamamlandı..."
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        className="w-full resize-none rounded-xl border px-3 py-2.5 text-[13px] outline-none"
                        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold">
                        Onaylamak için demo adını yazın: <span className="font-mono" style={{ color: 'var(--color-error)' }}>{suspendTarget.demo.name.trim()}</span>
                      </Label>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={suspendTarget.demo.name.trim()}
                        className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                        style={{ background: 'var(--color-bg)', borderColor: confirmText && confirmText.trim() !== suspendTarget.demo.name.trim() ? 'var(--color-error)' : 'var(--color-border)', color: 'var(--color-text-primary)' }}
                      />
                    </div>
                  </>
                )}

                {suspendTarget.mode === 'activate' && (
                  <div className="flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success)20' }}>
                    <Shield className="h-4 w-4 shrink-0" style={{ color: 'var(--color-success)' }} />
                    <p className="text-[12px]" style={{ color: 'var(--color-success)' }}>
                      Bu demo {suspendTarget.demo._count.users} kullanıcıyla tekrar açılır.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={closeSuspendModal} className="rounded-xl border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  İptal
                </button>
                <button
                  onClick={handleSuspendConfirm}
                  disabled={isSubmitting || (suspendTarget.mode === 'suspend' && confirmText.trim() !== suspendTarget.demo.name.trim())}
                  className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-150 disabled:opacity-40"
                  style={{ background: suspendTarget.mode === 'suspend' ? 'var(--color-error)' : 'var(--color-success)' }}
                >
                  {isSubmitting ? 'İşleniyor...' : suspendTarget.mode === 'suspend' ? 'Erişimi Kes' : 'Erişimi Aç'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent showCloseButton>
          {deleteTarget && (
            <>
              <DialogHeader>
                <div className="mb-1 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'var(--color-error-bg)' }}>
                    <Trash2 className="h-5 w-5" style={{ color: 'var(--color-error)' }} />
                  </div>
                  <DialogTitle>Demoyu Kalıcı Sil</DialogTitle>
                </div>
                <DialogDescription>
                  "{deleteTarget.name}" ve ona bağlı demo kullanıcıları, eğitimleri, sınavları ve sertifikaları silinir.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label className="text-[13px] font-semibold">
                  Onaylamak için demo adını yazın: <span className="font-mono" style={{ color: 'var(--color-error)' }}>{deleteTarget.name.trim()}</span>
                </Label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deleteTarget.name.trim()}
                  className="w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
                  style={{ background: 'var(--color-bg)', borderColor: deleteConfirmText && deleteConfirmText.trim() !== deleteTarget.name.trim() ? 'var(--color-error)' : 'var(--color-border)', color: 'var(--color-text-primary)' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button onClick={() => setDeleteTarget(null)} className="rounded-xl border px-4 py-2 text-[13px] font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
                  İptal
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isSubmitting || deleteConfirmText.trim() !== deleteTarget.name.trim()}
                  className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-150 disabled:opacity-40"
                  style={{ background: 'var(--color-error)' }}
                >
                  {isSubmitting ? 'Siliniyor...' : 'Kalıcı Sil'}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
