// ─── Google Bağlantı Test Butonu ───
// NotebookLM'e gerçek istek yaparak bağlantıyı test eder

'use client'

import { useState } from 'react'
import { Zap, Loader2 } from 'lucide-react'
import { useToast } from '@/components/shared/toast'

export function GoogleConnectTest() {
  const { toast } = useToast()
  const [testing, setTesting] = useState(false)

  const handleTest = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/admin/ai-content-studio/auth/test', { method: 'POST' })
      const data = await res.json()

      if (res.ok && data.success) {
        toast(`Bağlantı aktif ✓ (${data.response_time_ms}ms)`, 'success')
      } else {
        toast(data.detail ?? data.error ?? 'Bağlantı kurulamadı.', 'error')
      }
    } catch {
      toast('Sunucuya ulaşılamadı.', 'error')
    } finally {
      setTesting(false)
    }
  }

  return (
    <button
      onClick={handleTest}
      disabled={testing}
      className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-50"
      style={{
        borderColor: 'var(--color-primary)',
        color: 'var(--color-primary)',
        background: 'var(--color-primary-light)',
      }}
    >
      {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
      {testing ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
    </button>
  )
}
