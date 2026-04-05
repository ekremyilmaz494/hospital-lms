'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { UploadedDocument, SourceType } from '../types'
import { MAX_FILE_SIZE, MAX_FILES, ALLOWED_FILE_TYPES, ALLOWED_EXTENSIONS } from '../constants'

interface UseDocumentUploadReturn {
  documents: UploadedDocument[]
  notebookId: string | null
  uploading: boolean
  error: string | null
  uploadFiles: (files: FileList | File[]) => Promise<void>
  addSource: (params: { sourceType: SourceType; url?: string; title?: string; content?: string }) => Promise<void>
  removeDocument: (id: string) => void
  startPollingAll: () => void
  reset: () => void
  allReady: boolean
  hasError: boolean
  processingCount: number
}

export function useDocumentUpload(): UseDocumentUploadReturn {
  const [documents, setDocuments] = useState<UploadedDocument[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notebookId, setNotebookId] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (pollingRef.current) clearInterval(pollingRef.current)
  }, [])

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files)
    setError(null)

    if (documents.length + fileArray.length > MAX_FILES) {
      setError(`En fazla ${MAX_FILES} belge yüklenebilir`)
      return
    }

    const validFiles: File[] = []
    const errors: string[] = []

    for (const file of fileArray) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() || '')
      if (!ALLOWED_FILE_TYPES.includes(file.type as typeof ALLOWED_FILE_TYPES[number])) {
        errors.push(`${file.name}: Desteklenmeyen dosya türü`)
      } else if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
        errors.push(`${file.name}: Desteklenmeyen uzantı`)
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Dosya boyutu 20MB limitini aşıyor`)
      } else {
        validFiles.push(file)
      }
    }

    if (errors.length > 0) {
      setError(errors.join('. '))
    }

    if (validFiles.length === 0) return

    setUploading(true)
    let currentNotebookId = notebookId

    try {
      for (const file of validFiles) {
        const formData = new FormData()
        formData.append('file', file)
        if (currentNotebookId) {
          formData.append('notebookId', currentNotebookId)
        }

        const res = await fetch('/api/admin/ai-content-studio/documents', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.error || `${file.name} yüklenemedi`)
        }

        const data = await res.json()
        const source: UploadedDocument = {
          id: data.source.id,
          notebookId: data.source.notebookId,
          sourceLmId: data.source.sourceLmId || null,
          fileName: data.source.fileName,
          fileType: file.name.split('.').pop()?.toLowerCase() || '',
          fileSize: data.source.fileSize,
          sourceType: 'file',
          sourceUrl: null,
          status: data.source.status,
          summary: null,
          keyTopics: null,
          createdAt: new Date().toISOString(),
        }

        if (!currentNotebookId) {
          currentNotebookId = data.source.notebookId
          setNotebookId(currentNotebookId)
        }

        setDocuments(prev => [...prev, source])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setUploading(false)
    }
  }, [documents.length, notebookId])

  const addSource = useCallback(async (params: {
    sourceType: SourceType
    url?: string
    title?: string
    content?: string
  }) => {
    if (!notebookId) {
      setError('Önce bir belge yükleyin')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const res = await fetch('/api/admin/ai-content-studio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notebookId,
          sourceType: params.sourceType,
          url: params.url,
          textTitle: params.title,
          content: params.content,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Kaynak eklenemedi')
      }

      const data = await res.json()
      const source: UploadedDocument = {
        id: data.source.id,
        notebookId: data.source.notebookId,
        sourceLmId: data.source.sourceLmId || null,
        fileName: data.source.fileName,
        fileType: params.sourceType,
        fileSize: data.source.fileSize,
        sourceType: params.sourceType,
        sourceUrl: params.url || null,
        status: data.source.status,
        summary: null,
        keyTopics: null,
        createdAt: new Date().toISOString(),
      }

      setDocuments(prev => [...prev, source])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setUploading(false)
    }
  }, [notebookId])

  const removeDocument = useCallback((id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id))
  }, [])

  // Polling: processing belgeler için otomatik durum sorgulaması
  // useRef ile stale closure sorununu çözer
  const documentsRef = useRef(documents)
  documentsRef.current = documents

  const startPolling = useCallback(() => {
    if (pollingRef.current) return // Zaten çalışıyor
    pollingRef.current = setInterval(async () => {
      const currentDocs = documentsRef.current
      const processing = currentDocs.filter(d => d.status === 'processing')
      if (processing.length === 0) {
        if (pollingRef.current) clearInterval(pollingRef.current)
        pollingRef.current = null
        return
      }

      for (const doc of processing) {
        try {
          const res = await fetch(`/api/admin/ai-content-studio/documents/${doc.id}`)
          if (!res.ok) continue
          const data = await res.json()

          setDocuments(prev => prev.map(d =>
            d.id === doc.id
              ? { ...d, status: data.status, summary: data.summary || d.summary, keyTopics: data.keyTopics || d.keyTopics }
              : d,
          ))
        } catch {
          // Sessizce devam et
        }
      }
    }, 3000)
  }, [])

  // processing belge olduğunda polling otomatik başlar
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing')
    if (hasProcessing) {
      startPolling()
    }
  }, [documents, startPolling])

  const reset = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    pollingRef.current = null
    setDocuments([])
    setNotebookId(null)
    setError(null)
  }, [])

  return {
    documents,
    notebookId,
    uploading,
    error,
    uploadFiles,
    addSource,
    removeDocument,
    startPollingAll: startPolling,
    reset,
    allReady: documents.length > 0 && documents.every(d => d.status === 'ready'),
    hasError: documents.some(d => d.status === 'error'),
    processingCount: documents.filter(d => d.status === 'processing').length,
  }
}
