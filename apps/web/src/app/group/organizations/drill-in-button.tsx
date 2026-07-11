'use client';

import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/shared/toast';

/**
 * Grup yöneticisinin bir hastaneye "girmesi" (drill-in). POST /api/group/act-as ile imzalı
 * bağlam cookie'si + presence cookie set edilir; sonra full reload ile /admin paneline gidilir
 * (middleware presence cookie'yi görüp grup yöneticisini o hastanenin /admin'ine bırakır).
 * TAM KONTROL: acting modda /api/admin yazmaları hedef hastaneye uygulanır (Faz 1.5).
 */
export function GroupDrillInButton({ organizationId, disabled }: { organizationId: string; disabled?: boolean }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const enter = async () => {
    if (busy || disabled) return;
    setBusy(true);
    try {
      const res = await fetch('/api/group/act-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Hastaneye girilemedi');
      // Full reload — middleware presence cookie'yi görür, /admin panelini açar.
      window.location.href = '/admin/dashboard';
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Hata', 'error');
      setBusy(false);
    }
  };

  return (
    <Button
      onClick={enter}
      disabled={busy || disabled}
      size="sm"
      className="gap-1 rounded-lg text-white font-semibold shrink-0 disabled:opacity-40"
      style={{ background: 'var(--color-primary)' }}
    >
      <LogIn className="h-4 w-4" /> {busy ? 'Giriliyor…' : 'Gir'}
    </Button>
  );
}
