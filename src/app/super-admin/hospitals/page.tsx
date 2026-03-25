'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Building2, Plus, MoreHorizontal, Eye, Edit, Ban, CheckCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';

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

// Mock data — 12 hospitals
const mockHospitals: Hospital[] = [
  { id: '1', name: 'Devakent Hastanesi', code: 'DEV001', staffCount: 245, trainingCount: 32, plan: 'Kurumsal', status: 'Aktif', createdAt: '22.03.2026' },
  { id: '2', name: 'Anadolu Sağlık', code: 'ANA002', staffCount: 120, trainingCount: 18, plan: 'Profesyonel', status: 'Aktif', createdAt: '18.03.2026' },
  { id: '3', name: 'Başkent Tıp Merkezi', code: 'BAS003', staffCount: 89, trainingCount: 12, plan: 'Başlangıç', status: 'Trial', createdAt: '15.03.2026' },
  { id: '4', name: 'Marmara Üniversitesi H.', code: 'MAR004', staffCount: 312, trainingCount: 45, plan: 'Kurumsal', status: 'Aktif', createdAt: '10.03.2026' },
  { id: '5', name: 'Ege Şifa Hastanesi', code: 'EGE005', staffCount: 67, trainingCount: 8, plan: 'Profesyonel', status: 'Aktif', createdAt: '08.03.2026' },
  { id: '6', name: 'Çukurova Devlet H.', code: 'CUK006', staffCount: 198, trainingCount: 24, plan: 'Profesyonel', status: 'Askıda', createdAt: '01.03.2026' },
  { id: '7', name: 'Akdeniz Hastanesi', code: 'AKD007', staffCount: 156, trainingCount: 20, plan: 'Başlangıç', status: 'Süresi Doldu', createdAt: '25.02.2026' },
  { id: '8', name: 'Karadeniz Tıp Merkezi', code: 'KAR008', staffCount: 278, trainingCount: 35, plan: 'Kurumsal', status: 'Aktif', createdAt: '20.02.2026' },
  { id: '9', name: 'İç Anadolu Sağlık', code: 'ICA009', staffCount: 134, trainingCount: 15, plan: 'Profesyonel', status: 'Aktif', createdAt: '15.02.2026' },
  { id: '10', name: 'Trakya Hastanesi', code: 'TRA010', staffCount: 91, trainingCount: 11, plan: 'Başlangıç', status: 'Trial', createdAt: '10.02.2026' },
  { id: '11', name: 'Güneydoğu Şifa H.', code: 'GUN011', staffCount: 176, trainingCount: 22, plan: 'Profesyonel', status: 'Aktif', createdAt: '05.02.2026' },
  { id: '12', name: 'Doğu Anadolu Tıp M.', code: 'DOG012', staffCount: 203, trainingCount: 28, plan: 'Kurumsal', status: 'Aktif', createdAt: '01.02.2026' },
];

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
        <DropdownMenuTrigger>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
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
        <DataTable
          columns={columns}
          data={mockHospitals}
          searchKey="name"
          searchPlaceholder="Hastane ara (isim veya kod)..."
        />
      </div>
    </div>
  );
}
