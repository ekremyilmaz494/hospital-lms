'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Download, FileText, Files, Award } from 'lucide-react'
import { CertTable } from './cert-table'
import type { Certificate, CertGroup as CertGroupType } from '../_types'
import type { BundleFormat } from '../_hooks/use-cert-pdf'

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
      className="rounded-2xl border overflow-hidden mb-3"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3.5"
        style={{ borderBottom: open ? '1px solid var(--color-border)' : 'none' }}
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
            <ChevronDown className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
          </motion.div>

          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)' }}
          >
            <Award className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold truncate text-[14px]">{group.training.title}</p>
              {group.training.category && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{
                    background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    color: 'var(--color-primary)',
                  }}
                >
                  {group.training.category}
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
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
              background: 'var(--color-bg)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
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
                  className="absolute right-0 top-full mt-1 z-20 rounded-xl border py-1 min-w-[220px]"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                >
                  <button
                    onClick={() => handleDownload('list')}
                    className="flex items-start gap-2.5 w-full px-3 py-2 text-left hover:bg-(--color-bg) transition-colors duration-150"
                  >
                    <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <p className="text-[12px] font-semibold">Özet Liste</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        Tablo formatında tüm sertifikalar
                      </p>
                    </div>
                  </button>
                  <button
                    onClick={() => handleDownload('bundle')}
                    className="flex items-start gap-2.5 w-full px-3 py-2 text-left hover:bg-(--color-bg) transition-colors duration-150"
                  >
                    <Files className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <p className="text-[12px] font-semibold">Sertifika Paketi</p>
                      <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
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
