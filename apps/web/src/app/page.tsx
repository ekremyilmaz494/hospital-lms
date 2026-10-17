import type { Metadata } from 'next';
import { pageMetadata, HOME_LANGUAGES } from '@/lib/site-metadata';
import { organizationJsonLd } from '@/lib/organization-jsonld';
import { SiteShell } from '@/components/site/site-shell';
import { Hero } from '@/components/site/home/hero';
import { Problem } from '@/components/site/home/problem';
import { Flow } from '@/components/site/home/flow';
import { VideoLock } from '@/components/site/home/video-lock';
import { Evidence } from '@/components/site/home/evidence';
import { Automation } from '@/components/site/home/automation';
import { Roles } from '@/components/site/home/roles';
import { Mobile } from '@/components/site/home/mobile';
import { Security } from '@/components/site/home/security';
import { Reference } from '@/components/site/home/reference';
import { Faq } from '@/components/site/home/faq';
import { Closing } from '@/components/site/home/closing';

export const metadata: Metadata = pageMetadata({
  title: 'Hastane Personel Eğitim ve Sınav Platformu | KlinoVax',
  description:
    'Hastane eğitimlerini tek akışta yönetin: atama, ileri sarılamayan video, ön ve son sınav, QR ile doğrulanan sertifika ve denetim raporları.',
  path: '/',
  absoluteTitle: true,
  languages: HOME_LANGUAGES,
});

// Bölüm sırası anlatı sırasıdır: sorun → nasıl çalışır → kanıt → takip → kim için →
// mobil → güvenlik (tek koyu bant) → referans → SSS → kapanış. Tüm metin
// `components/site/content/home.tr.ts`'te; JS kapalıyken de eksiksiz okunur.
export default function LandingPage() {
  return (
    <>
      {/* Statik künye (kullanıcı girdisi yok) — şirket doğrulaması için makine-okunur */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJsonLd('tr') }}
      />
      <SiteShell>
        <Hero />
        <Problem />
        <Flow />
        <VideoLock />
        <Evidence />
        <Automation />
        <Roles />
        <Mobile />
        <Security />
        <Reference />
        <Faq />
        <Closing />
      </SiteShell>
    </>
  );
}
