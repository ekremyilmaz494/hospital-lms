'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Users, Plus, Upload, MoreHorizontal, Eye, Edit, GraduationCap, Mail } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';

interface Staff {
  id: string;
  name: string;
  email: string;
  tcNo: string;
  department: string;
  title: string;
  assignedTrainings: number;
  completedTrainings: number;
  avgScore: number;
  status: string;
  initials: string;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  'Aktif': { bg: 'var(--color-success-bg)', text: 'var(--color-success)' },
  'Pasif': { bg: 'var(--color-error-bg)', text: 'var(--color-error)' },
};

const deptColors: Record<string, string> = {
  'Hemşirelik': 'var(--color-primary)', 'Acil Servis': 'var(--color-error)',
  'Radyoloji': 'var(--color-info)', 'Laboratuvar': 'var(--color-success)',
  'Eczane': 'var(--color-accent)', 'Temizlik': 'var(--color-warning)',
  'İdari': 'var(--color-text-muted)', 'Güvenlik': 'var(--color-secondary)',
};

const mockStaff: Staff[] = [
  { id: '1', name: 'Elif Kaya', email: 'elif@devakent.com', tcNo: '12345678901', department: 'Hemşirelik', title: 'Baş Hemşire', assignedTrainings: 8, completedTrainings: 8, avgScore: 97, status: 'Aktif', initials: 'EK' },
  { id: '2', name: 'Mehmet Demir', email: 'mehmet@devakent.com', tcNo: '23456789012', department: 'Acil Servis', title: 'Hemşire', assignedTrainings: 7, completedTrainings: 7, avgScore: 95, status: 'Aktif', initials: 'MD' },
  { id: '3', name: 'Ayşe Yıldız', email: 'ayse@devakent.com', tcNo: '34567890123', department: 'Radyoloji', title: 'Tekniker', assignedTrainings: 6, completedTrainings: 5, avgScore: 88, status: 'Aktif', initials: 'AY' },
  { id: '4', name: 'Ali Veli', email: 'ali@devakent.com', tcNo: '45678901234', department: 'Temizlik', title: 'Personel', assignedTrainings: 5, completedTrainings: 2, avgScore: 55, status: 'Aktif', initials: 'AV' },
  { id: '5', name: 'Fatma Ak', email: 'fatma@devakent.com', tcNo: '56789012345', department: 'Hemşirelik', title: 'Hemşire', assignedTrainings: 4, completedTrainings: 3, avgScore: 82, status: 'Aktif', initials: 'FA' },
  { id: '6', name: 'Hasan Kılıç', email: 'hasan@devakent.com', tcNo: '67890123456', department: 'Laboratuvar', title: 'Laborant', assignedTrainings: 8, completedTrainings: 8, avgScore: 91, status: 'Aktif', initials: 'HK' },
  { id: '7', name: 'Zeynep Arslan', email: 'zeynep@devakent.com', tcNo: '78901234567', department: 'Eczane', title: 'Eczacı', assignedTrainings: 5, completedTrainings: 5, avgScore: 93, status: 'Aktif', initials: 'ZA' },
  { id: '8', name: 'Mustafa Öz', email: 'mustafa@devakent.com', tcNo: '89012345678', department: 'Laboratuvar', title: 'Biyolog', assignedTrainings: 8, completedTrainings: 7, avgScore: 86, status: 'Aktif', initials: 'MÖ' },
  { id: '9', name: 'Cemile Tan', email: 'cemile@devakent.com', tcNo: '90123456789', department: 'İdari', title: 'Sekreter', assignedTrainings: 3, completedTrainings: 3, avgScore: 78, status: 'Aktif', initials: 'CT' },
  { id: '10', name: 'Osman Yurt', email: 'osman@devakent.com', tcNo: '01234567890', department: 'Güvenlik', title: 'Güvenlik', assignedTrainings: 4, completedTrainings: 1, avgScore: 45, status: 'Pasif', initials: 'OY' },
];

const columns: ColumnDef<Staff>[] = [
  {
    accessorKey: 'name',
    header: 'Personel',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs font-semibold text-white" style={{ background: deptColors[row.original.department] || 'var(--color-primary)' }}>{row.original.initials}</AvatarFallback>
        </Avatar>
        <div><p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>{row.getValue('name')}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.original.email}</p></div>
      </div>
    ),
  },
  {
    accessorKey: 'department',
    header: 'Departman',
    cell: ({ row }) => (
      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: `${deptColors[row.getValue('department') as string] || 'var(--color-primary)'}15`, color: deptColors[row.getValue('department') as string] || 'var(--color-primary)' }}>
        {row.getValue('department')}
      </span>
    ),
  },
  { accessorKey: 'title', header: 'Unvan', cell: ({ row }) => <span style={{ color: 'var(--color-text-secondary)' }}>{row.getValue('title')}</span> },
  {
    accessorKey: 'completedTrainings',
    header: 'Eğitim',
    cell: ({ row }) => (
      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
        {row.getValue('completedTrainings')}/{row.original.assignedTrainings}
      </span>
    ),
  },
  {
    accessorKey: 'avgScore',
    header: 'Ort. Puan',
    cell: ({ row }) => {
      const score = row.getValue('avgScore') as number;
      const color = score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
      return <span className="font-semibold" style={{ fontFamily: 'var(--font-mono)', color }}>{score}%</span>;
    },
  },
  {
    accessorKey: 'status',
    header: 'Durum',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const colors = statusColors[status] || statusColors['Aktif'];
      return <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ background: colors.bg, color: colors.text }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: colors.text }} />{status}</span>;
    },
  },
  {
    id: 'actions', header: '',
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="gap-2"><Eye className="h-4 w-4" /> Detay</DropdownMenuItem>
          <DropdownMenuItem className="gap-2"><Edit className="h-4 w-4" /> Düzenle</DropdownMenuItem>
          <DropdownMenuItem className="gap-2"><GraduationCap className="h-4 w-4" /> Eğitim Ata</DropdownMenuItem>
          <DropdownMenuItem className="gap-2"><Mail className="h-4 w-4" /> E-posta Gönder</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Personel Yönetimi" subtitle="Personelleri görüntüle ve yönet" />
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}><Upload className="h-4 w-4" /> Excel Import</Button>
          <Button className="gap-2 font-semibold text-white" style={{ background: 'var(--color-primary)', transition: 'background var(--transition-fast)' }}><Plus className="h-4 w-4" /> Yeni Personel</Button>
        </div>
      </div>
      <div className="rounded-xl border p-5" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        <DataTable columns={columns} data={mockStaff} searchKey="name" searchPlaceholder="Personel ara (isim, TC, e-posta)..." />
      </div>
    </div>
  );
}
