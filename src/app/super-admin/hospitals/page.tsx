'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Building2, Plus, MoreHorizontal, Eye, Edit, Ban, CheckCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageLoading } from '@/components/shared/page-loading';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { useFetch } from '@/hooks/use-fetch';

interface Hospital {
  id: string;
  name: string;
  code: string;
  staffCount: number;
  trainingCount: number;
  plan: string;
  status: string;
  createdAt: string;
}

const planColors: Record<string, { bg: string; text: string }> = {
  'Başlangıç': { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  'Profesyonel': { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  'Kurumsal': { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
};

const statusColors: Record<string, { bg: string; text: string }> = {
  'Aktif': { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  'Trial': { bg: 'var(--color-info-bg)', text: 'var(--color-info)' },
  'Askıda': { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)' },
  'Süresi Doldu': { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

const columns: ColumnDef<Hospital>[] = [
  {
    accessorKey: 'code',
    header: 'Kod',
    cell: ({ row }) => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        {row.getValue('code')}
      </span>
    ),
  },
  {
    accessorKey: 'name',
    header: 'Hastane Adı',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback
            className="text-xs font-semibold text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {(row.getValue('name') as string).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="font-medium">{row.getValue('name')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'staffCount',
    header: 'Personel',
    cell: ({ row }) => (
      <span style={{ fontFamily: 'var(--font-mono)' }}>
        {(row.getValue('staffCount') as number).toLocaleString('tr-TR')}
      </span>
    ),
  },
  {
    accessorKey: 'trainingCount',
    header: 'Eğitim',
    cell: ({ row }) => (
      <span style={{ fontFamily: 'var(--font-mono)' }}>
        {row.getValue('trainingCount')}
      </span>
    ),
  },
  {
    accessorKey: 'plan',
    header: 'Plan',
    cell: ({ row }) => {
      const plan = row.getValue('plan') as string;
      const colors = planColors[plan] || { bg: 'var(--color-info-bg)', text: 'var(--color-info)' };
      return (
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: colors.bg, color: colors.text }}
        >
          {plan}
        </span>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Durum',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const colors = statusColors[status] || { bg: 'var(--color-info-bg)', text: 'var(--color-info)' };
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: colors.bg, color: colors.text }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.text }} />
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: 'createdAt',
    header: 'Kayıt Tarihi',
    cell: ({ row }) => (
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
        {row.getValue('createdAt')}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent hover:text-accent-foreground">
            <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="gap-2">
            <Eye className="h-4 w-4" /> Detay
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <Edit className="h-4 w-4" /> Düzenle
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2 text-red-500">
            <Ban className="h-4 w-4" /> Askıya Al
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function HospitalsPage() {
  const { data: hospitals, isLoading, error } = useFetch<Hospital[]>('/api/super-admin/hospitals');

  if (isLoading) {
    return <PageLoading />;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{color:'var(--color-error)'}}>{error}</div></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hastane Yönetimi"
        subtitle="Tüm hastaneleri görüntüle ve yönet"
        action={{
          label: 'Yeni Hastane',
          icon: Plus,
          href: '/super-admin/hospitals/new',
        }}
      />

      <div
        className="rounded-xl border p-5"
        style={{
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {(hospitals ?? []).length === 0 ? (
          <div className="flex items-center justify-center h-32"><div className="text-sm" style={{color:'var(--color-text-muted)'}}>Henüz veri yok</div></div>
        ) : (
          <DataTable
            columns={columns}
            data={hospitals ?? []}
            searchKey="name"
            searchPlaceholder="Hastane ara (isim veya kod)..."
          />
        )}
      </div>
    </div>
  );
}
