'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Download, FileText, Files, Award } from 'lucide-react'
import { CertTable } from './cert-table'
import type { Certificate, CertGroup as CertGroupType } from '../_types'
import type { BundleFormat } from '../_hooks/use-cert-pdf'

const K = {
  PRIMARY: '#0d9668', PRIMARY_HOVER: '#087a54', PRIMARY_LIGHT: '#d1fae5',
  SURFACE: '#ffffff', SURFACE_HOVER: '#f5f5f4', BG: '#fafaf9',
  BORDER: '#c9c4be', BORDER_LIGHT: '#e7e5e4',
  TEXT_PRIMARY: '#1c1917', TEXT_SECONDARY: '#44403c', TEXT_MUTED: '#78716c',
  SUCCESS: '#10b981', SUCCESS_BG: '#d1fae5',
  WARNING: '#f59e0b', WARNING_BG: '#fef3c7',
  ERROR: '#ef4444', ERROR_BG: '#fee2e2',
  INFO: '#3b82f6', INFO_BG: '#dbeafe',
  ACCENT: '#a855f7',
  SHADOW_CARD: '0 2px 4px rgba(15, 23, 42, 0.05), 0 8px 24px rgba(15, 23, 42, 0.04)',
  FONT_DISPLAY: 'var(--font-display, system-ui)',
}

interface Props {
  group: CertGroupType
  defaultOpen?: boolean
  onSelectCert: (cert: Certificate) => void
  onDownload: (trainingId: string, format: BundleFormat) => void
  isDownloading: (key: string) => boolean
}

export function CertGroup({ group, defaultOpen = false, onSelectCert, onDownload, isDownloading }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const [menuOpen, setMenuOpen] = useState(false)

  const listPending = isDownloading(`group:${group.training.id}:list`)
  const bundlePending = isDownloading(`group:${group.training.id}:bundle`)
  const anyPending = listPending || bundlePending

  const handleDownload = (format: BundleFormat) => {
    setMenuOpen(false)
    onDownload(group.training.id, format)
  }

  return (
    <div
      className={`relative mb-3 ${menuOpen ? 'z-40' : 'z-0'}`}
      style={{
        background: K.SURFACE,
        border: `1.5px solid ${K.BORDER}`,
        borderRadius: 14,
        boxShadow: K.SHADOW_CARD,
      }}
    >
      <div
        className="relative z-20 flex items-center gap-3 px-5 py-3.5"
        style={{ borderBottom: open ? `1px solid ${K.BORDER_LIGHT}` : 'none' }}
      >
        <button
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          aria-controls={`group-${group.training.id}-content`}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <motion.div
            animate={{ rotate: open ? 0 : -90 }}
            transition={{ duration: 0.15 }}
            className="flex-shrink-0"
          >
            <ChevronDown className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />
          </motion.div>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: K.PRIMARY_LIGHT }}
          >
            <Award className="h-4 w-4" style={{ color: K.PRIMARY }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p
                className="truncate"
                style={{ fontSize: 18, fontWeight: 700, fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}
              >
                {group.training.title}
              </p>
              {group.training.category && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    background: K.PRIMARY_LIGHT,
                    color: K.PRIMARY,
                  }}
                >
                  {group.training.category}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: K.TEXT_MUTED }}>
              {group.certificates.length} sertifika
            </p>
          </div>
        </button>

        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMenuOpen(v => !v)}
            disabled={anyPending}
            aria-label="Grubu indir"
            aria-expanded={menuOpen}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors duration-150 disabled:opacity-60"
            style={{
              background: K.SURFACE,
              color: K.TEXT_SECONDARY,
              border: `1px solid ${K.BORDER}`,
            }}
          >
            {anyPending ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Grubu İndir
            <ChevronDown className="h-3 w-3" />
          </button>

          <AnimatePresence>
            {menuOpen && !anyPending && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 z-20 py-1 min-w-[220px]"
                  style={{
                    background: K.SURFACE,
                    border: `1.5px solid ${K.BORDER}`,
                    borderRadius: 14,
                    boxShadow: K.SHADOW_CARD,
                  }}
                >
                  <button
                    onClick={() => handleDownload('list')}
                    className="flex items-start gap-2.5 w-full px-3 py-2 text-left transition-colors duration-150"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: K.PRIMARY }} />
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: K.TEXT_PRIMARY }}>Özet Liste</p>
                      <p className="text-[10px]" style={{ color: K.TEXT_MUTED }}>
                        Tablo formatında tüm sertifikalar
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDownload('bundle')}
                    className="flex items-start gap-2.5 w-full px-3 py-2 text-left transition-colors duration-150"
                    style={{ background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = K.SURFACE_HOVER }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <Files className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: K.PRIMARY }} />
                    <div>
                      <p className="text-[12px] font-semibold" style={{ color: K.TEXT_PRIMARY }}>Sertifika Paketi</p>
                      <p className="text-[10px]" style={{ color: K.TEXT_MUTED }}>
                        Her sertifika tam A4 tasarımı (dağıtım için)
                      </p>
                    </div>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`group-${group.training.id}-content`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <CertTable
              certificates={group.certificates}
              onSelect={onSelectCert}
              showTrainingColumn={false}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
