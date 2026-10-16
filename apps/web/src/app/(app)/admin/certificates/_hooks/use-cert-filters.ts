'use client'

import { useMemo } from 'react'
import type {
  Certificate,
  CertGroup,
  FilterState,
  FilterStats,
  TrainingOption,
} from '../_types'

const EXPIRING_SOON_DAYS = 30

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000)
}

function matchesSearch(c: Certificate, q: string): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return (
    c.user.name.toLowerCase().includes(needle) ||
    c.certificateCode.toLowerCase().includes(needle) ||
    c.training.title.toLowerCase().includes(needle) ||
    c.user.email.toLowerCase().includes(needle)
  )
}

function matchesStatus(c: Certificate, status: FilterState['status']): boolean {
  if (status === 'all') return true
  if (status === 'revoked') return c.isRevoked
  if (status === 'expired') return !c.isRevoked && c.isExpired
  if (status === 'active') return !c.isRevoked && !c.isExpired
  if (status === 'expiring') {
    if (c.isRevoked || c.isExpired) return false
    const d = daysUntilExpiry(c.expiresAt)
    return d !== null && d > 0 && d <= EXPIRING_SOON_DAYS
  }
  return true
}

export function useCertFilters(certificates: Certificate[], filters: FilterState, allTrainings: TrainingOption[]) {
  const filtered = useMemo(() => {
    return certificates.filter(c => {
      if (!matchesSearch(c, filters.search)) return false
      if (!matchesStatus(c, filters.status)) return false
      if (filters.trainingId && c.training.id !== filters.trainingId) return false
      if (filters.category && c.training.category !== filters.category) return false
      return true
    })
  }, [certificates, filters])

  const groups = useMemo<CertGroup[]>(() => {
    const map = new Map<string, Certificate[]>()
    for (const cert of filtered) {
      const arr = map.get(cert.training.id)
      if (arr) arr.push(cert)
      else map.set(cert.training.id, [cert])
    }

    const trainingById = new Map(allTrainings.map(t => [t.id, t]))

    const result: CertGroup[] = []
    for (const [trainingId, certs] of map) {
      const training = trainingById.get(trainingId)
      if (!training) continue
      result.push({
        training: { ...training, count: certs.length },
        certificates: certs,
      })
    }
    result.sort((a, b) => a.training.title.localeCompare(b.training.title, 'tr'))
    return result
  }, [filtered, allTrainings])

  const filterStats = useMemo<FilterStats>(() => {
    let active = 0
    let expired = 0
    let revoked = 0
    let expiring = 0
    for (const c of filtered) {
      if (c.isRevoked) revoked++
      else if (c.isExpired) expired++
      else {
        active++
        const d = daysUntilExpiry(c.expiresAt)
        if (d !== null && d > 0 && d <= EXPIRING_SOON_DAYS) expiring++
      }
    }
    return { visible: filtered.length, active, expired, revoked, expiring }
  }, [filtered])

  return { filtered, groups, filterStats }
}

export { daysUntilExpiry, EXPIRING_SOON_DAYS }
