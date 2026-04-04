'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, Plus, Loader2, Check, AlertCircle, Link2, FileEdit, ChevronDown } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'
import type { UploadedDocument, SourceType } from '../types'
import { MAX_FILES } from '../constants'

interface DocumentUploaderProps {
  documents: UploadedDocument[]
  uploading: boolean
  error: string | null
  allReady: boolean
  processingCount: number
  onUpload: (files: FileList | File[]) => Promise<void>
  onAddSource: (params: { sourceType: SourceType; url?: string; title?: string; content?: string }) => Promise<void>
  onRemove: (id: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: '📄', docx: '📝', pptx: '📊', txt: '📃', md: '📃',
  url: '🔗', youtube: '🎥', text: '💬',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; pulse: boolean }> = {
  uploading: { label: 'Yükleniyor...', color: 'var(--color-warning)', pulse: true },
  processing: { label: 'İşleniyor...', color: 'var(--color-primary)', pulse: true },
  ready: { label: 'Hazır', color: 'var(--color-success)', pulse: false },
  error: { label: 'Hata', color: 'var(--color-error)', pulse: false },
}

export function DocumentUploader({
  documents, uploading, error, allReady, processingCount,
  onUpload, onAddSource, onRemove,
}: DocumentUploaderProps) {
  const [dragActive, setDragActive] = useState(false)
  const [activeTab, setActiveTab] = useState<'url' | 'youtube' | 'text' | null>(null)
  const [urlInput, setUrlInput] = useState('')
  const [textTitle, setTextTitle] = useState('')
  const [textContent, setTextContent] = useState('')
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (e.dataTransfer.files.length > 0) {
      onUpload(e.dataTransfer.files)
    }
  }, [onUpload])

  const handleAddUrl = async (type: 'url' | 'youtube') => {
    if (!urlInput.trim()) return
    await onAddSource({ sourceType: type, url: urlInput.trim() })
    setUrlInput('')
    setActiveTab(null)
  }

  const handleAddText = async () => {
    if (!textTitle.trim() || !textContent.trim()) return
    await onAddSource({ sourceType: 'text', title: textTitle.trim(), content: textContent.trim() })
    setTextTitle('')
    setTextContent('')
    setActiveTab(null)
  }

  return (
    <div className="space-y-4">
      {/* Drag-Drop Zone */}
      <div
        className="relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-colors"
        style={{
          borderColor: dragActive ? 'var(--color-primary)' : 'var(--color-border)',
          background: dragActive ? 'var(--color-primary-light)' : 'var(--color-surface)',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.pptx,.txt,.md"
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-10 w-10 animate-spin" style={{ color: 'var(--color-primary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Yükleniyor...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-10 w-10" style={{ color: dragActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
              Belge sürükleyip bırakın veya tıklayın
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              PDF, DOCX, PPTX, TXT, MD — Maks 20MB
            </p>
          </div>
        )}
      </div>

      {/* Alternative Source Tabs */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {([
            { key: 'url' as const, icon: <Link2 className="h-3.5 w-3.5" />, label: 'URL' },
            { key: 'youtube' as const, icon: <span className="text-sm">🎥</span>, label: 'YouTube' },
            { key: 'text' as const, icon: <FileEdit className="h-3.5 w-3.5" />, label: 'Metin' },
          ]).map(({ key, icon, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(activeTab === key ? null : key)}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: activeTab === key ? 'var(--color-primary)' : 'var(--color-surface-hover)',
                color: activeTab === key ? 'white' : 'var(--color-text-secondary)',
                border: `1px solid ${activeTab === key ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {activeTab && (
          <BlurFade>
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--color-surface-hover)', border: '1px solid var(--color-border)' }}
            >
              {(activeTab === 'url' || activeTab === 'youtube') && (
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder={activeTab === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                    className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddUrl(activeTab)}
                    disabled={!urlInput.trim() || uploading}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ekle
                  </button>
                </div>
              )}
              {activeTab === 'text' && (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={textTitle}
                    onChange={(e) => setTextTitle(e.target.value)}
                    placeholder="Başlık"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="İçerik metni..."
                    rows={4}
                    className="w-full resize-y rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text-primary)' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddText}
                    disabled={!textTitle.trim() || !textContent.trim() || uploading}
                    className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Ekle
                  </button>
                </div>
              )}
            </div>
          </BlurFade>
        )}
      </div>

      {/* Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => {
            const icon = FILE_TYPE_ICONS[doc.sourceType] || FILE_TYPE_ICONS[doc.fileType] || '📄'
            const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.processing
            const isExpanded = expandedDoc === doc.id && doc.status === 'ready'

            return (
              <BlurFade key={doc.id}>
                <div
                  className="rounded-xl p-3"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {doc.fileName}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                    <span
                      className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ background: `color-mix(in srgb, ${statusCfg.color} 15%, transparent)`, color: statusCfg.color }}
                    >
                      {statusCfg.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: statusCfg.color }} />}
                      {doc.status === 'ready' && <Check className="h-3 w-3" />}
                      {doc.status === 'error' && <AlertCircle className="h-3 w-3" />}
                      {statusCfg.label}
                    </span>
                    {doc.status === 'ready' && (doc.summary || doc.keyTopics) && (
                      <button
                        type="button"
                        onClick={() => setExpandedDoc(isExpanded ? null : doc.id)}
                        className="p-1 transition-transform"
                        style={{ color: 'var(--color-text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemove(doc.id)}
                      className="rounded-lg p-1 transition-colors"
                      style={{ color: 'var(--color-text-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-muted)' }}
                      aria-label="Belgeyi kaldır"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                      {doc.summary && (
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                          {doc.summary}
                        </p>
                      )}
                      {doc.keyTopics && doc.keyTopics.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {doc.keyTopics.map((topic, i) => (
                            <span
                              key={i}
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </BlurFade>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span>{documents.length}/{MAX_FILES} belge yüklendi</span>
        {allReady && documents.length > 0 && (
          <span className="flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
            <Check className="h-3.5 w-3.5" />
            Tüm belgeler hazır
          </span>
        )}
        {processingCount > 0 && (
          <span className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            {processingCount} belge işleniyor...
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-start gap-2 rounded-xl p-3 text-sm"
          style={{
            background: 'color-mix(in srgb, var(--color-error) 10%, var(--color-surface))',
            color: 'var(--color-error)',
          }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
