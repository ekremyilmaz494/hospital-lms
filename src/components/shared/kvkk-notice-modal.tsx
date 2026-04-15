'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Shield, ExternalLink } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth-store'

/**
 * KVKK Aydınlatma Metni Bildirimi Modalı
 *
 * Kurul 2020/404 uyarınca: bilgilendirme modalı giriş akışını bloklamaz.
 * Kullanıcı isterse "Kapat" diyebilir. "Okudum, Anladım" seçeneği DB'ye kaydeder.
 * Modal, kvkkNoticeAcknowledgedAt null olan oturumlarda bir kez gösterilir.
 */
export function KvkkNoticeModal() {
  const [open, setOpen] = useState(true)
  const [loading, setLoading] = useState(false)
  const { setUserIfChanged } = useAuthStore()

  async function handleAcknowledge() {
    setLoading(true)
    try {
      await fetch('/api/auth/kvkk-acknowledge', { method: 'POST' })
      // Optimistik güncelleme — modal kapanır, yeniden gösterilmez
      setUserIfChanged({ kvkkNoticeAcknowledgedAt: new Date().toISOString() })
    } catch {
      // Sessizce devam et — bilgilendirme zorunlu değil, giriş bloklanmaz
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  function handleClose() {
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <div
            className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: 'rgba(13, 150, 104, 0.1)' }}
          >
            <Shield className="h-5 w-5" style={{ color: '#0d9668' }} />
          </div>
          <DialogTitle className="text-base font-bold" style={{ color: 'var(--color-text-primary)' }}>
            KVKK Aydınlatma Metni
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            6698 sayılı Kişisel Verilerin Korunması Kanunu kapsamında bilgi almak istiyoruz.
          </DialogDescription>
        </DialogHeader>

        <div
          className="rounded-xl p-4 text-sm leading-relaxed space-y-2"
          style={{
            background: 'rgba(13, 150, 104, 0.05)',
            border: '1px solid rgba(13, 150, 104, 0.12)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <p>
            Kişisel verileriniz (ad-soyad, e-posta, departman, eğitim ve sınav kayıtları) yalnızca{' '}
            <strong style={{ color: 'var(--color-text-primary)' }}>personel eğitim süreçlerinin yönetimi</strong>{' '}
            amacıyla işlenmektedir.
          </p>
          <p>
            Verileriniz; Supabase (AB), Amazon Web Services (AB) ve Vercel (AB) altyapıları üzerinde KVKK&apos;nın
            9. maddesi kapsamında güvenli biçimde saklanmaktadır.
          </p>
          <p>
            KVKK&apos;nın 11. maddesi kapsamında verilerinize erişim, düzeltme ve silme haklarına sahipsiniz.
          </p>
        </div>

        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          Ayrıntılı bilgi için{' '}
          <Link
            href="/kvkk"
            target="_blank"
            className="font-semibold underline underline-offset-2 inline-flex items-center gap-0.5 transition-colors duration-150"
            style={{ color: '#0d9668' }}
          >
            KVKK Aydınlatma Metni&apos;ni
            <ExternalLink className="h-3 w-3" />
          </Link>{' '}
          inceleyebilirsiniz.
        </p>

        <DialogFooter className="border-none bg-transparent p-0 -mx-0 -mb-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Kapat
          </Button>
          <Button
            size="sm"
            onClick={handleAcknowledge}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #0d9668, #0a7a55)',
              color: '#fff',
              border: 'none',
            }}
          >
            {loading ? 'Kaydediliyor…' : 'Okudum, Anladım'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
