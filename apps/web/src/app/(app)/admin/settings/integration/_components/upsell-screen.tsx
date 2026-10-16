'use client';

import { ChevronRight, LockKeyhole, CheckCircle2, Mail } from 'lucide-react';
import { BlurFade } from '@/components/ui/blur-fade';

const CONTACT_EMAIL = 'ekremyilmaz@klinovax.info';

const BENEFITS = [
  'Personel listesi İK/HBYS sisteminizle otomatik senkronize edilir',
  'Push, gecelik dosya veya API üzerinden çekme (pull) kanalları',
  'Ayrılan personel otomatik pasifleştirilir, yeni personel otomatik eklenir',
  'Her senkron koşusu satır satır izlenebilir ve denetlenebilir',
];

/** Feature gate ekranı — plan bu özelliği içermiyorsa gösterilir (API 403). */
export function UpsellScreen() {
  return (
    <div className="k-page">
      <BlurFade delay={0}>
        <header className="k-page-header">
          <div>
            <div className="k-breadcrumb">
              <span>Panel</span>
              <ChevronRight size={12} />
              <span>Ayarlar</span>
              <ChevronRight size={12} />
              <span data-current="true">Entegrasyon</span>
            </div>
            <h1 className="k-page-title">İK / HBYS Entegrasyonu</h1>
            <p className="k-page-subtitle">Personel verilerinizi İK veya HBYS sisteminizle otomatik senkronize edin.</p>
          </div>
        </header>
      </BlurFade>

      <BlurFade delay={0.05}>
        <div
          className="mx-auto w-full max-w-xl rounded-2xl border p-10 text-center"
          style={{
            background: 'var(--k-surface)',
            borderColor: 'var(--k-border)',
            boxShadow: 'var(--k-shadow-sm)',
          }}
        >
          <div
            className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--k-warning-bg)' }}
          >
            <LockKeyhole className="h-7 w-7" style={{ color: 'var(--k-warning)' }} />
          </div>

          <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display, system-ui)', color: 'var(--k-text-primary)' }}>
            Bu özellik planınızda bulunmuyor
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed" style={{ color: 'var(--k-text-secondary)' }}>
            Personel entegrasyonu (İK/HBYS senkronizasyonu) mevcut planınızda etkin değil.
            Etkinleştirmek için bizimle iletişime geçin.
          </p>

          <ul className="mx-auto mt-6 max-w-md space-y-2.5 text-left">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-[13px]" style={{ color: 'var(--k-text-secondary)' }}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--k-primary)' }} />
                {b}
              </li>
            ))}
          </ul>

          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Personel Entegrasyonu — Plan Yükseltme')}`}
            className="k-btn k-btn-primary mt-8 inline-flex"
          >
            <Mail className="h-4 w-4" />
            İletişime Geç
          </a>
          <p className="mt-3 text-[12px]" style={{ color: 'var(--k-text-muted)' }}>
            {CONTACT_EMAIL}
          </p>
        </div>
      </BlurFade>
    </div>
  );
}
