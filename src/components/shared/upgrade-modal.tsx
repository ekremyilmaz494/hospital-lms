'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { LockKeyholeIcon, SparklesIcon } from 'lucide-react'

interface UpgradeModalProps {
  /** Modal acik mi */
  open: boolean
  /** Modal kapatildiginda cagrilir */
  onOpenChange: (open: boolean) => void
  /** Gosterilecek ozellik adi (opsiyonel) */
  featureLabel?: string
}

/**
 * Plan yukseltme modali.
 * Kullanicinin mevcut planinda bulunmayan bir ozelligi kullanmaya calistiginda gosterilir.
 */
export function UpgradeModal({ open, onOpenChange, featureLabel }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{
              background: 'var(--color-warning-light, #fef3c7)',
            }}
          >
            <LockKeyholeIcon
              className="h-7 w-7"
              style={{ color: 'var(--color-warning, #f59e0b)' }}
            />
          </div>
          <DialogTitle className="text-center text-lg">
            {featureLabel
              ? `"${featureLabel}" ozelligine erisin`
              : 'Bu ozellik mevcut planinizda bulunmuyor'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {featureLabel
              ? `${featureLabel} ozelligini kullanabilmek icin planinizi yukseltmeniz gerekmektedir.`
              : 'Bu ozellige erisebilmek icin planinizi yukseltmeniz gerekmektedir.'}
          </DialogDescription>
        </DialogHeader>

        <div
          className="rounded-xl p-4 text-sm"
          style={{
            background: 'var(--color-muted, #f1f5f9)',
            color: 'var(--color-text-secondary, #64748b)',
          }}
        >
          <p className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Ust plan avantajlari:
          </p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-primary, #0d9668)' }} />
              Yapay zeka destekli icerik olusturma
            </li>
            <li className="flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-primary, #0d9668)' }} />
              Gelismis raporlama ve analitik
            </li>
            <li className="flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-primary, #0d9668)' }} />
              HIS entegrasyonu ve SSO destegi
            </li>
            <li className="flex items-center gap-2">
              <SparklesIcon className="h-4 w-4 shrink-0" style={{ color: 'var(--color-primary, #0d9668)' }} />
              Ozel sertifika tasarimi
            </li>
          </ul>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full"
            onClick={() => {
              // Fiyatlandirma sayfasina yonlendir
              window.location.href = '/admin/settings/subscription'
            }}
          >
            Planinizi Yukseltin
          </Button>
          <DialogClose
            render={
              <Button variant="ghost" className="w-full" />
            }
          >
            Simdilik Kapat
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
