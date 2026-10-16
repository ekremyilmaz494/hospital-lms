'use client';

/**
 * /admin/trainings/new — Tek taslak girişi.
 *
 * POST /api/admin/trainings/draft idempotent: kullanıcının var olan taslağı
 * varsa onun id'si döner, yoksa yeni yaratılır. Bu sayede "Yeni Eğitim"
 * butonuna basmak her zaman kullanıcıyı kaldığı yere getirir; sıfırdan
 * sihirbaza alıp ilerlemeyi kaybettirmez.
 *
 * Birden fazla aktif taslak izinli değil — backend single-draft kuralını
 * zorlar, frontend'in ek bir kontrol yapmasına gerek yok.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/shared/toast';
import { Loader2 } from 'lucide-react';

export default function NewTrainingRedirectPage() {
  const router = useRouter();
  const { toast } = useToast();
  const initiated = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initiated.current) return;
    initiated.current = true;

    void (async () => {
      try {
        const res = await fetch('/api/admin/trainings/draft', { method: 'POST' });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Taslak başlatılamadı');
        }
        const { id } = (await res.json()) as { id: string; existing?: boolean };
        router.replace(`/admin/trainings/new/${id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Taslak başlatılamadı';
        setErrorMsg(msg);
        toast(msg, 'error');
      }
    })();
  }, [router, toast]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        {errorMsg ? (
          <>
            <p className="text-sm" style={{ color: 'var(--k-error)' }}>{errorMsg}</p>
            <button
              type="button"
              onClick={() => router.push('/admin/trainings')}
              className="k-btn k-btn-ghost"
            >
              Eğitimler listesine dön
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#0d9668' }} />
            <p className="text-sm" style={{ color: '#78716c' }}>Eğitim sihirbazı hazırlanıyor…</p>
          </>
        )}
      </div>
    </div>
  );
}
