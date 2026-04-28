'use client'

import React, { useCallback, useRef, useState } from 'react'
import { Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { generateVideoThumbnail } from '@/lib/video-thumbnail'
import { useToast } from '@/components/shared/toast'
import {
  CONTENT_LIBRARY_CATEGORIES,
  CONTENT_LIBRARY_DIFFICULTY,
  CONTENT_LIBRARY_TARGET_ROLES,
} from '@/lib/content-library-categories'
import { K } from './shared'

interface UploadContentModalProps {
  onClose: () => void
  onSuccess: () => void
}

interface FileUploadState {
  fileName: string
  loaded: number
  total: number
  status: 'pending' | 'uploading' | 'done' | 'error'
  error?: string
}

export default function UploadContentModal({ onClose, onSuccess }: UploadContentModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<string>('BASIC')
  const [smgPoints, setSmgPoints] = useState<number | ''>('')
  const [targetRoles, setTargetRoles] = useState<string[]>(['all'])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<Record<string, FileUploadState>>({})

  const toggleRole = (role: string) => {
    setTargetRoles(prev => {
      if (role === 'all') return ['all']
      const next = prev.filter(r => r !== 'all')
      return next.includes(role) ? next.filter(r => r !== role) : [...next, role]
    })
  }

  const handleFilesChange = (fileList: FileList | null) => {
    if (!fileList) return
    const files = Array.from(fileList).slice(0, 20)
    setSelectedFiles(files)
    if (!title && files[0]) {
      setTitle(files[0].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      toast('Lütfen en az bir dosya seçin', 'error')
      return
    }
    if (!title.trim()) {
      toast('Başlık zorunlu', 'error')
      return
    }
    if (!category) {
      toast('Kategori zorunlu', 'error')
      return
    }

    setUploading(true)

    const payload = selectedFiles.map((f, idx) => ({
      fileName: f.name,
      contentType: f.type,
      title: selectedFiles.length === 1 ? title : `${title}${selectedFiles.length > 1 ? ` (${idx + 1})` : ''}`,
      category,
      description: description || undefined,
      difficulty,
      targetRoles,
      smgPoints: typeof smgPoints === 'number' ? smgPoints : undefined,
    }))

    try {
      const res = await fetch('/api/admin/content-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: payload }),
      })

      if (!res.ok) {
        const err = await res.json()
        toast(err.error || 'Yükleme başlatılamadı', 'error')
        setUploading(false)
        return
      }

      const { results } = await res.json() as {
        results: Array<{
          id?: string
          uploadUrl?: string
          thumbnailUploadUrl?: string | null
          fileName: string
          error?: string
        }>
      }

      // Hatalı sonuçları topla
      const failedPresign = results.filter(r => !r.uploadUrl)
      for (const f of failedPresign) {
        setProgress(prev => ({
          ...prev,
          [f.fileName]: { fileName: f.fileName, loaded: 0, total: 0, status: 'error', error: f.error ?? 'Hata' },
        }))
      }

      const uploads = results
        .filter((r): r is { id: string; uploadUrl: string; thumbnailUploadUrl?: string | null; fileName: string } =>
          !!r.uploadUrl && !!r.id,
        )
        .map(result => {
          const file = selectedFiles.find(f => f.name === result.fileName)
          if (!file) return Promise.resolve({ ok: false, id: result.id, fileName: result.fileName })

          setProgress(prev => ({
            ...prev,
            [result.fileName]: { fileName: result.fileName, loaded: 0, total: file.size, status: 'uploading' },
          }))

          if (file.type.startsWith('video/') && result.thumbnailUploadUrl) {
            generateVideoThumbnail(file).then(blob => {
              if (!blob || !result.thumbnailUploadUrl) return
              fetch(result.thumbnailUploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'image/jpeg' },
                body: blob,
              }).catch(() => {})
            }).catch(() => {})
          }

          return new Promise<{ ok: boolean; id: string; fileName: string }>(resolve => {
            const xhr = new XMLHttpRequest()
            xhr.upload.onprogress = e => {
              if (e.lengthComputable) {
                setProgress(prev => ({
                  ...prev,
                  [result.fileName]: {
                    fileName: result.fileName,
                    loaded: e.loaded,
                    total: e.total,
                    status: 'uploading',
                  },
                }))
              }
            }
            xhr.onload = () => {
              const ok = xhr.status >= 200 && xhr.status < 300
              setProgress(prev => ({
                ...prev,
                [result.fileName]: {
                  fileName: result.fileName,
                  loaded: file.size,
                  total: file.size,
                  status: ok ? 'done' : 'error',
                },
              }))
              resolve({ ok, id: result.id, fileName: result.fileName })
            }
            xhr.onerror = () => {
              setProgress(prev => ({
                ...prev,
                [result.fileName]: {
                  fileName: result.fileName,
                  loaded: 0,
                  total: file.size,
                  status: 'error',
                },
              }))
              resolve({ ok: false, id: result.id, fileName: result.fileName })
            }
            xhr.open('PUT', result.uploadUrl)
            xhr.setRequestHeader('Content-Type', file.type)
            xhr.send(file)
          })
        })

      const uploadResults = await Promise.all(uploads)
      const succeeded = uploadResults.filter(r => r.ok).length
      const failed = uploadResults.length - succeeded

      if (succeeded > 0 && failed === 0) {
        toast(`${succeeded} içerik yüklendi`, 'success')
        onSuccess()
        onClose()
      } else if (succeeded > 0 && failed > 0) {
        toast(`${succeeded} yüklendi, ${failed} başarısız`, 'error')
        onSuccess()
      } else {
        toast('Yükleme başarısız', 'error')
      }
    } catch {
      toast('Yükleme sırasında bir hata oluştu', 'error')
    } finally {
      setUploading(false)
    }
  }, [selectedFiles, title, category, description, difficulty, targetRoles, smgPoints, toast, onSuccess, onClose])

  const inputBaseStyle: React.CSSProperties = {
    width: '100%',
    background: K.SURFACE,
    border: `1.5px solid ${K.BORDER}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: K.TEXT_PRIMARY,
    outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 6,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: K.TEXT_MUTED,
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(28, 25, 23, 0.45)' }}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto"
        style={{
          background: K.SURFACE,
          border: `1.5px solid ${K.BORDER}`,
          borderRadius: 16,
          boxShadow: K.SHADOW_HOVER,
          animation: 'modalIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${K.BORDER_LIGHT}`, position: 'sticky', top: 0, background: K.SURFACE, zIndex: 1 }} className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center"
              style={{ width: 40, height: 40, background: K.PRIMARY_LIGHT, borderRadius: 10, color: K.PRIMARY }}
            >
              <Upload size={18} strokeWidth={1.75} />
            </div>
            <div>
              <h2 style={{ fontFamily: K.FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: K.TEXT_PRIMARY }}>
                İçerik Yükle
              </h2>
              <p style={{ fontSize: 12, color: K.TEXT_MUTED, marginTop: 2 }}>Video, PDF veya ses dosyası</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            style={{ padding: 8, borderRadius: 10, background: 'transparent', border: 'none', cursor: uploading ? 'not-allowed' : 'pointer', color: K.TEXT_MUTED, opacity: uploading ? 0.5 : 1 }}
            onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 24px' }} className="space-y-4">
          {/* Drop zone */}
          <div>
            <label style={labelStyle}>
              Dosya <span style={{ color: K.ERROR }}>*</span>
            </label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex w-full flex-col items-center justify-center gap-2"
              style={{
                background: selectedFiles.length > 0 ? K.PRIMARY_LIGHT : K.BG,
                border: `2px dashed ${selectedFiles.length > 0 ? K.PRIMARY : K.BORDER}`,
                borderRadius: 14,
                padding: '36px 16px',
                fontSize: 13,
                fontWeight: 500,
                color: selectedFiles.length > 0 ? K.PRIMARY : K.TEXT_SECONDARY,
                cursor: uploading ? 'not-allowed' : 'pointer',
                opacity: uploading ? 0.5 : 1,
                transition: 'background 200ms ease, border-color 200ms ease, color 200ms ease',
              }}
              onMouseEnter={(e) => {
                if (uploading) return
                e.currentTarget.style.background = K.PRIMARY_LIGHT
                e.currentTarget.style.borderColor = K.PRIMARY
                e.currentTarget.style.color = K.PRIMARY
              }}
              onMouseLeave={(e) => {
                if (uploading || selectedFiles.length > 0) return
                e.currentTarget.style.background = K.BG
                e.currentTarget.style.borderColor = K.BORDER
                e.currentTarget.style.color = K.TEXT_SECONDARY
              }}
            >
              <Upload size={26} strokeWidth={1.5} />
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} dosya seçildi`
                  : 'Buraya bırakın veya tıklayın'}
              </span>
              <span style={{ fontSize: 11, color: K.TEXT_MUTED }}>video · ses · PDF · pptx</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*,audio/*,.pdf,.pptx"
              className="hidden"
              onChange={e => {
                handleFilesChange(e.target.files)
                e.target.value = ''
              }}
            />
            {selectedFiles.length > 0 && (
              <ul style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {selectedFiles.map(f => (
                  <li
                    key={f.name}
                    className="flex items-center gap-2"
                    style={{ fontSize: 12, color: K.TEXT_SECONDARY, padding: '4px 8px', background: K.BG, borderRadius: 6 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 999, background: K.PRIMARY, flexShrink: 0 }} />
                    <span className="truncate">{f.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={labelStyle}>
              Başlık <span style={{ color: K.ERROR }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={uploading}
              placeholder="Örn. Enfeksiyon Kontrolü Eğitimi"
              style={inputBaseStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Category */}
          <div>
            <label style={labelStyle}>
              Kategori <span style={{ color: K.ERROR }}>*</span>
            </label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              disabled={uploading}
              style={{ ...inputBaseStyle, fontWeight: 500 }}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            >
              <option value="">Kategori seçin...</option>
              {Object.entries(CONTENT_LIBRARY_CATEGORIES).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>
              Açıklama <span style={{ color: K.TEXT_MUTED, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(opsiyonel)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={uploading}
              rows={2}
              style={{ ...inputBaseStyle, resize: 'none' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
              onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Advanced */}
          <details>
            <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: K.TEXT_SECONDARY, padding: '6px 0' }}>
              Gelişmiş seçenekler (opsiyonel)
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <label style={labelStyle}>Zorluk</label>
                <select
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  disabled={uploading}
                  style={{ ...inputBaseStyle, fontWeight: 500 }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
                >
                  {Object.entries(CONTENT_LIBRARY_DIFFICULTY).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Hedef Roller</label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_LIBRARY_TARGET_ROLES.map(r => {
                    const active = targetRoles.includes(r.value)
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => toggleRole(r.value)}
                        disabled={uploading}
                        style={{
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: active ? '#fff' : K.TEXT_SECONDARY,
                          background: active ? K.PRIMARY : K.SURFACE,
                          border: `1.5px solid ${active ? K.PRIMARY : K.BORDER}`,
                          borderRadius: 999,
                          cursor: uploading ? 'not-allowed' : 'pointer',
                          opacity: uploading ? 0.5 : 1,
                        }}
                      >
                        {r.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>SMG Puanı</label>
                <input
                  type="number"
                  min={0}
                  value={smgPoints}
                  onChange={e => setSmgPoints(e.target.value === '' ? '' : Number(e.target.value))}
                  disabled={uploading}
                  placeholder="0"
                  style={inputBaseStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = K.PRIMARY; e.currentTarget.style.boxShadow = `0 0 0 3px ${K.PRIMARY_LIGHT}` }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = K.BORDER; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>
          </details>

          {/* Progress */}
          {Object.keys(progress).length > 0 && (
            <div
              className="space-y-2"
              style={{ background: K.BG, border: `1px solid ${K.BORDER_LIGHT}`, borderRadius: 12, padding: 12 }}
            >
              {Object.values(progress).map(p => {
                const pct = p.total > 0 ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 0
                const pctColor =
                  p.status === 'error' ? K.ERROR
                    : p.status === 'done' ? K.SUCCESS
                      : K.PRIMARY
                return (
                  <div key={p.fileName} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 truncate" style={{ fontSize: 12, color: K.TEXT_PRIMARY }}>
                        {p.status === 'error' && <AlertCircle size={13} style={{ color: K.ERROR, flexShrink: 0 }} />}
                        {p.status === 'done' && <CheckCircle2 size={13} style={{ color: K.SUCCESS, flexShrink: 0 }} />}
                        <span className="truncate">{p.fileName}</span>
                      </span>
                      <span
                        style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: pctColor, fontVariantNumeric: 'tabular-nums' }}
                      >
                        {p.status === 'error' ? 'HATA' : `${pct}%`}
                      </span>
                    </div>
                    <div style={{ height: 4, overflow: 'hidden', borderRadius: 999, background: K.BORDER_LIGHT }}>
                      <div
                        style={{ height: '100%', width: `${pct}%`, background: pctColor, transition: 'width 200ms ease' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2"
          style={{ padding: '16px 24px', borderTop: `1px solid ${K.BORDER_LIGHT}`, background: K.BG, position: 'sticky', bottom: 0 }}
        >
          <button
            onClick={onClose}
            disabled={uploading}
            style={{
              padding: '10px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: K.TEXT_SECONDARY,
              background: K.SURFACE,
              border: `1.5px solid ${K.BORDER}`,
              borderRadius: 10,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.background = K.SURFACE_HOVER }}
            onMouseLeave={(e) => { if (!uploading) e.currentTarget.style.background = K.SURFACE }}
          >
            İptal
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0 || !title.trim() || !category}
            className="flex items-center gap-2"
            style={{
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: K.PRIMARY,
              border: 'none',
              borderRadius: 10,
              cursor: (uploading || selectedFiles.length === 0 || !title.trim() || !category) ? 'not-allowed' : 'pointer',
              opacity: (uploading || selectedFiles.length === 0 || !title.trim() || !category) ? 0.4 : 1,
            }}
            onMouseEnter={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY_HOVER }}
            onMouseLeave={(e) => { if (!e.currentTarget.disabled) e.currentTarget.style.background = K.PRIMARY }}
          >
            <Upload size={14} />
            {uploading ? 'Yükleniyor...' : 'Yükle'}
          </button>
        </div>
      </div>
    </div>
  )
}
