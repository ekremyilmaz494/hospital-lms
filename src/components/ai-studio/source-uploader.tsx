'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Upload, X, Link as LinkIcon, Loader2, FileUp, Plus } from 'lucide-react'
import { K } from './k-tokens'
import { useToast } from '@/components/shared/toast'
import {
  AI_MAX_SOURCE_FILES,
  AI_MAX_SOURCE_SIZE_MB,
  AI_MAX_SOURCE_URLS,
} from '@/lib/ai-content-studio/constants'

export interface UploadedSource {
  s3Key: string
  filename: string
  size: number
  mimeType: string
}

interface SourceUploaderProps {
  files: UploadedSource[]
  onFilesChange: (files: UploadedSource[]) => void
  urls: string[]
  onUrlsChange: (urls: string[]) => void
  disabled?: boolean
}

export function SourceUploader({
  files, onFilesChange, urls, onUrlsChange, disabled,
}: SourceUploaderProps) {
  const { toast: showToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [urlDraft, setUrlDraft] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const uploadOne = useCallback(async (file: File) => {
    const sizeMb = file.size / (1024 * 1024)
    if (sizeMb > AI_MAX_SOURCE_SIZE_MB) {
      showToast(`"${file.name}" çok büyük (maks ${AI_MAX_SOURCE_SIZE_MB} MB)`, 'error')
      return null
    }
    const presignRes = await fetch('/api/admin/ai-content-studio/sources/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
      }),
    })
    const presign = await presignRes.json()
    if (!presignRes.ok) {
      showToast(presign.error ?? 'Yükleme bağlantısı alınamadı', 'error')
      return null
    }
    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || 'application/octet-stream' },
      body: file,
    })
    if (!putRes.ok) {
      showToast(`"${file.name}" yüklenemedi`, 'error')
      return null
    }
    const result: UploadedSource = {
      s3Key: presign.s3Key,
      filename: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
    }
    return result
  }, [showToast])

  const handleFiles = useCallback(async (list: FileList | File[]) => {
    if (disabled) return
    const arr = Array.from(list)
    const remaining = AI_MAX_SOURCE_FILES - files.length
    if (remaining <= 0) {
      showToast(`En fazla ${AI_MAX_SOURCE_FILES} dosya yükleyebilirsiniz`, 'error')
      return
    }
    const slice = arr.slice(0, remaining)
    setUploading(true)
    const next: UploadedSource[] = [...files]
    for (let i = 0; i < slice.length; i++) {
      setProgress(`${i + 1}/${slice.length} — ${slice[i].name}`)
      const r = await uploadOne(slice[i])
      if (r) next.push(r)
    }
    onFilesChange(next)
    setUploading(false)
    setProgress(null)
  }, [files, onFilesChange, uploadOne, showToast, disabled])

  const handleAddUrl = useCallback(() => {
    const v = urlDraft.trim()
    if (!v) return
    if (!/^https?:\/\//i.test(v)) {
      showToast('Geçerli bir URL girin (http:// veya https://)', 'error')
      return
    }
    if (urls.length >= AI_MAX_SOURCE_URLS) {
      showToast(`En fazla ${AI_MAX_SOURCE_URLS} URL ekleyebilirsiniz`, 'error')
      return
    }
    onUrlsChange([...urls, v])
    setUrlDraft('')
  }, [urlDraft, urls, onUrlsChange, showToast])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (!disabled && e.dataTransfer.files) handleFiles(e.dataTransfer.files)
        }}
        style={{
          border: `2px dashed ${dragOver ? K.PRIMARY : K.BORDER}`,
          background: dragOver ? K.PRIMARY_LIGHT : K.BG,
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          disabled={disabled || uploading}
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
        <FileUp size={28} color={K.PRIMARY} style={{ marginBottom: 6 }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: K.TEXT_PRIMARY }}>
          {uploading ? 'Yükleniyor...' : 'Dosyaları sürükleyin veya tıklayın'}
        </div>
        <div style={{ fontSize: 12, color: K.TEXT_MUTED, marginTop: 4 }}>
          Maks {AI_MAX_SOURCE_FILES} dosya · her biri en fazla {AI_MAX_SOURCE_SIZE_MB} MB · PDF, DOCX, TXT, MP3, MP4
        </div>
        {progress && (
          <div style={{
            fontSize: 12, color: K.PRIMARY, marginTop: 8,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            <Loader2 size={12} className="animate-spin" />
            {progress}
          </div>
        )}
      </div>

      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map((f) => (
            <div
              key={f.s3Key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '8px 12px', borderRadius: 8,
                background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <Upload size={14} color={K.TEXT_MUTED} />
                <span style={{
                  fontSize: 13, color: K.TEXT_PRIMARY, fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{f.filename}</span>
                <span style={{ fontSize: 12, color: K.TEXT_MUTED }}>
                  {(f.size / (1024 * 1024)).toFixed(1)} MB
                </span>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFilesChange(files.filter((x) => x.s3Key !== f.s3Key))}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: K.TEXT_MUTED, padding: 4, display: 'inline-flex',
                }}
                aria-label="Kaldır"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 12px', borderRadius: 8, border: `1px solid ${K.BORDER}`, background: K.SURFACE,
        }}>
          <LinkIcon size={14} color={K.TEXT_MUTED} />
          <input
            type="url"
            placeholder="https:// kaynak URL'si ekle (opsiyonel)"
            value={urlDraft}
            disabled={disabled}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl() } }}
            onBlur={() => { if (urlDraft.trim().startsWith('http')) handleAddUrl() }}
            style={{
              flex: 1, border: 'none', outline: 'none', padding: '10px 0',
              background: 'transparent', fontSize: 13, color: K.TEXT_PRIMARY,
            }}
          />
        </div>
        <button
          type="button"
          disabled={disabled || !urlDraft.trim()}
          onClick={handleAddUrl}
          style={{
            padding: '8px 14px', borderRadius: 8, border: `1px solid ${K.BORDER}`,
            background: K.SURFACE, color: K.TEXT_PRIMARY, cursor: 'pointer',
            fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          <Plus size={14} /> Ekle
        </button>
      </div>

      {urls.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {urls.map((u) => (
            <div
              key={u}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '6px 12px', borderRadius: 8,
                background: K.SURFACE, border: `1px solid ${K.BORDER_LIGHT}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <LinkIcon size={12} color={K.TEXT_MUTED} />
                <span style={{
                  fontSize: 12, color: K.TEXT_SECONDARY,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{u}</span>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onUrlsChange(urls.filter((x) => x !== u))}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: K.TEXT_MUTED, padding: 4, display: 'inline-flex',
                }}
                aria-label="Kaldır"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
