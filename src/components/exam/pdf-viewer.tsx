'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// PDF.js worker — public klasöründen yükle (CDN'ye bağımlılık yok)
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PdfViewerProps {
  url: string
  pageCount?: number | null
  onPageChange?: (currentPage: number, totalPages: number) => void
  onComplete?: () => void
}

export function PdfViewer({ url, pageCount: initialPageCount, onPageChange, onComplete }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(initialPageCount ?? 0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.2)
  const [loading, setLoading] = useState(true)
  const completedRef = useRef(false)
  const maxPageReached = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  function onDocumentLoadSuccess({ numPages: total }: { numPages: number }) {
    setNumPages(total)
    setLoading(false)
  }

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > numPages) return
    setCurrentPage(page)
    maxPageReached.current = Math.max(maxPageReached.current, page)
    onPageChange?.(page, numPages)

    // Son sayfaya ulaşıldığında tamamlandı olarak işaretle
    if (page >= numPages && !completedRef.current) {
      completedRef.current = true
      onComplete?.()
    }
  }, [numPages, onPageChange, onComplete])

  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage])
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage])

  const zoomIn = useCallback(() => setScale(s => Math.min(s + 0.2, 2.5)), [])
  const zoomOut = useCallback(() => setScale(s => Math.max(s - 0.2, 0.6)), [])
  const fitWidth = useCallback(() => setScale(1.2), [])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        goToPage(currentPage + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        goToPage(currentPage - 1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, goToPage])

  // Sağ tık engelle (videoyla tutarlı)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const prevent = (e: MouseEvent) => e.preventDefault()
    el.addEventListener('contextmenu', prevent)
    return () => el.removeEventListener('contextmenu', prevent)
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col h-full select-none">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          background: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevPage}
            disabled={currentPage <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-opacity disabled:opacity-30"
            style={{ background: 'var(--color-surface-hover)' }}
          >
            <ChevronLeft className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <span
            className="text-sm font-semibold tabular-nums min-w-[80px] text-center"
            style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text-primary)' }}
          >
            {currentPage} / {numPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage >= numPages}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-opacity disabled:opacity-30"
            style={{ background: 'var(--color-surface-hover)' }}
          >
            <ChevronRight className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--color-surface-hover)' }}
          >
            <ZoomOut className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <span
            className="text-xs font-medium min-w-[40px] text-center"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--color-surface-hover)' }}
          >
            <ZoomIn className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
          <button
            onClick={fitWidth}
            className="flex h-8 w-8 items-center justify-center rounded-lg ml-1"
            style={{ background: 'var(--color-surface-hover)' }}
            title="Genişliğe sığdır"
          >
            <Maximize2 className="h-4 w-4" style={{ color: 'var(--color-text-secondary)' }} />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          <div
            className="h-1.5 w-24 rounded-full overflow-hidden"
            style={{ background: 'var(--color-border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${numPages > 0 ? (currentPage / numPages) * 100 : 0}%`,
                background: currentPage >= numPages ? 'var(--color-success)' : 'var(--color-primary)',
              }}
            />
          </div>
          {currentPage >= numPages && (
            <span className="text-[10px] font-bold" style={{ color: 'var(--color-success)' }}>
              Tamamlandı
            </span>
          )}
        </div>
      </div>

      {/* PDF Content */}
      <div
        className="flex-1 overflow-auto flex justify-center py-4"
        style={{ background: 'var(--color-bg)' }}
      >
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-3">
              <div
                className="h-8 w-8 mx-auto rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
              />
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Doküman yükleniyor...
              </p>
            </div>
          </div>
        )}
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={() => setLoading(false)}
          loading=""
          className="flex flex-col items-center"
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            className="shadow-lg rounded-lg overflow-hidden"
            renderTextLayer
            renderAnnotationLayer
          />
        </Document>
      </div>
    </div>
  )
}
