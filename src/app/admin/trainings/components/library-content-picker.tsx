'use client'

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Video, FileText, Music, Check, BookOpen } from 'lucide-react'

interface LibraryItem {
  id: string
  title: string
  description: string | null
  category: string
  contentType: string
  s3Key: string
  fileType: string
  duration: number
  difficulty: string
  thumbnailUrl: string | null
  createdAt: string
}

interface SelectedContent {
  id: number
  title: string
  url: string
  contentType: 'video' | 'pdf' | 'audio'
  durationSeconds: number
}

interface LibraryContentPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (items: SelectedContent[]) => void
}

const TYPE_FILTERS = [
  { key: 'all', label: 'Tümü', icon: BookOpen },
  { key: 'video', label: 'Video', icon: Video },
  { key: 'audio', label: 'Ses', icon: Music },
  { key: 'pdf', label: 'PDF', icon: FileText },
] as const

const CONTENT_TYPE_ICON: Record<string, typeof Video> = {
  video: Video,
  audio: Music,
  pdf: FileText,
}

const DIFFICULTY_LABEL: Record<string, string> = {
  BASIC: 'Temel',
  INTERMEDIATE: 'Orta',
  ADVANCED: 'İleri',
}

function mapContentType(ct: string): 'video' | 'pdf' | 'audio' {
  if (ct === 'video') return 'video'
  if (ct === 'audio') return 'audio'
  return 'pdf'
}

export function LibraryContentPicker({ open, onOpenChange, onSelect }: LibraryContentPickerProps) {
  const [items, setItems] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const types = typeFilter === 'all' ? 'video,audio,pdf' : typeFilter
      const params = new URLSearchParams({ type: types })
      if (search) params.set('search', search)

      const res = await fetch(`/api/admin/content-library/ai-items?${params}`)
      if (res.ok) {
        const data = await res.json()
        setItems(data.items ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [typeFilter, search])

  useEffect(() => {
    if (open) {
      fetchItems()
      setSelected(new Set())
    }
  }, [open, fetchItems])

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    const selectedItems: SelectedContent[] = items
      .filter(item => selected.has(item.id))
      .map((item, i) => ({
        id: Date.now() + i,
        title: item.title,
        url: item.s3Key,
        contentType: mapContentType(item.contentType),
        durationSeconds: item.duration * 60,
      }))
    onSelect(selectedItems)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Kütüphaneden İçerik Ekle</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <Input
              placeholder="İçerik ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchItems()}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex gap-1">
          {TYPE_FILTERS.map(f => (
            <Button
              key={f.key}
              variant={typeFilter === f.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTypeFilter(f.key)}
            >
              <f.icon className="h-3.5 w-3.5 mr-1" />
              {f.label}
            </Button>
          ))}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              Yükleniyor...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              <BookOpen className="h-10 w-10 mb-2 opacity-40" />
              <p>Kütüphanede içerik bulunamadı</p>
              <p className="text-sm">AI İçerik Stüdyosu&apos;ndan içerik üretip kütüphaneye kaydedin.</p>
            </div>
          ) : (
            items.map(item => {
              const Icon = CONTENT_TYPE_ICON[item.contentType] ?? FileText
              const isSelected = selected.has(item.id)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelect(item.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: isSelected ? 'var(--color-primary)' : 'var(--color-border)',
                    background: isSelected ? 'var(--color-primary-light, color-mix(in srgb, var(--brand-600) calc(0.06 * 100%), transparent))' : 'var(--color-surface)',
                  }}
                >
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--color-primary-light, color-mix(in srgb, var(--brand-600) calc(0.1 * 100%), transparent))' }}
                  >
                    <Icon className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="secondary" className="text-xs">{item.contentType}</Badge>
                      <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {item.duration} dk
                      </span>
                      {item.difficulty && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {DIFFICULTY_LABEL[item.difficulty] ?? item.difficulty}
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--color-primary)' }}
                    >
                      <Check className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {selected.size > 0 ? `${selected.size} öğe seçildi` : 'İçerik seçin'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button onClick={handleConfirm} disabled={selected.size === 0}>
              Ekle ({selected.size})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
