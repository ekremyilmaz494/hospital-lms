'use client'

import { useState, useCallback } from 'react'
import type { UploadedDocument } from '../types'
import { MAX_FILE_SIZE, MAX_FILES, ALLOWED_FILE_TYPES } from '../constants'

export function useDocumentUpload() {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    setError(null)

    if (documents.length + fileArray.length > MAX_FILES) {
      setError(`En fazla ${MAX_FILES} belge yüklenebilir.`)
      return
    }

    const ALLOWED_EXTS = ['.pdf', '.docx', '.pptx', '.txt', '.md']
    for (const file of fileArray) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
      if (!ALLOWED_FILE_TYPES.includes(file.type) && !ALLOWED_EXTS.includes(ext)) {
        setError(`${file.name}: Desteklenmeyen dosya türü.`)
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name}: Dosya 20MB'ı geçemez.`)
        return
      }
    }

    setUploading(true)
    try {
      const uploaded: UploadedDocument[] = []
      for (const file of fileArray) {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/admin/ai-content-studio/documents', {
          method: 'POST',
          body: formData,
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Yükleme başarısız.')
        }
        const doc = await res.json()
        uploaded.push(doc)
      }
      setDocuments((prev) => [...prev, ...uploaded])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme hatası.')
    } finally {
      setUploading(false)
    }
  }, [documents.length])

  const removeDocument = useCallback((id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }, [])

  return { documents, uploading, error, uploadFiles, removeDocument }
}
