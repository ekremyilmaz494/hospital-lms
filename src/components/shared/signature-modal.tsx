'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { PenLine, Check, X, RotateCcw } from 'lucide-react'
import { useToast } from '@/components/shared/toast'

interface SignatureModalProps {
  attemptId: string
  onSigned: () => void
  onClose: () => void
}

export function SignatureModal({ attemptId, onSigned, onClose }: SignatureModalProps) {
  const { toast } = useToast()
  const [isTouch, setIsTouch] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Canvas mode state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  // Acknowledge mode state
  const [acknowledged, setAcknowledged] = useState(false)

  // Detect touch device
  useEffect(() => {
    setIsTouch(window.matchMedia('(pointer: coarse)').matches)
  }, [])

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Canvas setup
  useEffect(() => {
    if (!isTouch) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = 'var(--color-text-primary, #0f172a)'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [isTouch])

  const getPos = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    canvas!.setPointerCapture(e.pointerId)
    setIsDrawing(true)
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [getPos])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
    setIsEmpty(false)
  }, [isDrawing, getPos])

  const onPointerUp = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }, [])

  const handleSubmit = async () => {
    let signatureData: string
    let signatureMethod: 'canvas' | 'acknowledge'

    if (isTouch) {
      const canvas = canvasRef.current
      if (!canvas || isEmpty) return
      signatureData = canvas.toDataURL('image/png')
      signatureMethod = 'canvas'
    } else {
      if (!acknowledged) return
      signatureData = 'ACKNOWLEDGED'
      signatureMethod = 'acknowledge'
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/exam/${attemptId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, signatureMethod }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'İmza kaydedilemedi')
      }
      toast('İmza başarıyla kaydedildi', 'success')
      onSigned()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'İmza kaydedilemedi', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = isTouch ? !isEmpty : acknowledged

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: 'var(--color-primary-light)' }}
            >
              <PenLine className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: 'var(--color-text-primary)' }}>Dijital İmza</h3>
              <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {isTouch ? 'Parmağınızla imzanızı çizin' : 'Beyanınızı onaylayın'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ color: 'var(--color-text-muted)', transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {isTouch ? (
            /* ── Canvas Modu ── */
            <div>
              <div
                className="rounded-xl border overflow-hidden"
                style={{ borderColor: 'var(--color-border)', background: '#fff' }}
              >
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={200}
                  className="w-full touch-none"
                  style={{ height: 160, cursor: 'crosshair' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerLeave={onPointerUp}
                />
              </div>
              {isEmpty && (
                <p className="text-center text-[11px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  İmzanızı yukarıdaki alana çizin
                </p>
              )}
              <div className="flex justify-end mt-2">
                <button
                  onClick={clearCanvas}
                  disabled={isEmpty}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                  style={{
                    color: isEmpty ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
                    opacity: isEmpty ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Temizle
                </button>
              </div>
            </div>
          ) : (
            /* ── Beyan Modu ── */
            <div>
              <div
                className="rounded-xl border p-4"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
              >
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  Yukarıda belirtilen eğitimi eksiksiz tamamladığımı, içerikleri
                  anladığımı ve gerekliliklerini yerine getireceğimi beyan ederim.
                </p>
              </div>
              <label className="flex items-start gap-3 mt-4 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded accent-[var(--color-primary)]"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Okudum, onaylıyorum
                </span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ color: 'var(--color-text-secondary)', transition: 'background 0.15s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold text-white"
            style={{
              background: canSubmit && !submitting ? 'var(--color-primary)' : 'var(--color-border)',
              opacity: canSubmit && !submitting ? 1 : 0.6,
              cursor: canSubmit && !submitting ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s, opacity 0.15s',
            }}
          >
            <Check className="h-4 w-4" />
            {submitting ? 'İmzalanıyor...' : 'İmzala'}
          </button>
        </div>
      </div>
    </div>
  )
}
