'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Library, Plus, MoreHorizontal, Edit, Eye, EyeOff, Send, Clock, Star, Users2, X,
} from 'lucide-react'

const ContentModal = dynamic(() => import('./content-modal'), { ssr: false })
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/shared/data-table'
import { useFetch } from '@/hooks/use-fetch'
import { PageLoading } from '@/components/shared/page-loading'
import { useToast } from '@/components/shared/toast'
import {
  CONTENT_LIBRARY_CATEGORIES,
  CONTENT_LIBRARY_DIFFICULTY,
  CONTENT_LIBRARY_TARGET_ROLES,
  type ContentLibraryCategoryKey,
  type ContentLibraryDifficulty,
} from '@/lib/content-library-categories'

interface ContentLibraryItem {
  id: string
  title: string
  description: string | null
  category: string
  thumbnailUrl: string | null
  duration: number
  smgPoints: number
  difficulty: string
  targetRoles: string[]
  isActive: boolean
  createdAt: string
  installCount: number
}

interface PageData {
  items: ContentLibraryItem[]
  total: number
}

const DIFFICULTY_CONFIG = CONTENT_LIBRARY_DIFFICULTY
const CATEGORY_CONFIG = CONTENT_LIBRARY_CATEGORIES

// ── Ana Sayfa ─────────────────────────────────────────────────────────────

export default function SuperAdminContentLibraryPage() {
  const { toast } = useToast()
  const { data, isLoading, error, refetch } = useFetch<PageData>('/api/super-admin/content-library?limit=200')

  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ContentLibraryItem | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null)

  if (isLoading) return <PageLoading />
  if (error) return (
    <div className="flex h-64 items-center justify-center text-sm" style={{ color: 'var(--color-error)' }}>
      {error}
    </div>
  )

  const allItems = data?.items ?? []

  const filtered = allItems.filter(item => {
    if (categoryFilter && item.category !== categoryFilter) return false
    if (difficultyFilter && item.difficulty !== difficultyFilter) return false
    return true
  })

  const handleToggleActive = async (item: ContentLibraryItem) => {
    try {
      const res = await fetch(`/api/super-admin/content-library/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      })
      if (!res.ok) throw new Error()
      toast(`"${item.title}" ${!item.isActive ? 'aktif edildi' : 'pasife alındı'}`, 'success')
      refetch()
    } catch {
      toast('Durum güncellenemedi', 'error')
    }
  }

  const columns: ColumnDef<ContentLibraryItem>[] = [
    {
      accessorKey: 'title',
      header: 'İçerik',
      size: 250,
      cell: ({ row }) => {
        const cat = CATEGORY_CONFIG[row.original.category as ContentLibraryCategoryKey]
        return (
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: `${cat?.color ?? 'var(--color-primary)'}20` }}
            >
              <Library className="h-5 w-5" style={{ color: cat?.color ?? 'var(--color-primary)' }} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                {row.original.title}
              </p>
              {row.original.description && (
                <p className="text-xs line-clamp-1 mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {row.original.description}
                </p>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'category',
      header: 'Kategori',
      size: 110,
      cell: ({ row }) => {
        const cat = CATEGORY_CONFIG[row.original.category as ContentLibraryCategoryKey]
        return (
          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: `${cat?.color ?? 'var(--color-primary)'}18`, color: cat?.color ?? 'var(--color-primary)' }}>
            {cat?.label ?? row.original.category}
          </span>
        )
      },
    },
    {
      accessorKey: 'difficulty',
      header: 'Zorluk',
      size: 90,
      cell: ({ row }) => {
        const diff = DIFFICULTY_CONFIG[row.original.difficulty as ContentLibraryDifficulty]
        return (
          <span className="inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold"
            style={{ background: `${diff?.color ?? '#888'}18`, color: diff?.color ?? '#888' }}>
            {diff?.label ?? row.original.difficulty}
          </span>
        )
      },
    },
    {
      accessorKey: 'duration',
      header: 'Süre',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
            {row.original.duration} dk
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'smgPoints',
      header: 'SMG',
      size: 70,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5" style={{ color: 'var(--color-accent)' }} />
          <span className="text-sm font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
            {row.original.smgPoints}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'targetRoles',
      header: 'Hedef Roller',
      size: 140,
      cell: ({ row }) => {
        const roles = row.original.targetRoles
        const roleLabels = CONTENT_LIBRARY_TARGET_ROLES.filter(r => roles.includes(r.value))
        return (
          <div className="flex flex-wrap gap-1">
            {roleLabels.map(r => (
              <span key={r.value} className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}>
                {r.label}
              </span>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'installCount',
      header: 'Kurulum',
      size: 80,
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Users2 className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
            {row.original.installCount}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'Durum',
      size: 90,
      cell: ({ row }) => {
        const active = row.original.isActive
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: active ? 'var(--color-success-bg)' : 'var(--color-surface-hover)',
              color: active ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: active ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
            {active ? 'Aktif' : 'Pasif'}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-[var(--color-surface-hover)]">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem className="gap-2" onClick={() => setEditingItem(row.original)}>
              <Edit className="h-4 w-4" /> Düzenle
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onClick={() => handleToggleActive(row.original)}>
              {row.original.isActive
                ? <><EyeOff className="h-4 w-4" /> Pasife Al</>
                : <><Eye className="h-4 w-4" /> Aktif Et</>
              }
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const totalInstalls = allItems.reduce((sum, i) => sum + i.installCount, 0)
  const uniqueCategories = new Set(allItems.map(i => i.category)).size

  return (
    <div className="space-y-5">
      {(showAddModal || editingItem) && (
        <ContentModal
          editing={editingItem}
          onClose={() => { setShowAddModal(false); setEditingItem(null) }}
          onSuccess={refetch}
        />
      )}

      <PageHeader
        title="İçerik Kütüphanesi"
        subtitle="Hastanelere sunulan hazır eğitim içerikleri"
        badge={`${allItems.length} içerik`}
        action={{ label: 'Yeni İçerik Ekle', icon: Plus, onClick: () => setShowAddModal(true) }}
      />

      {/* Stat Kutuları */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Toplam İçerik', value: allItems.length, color: 'var(--color-primary)' },
          { label: 'Aktif', value: allItems.filter(i => i.isActive).length, color: 'var(--color-success)' },
          { label: 'Kategori', value: uniqueCategories, color: 'var(--color-info)' },
          { label: 'Toplam Kurulum', value: totalInstalls, color: 'var(--color-accent)' },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
            <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</span>
            <span className="ml-auto text-lg font-bold font-heading" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Kategori:</span>
        <button
          onClick={() => setCategoryFilter(null)}
          className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
          style={{
            background: !categoryFilter ? 'var(--color-primary-light)' : 'transparent',
            color: !categoryFilter ? 'var(--color-primary)' : 'var(--color-text-muted)',
            border: `1.5px solid ${!categoryFilter ? 'var(--color-primary)' : 'var(--color-border)'}`,
          }}
        >
          Tümü
        </button>
        {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
          const active = categoryFilter === key
          return (
            <button key={key} onClick={() => setCategoryFilter(active ? null : key)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
              style={{
                background: active ? `${cfg.color}18` : 'transparent',
                color: active ? cfg.color : 'var(--color-text-muted)',
                border: `1.5px solid ${active ? cfg.color : 'var(--color-border)'}`,
              }}>
              {cfg.label}
            </button>
          )
        })}

        <span className="ml-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Zorluk:</span>
        {Object.entries(DIFFICULTY_CONFIG).map(([key, cfg]) => {
          const active = difficultyFilter === key
          return (
            <button key={key} onClick={() => setDifficultyFilter(active ? null : key)}
              className="rounded-full px-3 py-1 text-[11px] font-semibold transition-colors"
              style={{
                background: active ? `${cfg.color}18` : 'transparent',
                color: active ? cfg.color : 'var(--color-text-muted)',
                border: `1.5px solid ${active ? cfg.color : 'var(--color-border)'}`,
              }}>
              {cfg.label}
            </button>
          )
        })}

        {(categoryFilter || difficultyFilter) && (
          <button
            onClick={() => { setCategoryFilter(null); setDifficultyFilter(null) }}
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}
          >
            <X className="h-3 w-3" /> Temizle
          </button>
        )}
      </div>

      {/* Tablo */}
      <div className="rounded-2xl border p-6" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
        {filtered.length > 0
          ? <DataTable columns={columns} data={filtered} searchKey="title" searchPlaceholder="İçerik ara..." />
          : (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--color-surface-hover)' }}>
                <Library className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>Henüz içerik eklenmemiş</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: 'var(--color-primary)' }}
              >
                <Plus className="h-4 w-4" /> İlk İçeriği Ekle
              </button>
            </div>
          )
        }
      </div>
    </div>
  )
}
