'use client'

import { useEffect, useState } from 'react'
import { Pencil, LogOut } from 'lucide-react'

interface ActingState {
  active: boolean
  organizationId?: string
  organizationName?: string
}

/**
 * Grup yöneticisi (esas yönetici) bir hastaneye TAM KONTROL ile girdiğinde (drill-in)
 * /admin panelinin üstünde gösterilen DÜZENLEME banner'ı. Yalnız grup yöneticisine render
 * edilir (admin layout `user.groupOwner` ile gate'ler). Durumu GET /api/group/act-as'tan
 * alır (cookie httpOnly). "Grup paneline dön" drill-in cookie'lerini siler — auth oturumuna
 * DOKUNMAZ. Salt-okunur super-admin banner'ından farklı: burada yazma AÇIKTIR (yeşil ton).
 */
export function GroupActingBanner() {
  const [state, setState] = useState<ActingState | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/group/act-as', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { active: false }))
      .then((d: ActingState) => { if (!cancelled) setState(d) })
      .catch(() => { if (!cancelled) setState({ active: false }) })
    return () => { cancelled = true }
  }, [])

  const handleExit = async () => {
    setExiting(true)
    try {
      await fetch('/api/group/act-as', { method: 'DELETE' })
    } catch {
      /* yoksay — full reload zaten temiz durumla döner */
    }
    window.location.href = '/group/organizations'
  }

  if (!state?.active) return null

  return (
    <div
      className="sticky top-0 z-50 flex items-center justify-between gap-3 px-5 py-2.5"
      style={{ background: 'linear-gradient(90deg, var(--color-primary), #0f766e)', color: 'white' }}
    >
      <div className="flex items-center gap-2.5">
        <Pencil className="h-4 w-4 shrink-0" />
        <p className="text-[13px] font-semibold">
          <strong>{state.organizationName}</strong> hastanesini yönetiyorsunuz
          <span className="ml-2 text-[11px] font-normal opacity-80">(düzenleme · grup yöneticisi)</span>
        </p>
      </div>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-[12px] font-bold transition-opacity duration-150 hover:opacity-80 disabled:opacity-50"
        style={{ background: 'rgba(0,0,0,0.2)' }}
      >
        <LogOut className="h-3.5 w-3.5" />
        Grup paneline dön
      </button>
    </div>
  )
}
