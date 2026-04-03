'use client'

import { useRef, useState } from 'react'
import { Upload, X, FileText, Loader2 } from 'lucide-react'
import type { UploadedDocument } from '../types'
import { ALLOWED_EXTENSIONS, MAX_FILES } from '../constants'

interface Props {
  documents: UploadedDocument[]
  uploading: boolean
  error: string | null
  onUpload: (files: FileList | File[]) => void
  onRemove: (id: string) => void
}

export function DocumentUploader({ documents, uploading, error, onUpload, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) onUpload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200"
        style={{
          borderColor: dragging ? 'var(--color-primary)' : 'var(--color-border)',
          background: dragging ? 'var(--color-primary-light)' : 'var(--color-bg)',
        }}
      >
        {uploading ? (
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--color-primary)' }} />
        ) : (
          <Upload className="h-8 w-8" style={{ color: 'var(--color-text-muted)' }} />
        )}
        <div className="text-center">
          <p className="text-sm font-semibold">
            {uploading ? 'Yükleniyor...' : 'Belge sürükleyin veya tıklayın'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {ALLOWED_EXTENSIONS.join(', ')} — Max 20MB — En fazla {MAX_FILES} belge
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={(e) => e.target.files && onUpload(e.target.files)}
        />
      </div>

      {error && (
        <p className="text-xs font-medium rounded-lg px-3 py-2" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
          {error}
        </p>
      )}

      {/* Yüklenen belgeler */}
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-3 rounded-xl border p-3"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--color-primary-light)' }}>
                <FileText className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate">{doc.name}</p>
                {doc.summary && (
                  <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>{doc.summary}</p>
                )}
                {doc.keyTopics && doc.keyTopics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {doc.keyTopics.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => onRemove(doc.id)} className="shrink-0 p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
