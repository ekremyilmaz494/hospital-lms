'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Boxes, Plus, Search, Building2, User, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { PageHeader } from '@/components/shared/page-header';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';

interface GroupRaw {
  id: string;
  name: string;
  code: string;
  maxOrganizations: number | null;
  isActive: boolean;
  createdAt: string;
  ownerUser: { id: string; firstName: string; lastName: string; email: string } | null;
  _count: { organizations: number };
}

interface GroupsResponse {
  groups: GroupRaw[];
  total: number;
}

export default function GroupsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useFetch<GroupsResponse>('/api/super-admin/groups?limit=200');

  const allGroups = data?.groups ?? [];
  const filtered = allGroups.filter(
    (g) =>
      !search ||
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.code.toLowerCase().includes(search.toLowerCase()),
  );

  const totalCount = allGroups.length;
  const activeCount = allGroups.filter((g) => g.isActive).length;
  const totalHospitals = allGroups.reduce((sum, g) => sum + g._count.organizations, 0);

  if (isLoading) return <PageLoading />;
  if (error)
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );

  return (
    <div className="space-y-6">
      <BlurFade delay={0.01}>
        <PageHeader
          title="Hastane Grupları"
          subtitle="Çok-hastaneli müşteriler ve grup yöneticileri"
          action={{ label: 'Yeni Grup', icon: Plus, href: '/super-admin/groups/new' }}
        />
      </BlurFade>

      <BlurFade delay={0.03}>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Toplam Grup', value: totalCount, icon: Boxes, color: 'var(--color-primary)' },
            { label: 'Aktif', value: activeCount, icon: Crown, color: 'var(--color-success)' },
            { label: 'Toplam Hastane', value: totalHospitals, icon: Building2, color: 'var(--color-info)' },
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
                <p className="text-xl font-bold font-mono">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <Input
            placeholder="Grup ara (isim veya kod)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', borderRadius: 'var(--radius-lg)' }}
          />
        </div>
      </BlurFade>

      <BlurFade delay={0.07}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border py-16" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-bg)' }}>
              <Boxes className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-[15px] font-bold mb-1">Grup bulunamadı</p>
            <p className="text-[13px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {search ? 'Arama kriterlerinizi değiştirmeyi deneyin' : 'Henüz hastane grubu oluşturulmamış'}
            </p>
            {!search && (
              <Link href="/super-admin/groups/new">
                <Button className="gap-2 rounded-xl text-white font-semibold" style={{ background: 'var(--color-primary)' }}>
                  <Plus className="h-4 w-4" /> İlk Grubu Oluştur
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((group) => {
              const createdDate = new Date(group.createdAt).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const limitLabel =
                group.maxOrganizations != null
                  ? `${group._count.organizations} / ${group.maxOrganizations} hastane`
                  : `${group._count.organizations} hastane`;
              const atLimit = group.maxOrganizations != null && group._count.organizations >= group.maxOrganizations;
              return (
                <button
                  key={group.id}
                  onClick={() => router.push(`/super-admin/groups/${group.id}`)}
                  className="group relative w-full text-left rounded-2xl border overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)', opacity: group.isActive ? 1 : 0.75 }}
                >
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl" style={{ background: 'linear-gradient(180deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 40%, transparent))' }} />
                  <div className="flex items-center gap-5 p-5">
                    <Avatar className="h-12 w-12 shrink-0 transition-transform duration-200 group-hover:scale-105">
                      <AvatarFallback className="text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, black))' }}>
                        {group.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[15px] font-bold truncate">{group.name}</h3>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>{group.code}</span>
                      </div>
                      <div className="flex items-center gap-4 text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> {limitLabel}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <User className="h-3.5 w-3.5" />
                          {group.ownerUser ? `${group.ownerUser.firstName} ${group.ownerUser.lastName}` : 'Yönetici yok'}
                        </span>
                        <span className="font-mono">{createdDate}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {atLimit && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                          Limit dolu
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: group.isActive ? 'var(--color-success-bg)' : 'var(--color-bg)', color: group.isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                        {group.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </BlurFade>
    </div>
  );
}
