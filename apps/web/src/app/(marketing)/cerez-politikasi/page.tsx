import type { Metadata } from 'next'
import Link from 'next/link'
import { pageMetadata } from '@/lib/site-metadata'
import { LegalPage, type LegalSection } from '@/components/site/legal-page'

export const metadata: Metadata = pageMetadata({
  title: 'Çerez Politikası',
  description:
    'KlinoVax web sitesinde kullanılan çerezler ve benzeri teknolojiler hakkında bilgilendirme.',
  path: '/cerez-politikasi',
})

const CONTACT_EMAIL = 'ekrem@klinovax.com'

const S = {
  nedir: { id: 'cerez-nedir', label: '1. Çerez Nedir?' },
  turler: { id: 'cerez-turleri', label: '2. Kullandığımız Çerez Türleri' },
  veriler: { id: 'islenen-veriler', label: '3. Çerezlerle İşlenen Veriler' },
  yonetim: { id: 'cerez-yonetimi', label: '4. Çerezlerin Yönetimi' },
  ucuncu: { id: 'ucuncu-taraf-cerezleri', label: '5. Üçüncü Taraf Çerezleri' },
  onay: { id: 'onay-ve-guncelleme', label: '6. Onay ve Güncelleme' },
  iletisim: { id: 'iletisim', label: '7. İletişim' },
} as const satisfies Record<string, LegalSection>

const SECTIONS: readonly LegalSection[] = Object.values(S)

/** Çerez türleri: tür adı kalın, açıklaması alt satırda. */
const COOKIE_TYPES = [
  { name: 'Zorunlu çerezler', text: 'Sitenin temel işlevleri, oturum yönetimi ve güvenlik için gereklidir. Devre dışı bırakılamaz, onay gerektirmez.' },
  { name: 'İşlevsel çerezler', text: 'Dil, tema gibi tercihlerinizin hatırlanmasını sağlar. Açık rızaya tabidir.' },
  { name: 'Performans / Analitik çerezler', text: 'Site kullanımının ölçülmesi ve iyileştirilmesi amacıyla kullanılır. Açık rızaya tabidir.' },
  { name: 'Pazarlama çerezleri', text: 'Kullanıldığı hallerde, ilgi alanınıza yönelik tanıtım amacıyla çalışır. Açık rızaya tabidir.' },
] as const

const BROWSER_SETTINGS = [
  'Chrome: Ayarlar › Gizlilik ve güvenlik › Çerezler ve diğer site verileri',
  'Safari: Tercihler › Gizlilik',
  'Firefox: Ayarlar › Gizlilik ve Güvenlik',
  'Edge: Ayarlar › Çerezler ve site izinleri',
] as const

export default function CerezPolitikasiPage() {
  return (
    <LegalPage breadcrumbPath="/cerez-politikasi"
      title="Çerez Politikası"
      lead="Web sitemizde kullanılan çerezler ve benzeri teknolojiler hakkında bilgilendirme."
      updated="Temmuz 2026"
      sections={SECTIONS}
    >
      <h2 id={S.nedir.id}>{S.nedir.label}</h2>
      <p>
        Çerezler (cookies), ziyaret ettiğiniz web siteleri tarafından tarayıcınıza kaydedilen küçük metin
        dosyalarıdır. Çerezler; sitenin doğru çalışmasını, oturumunuzun güvenli tutulmasını, tercihlerinizin
        hatırlanmasını ve site kullanımının analiz edilerek iyileştirilmesini sağlar.
      </p>

      <h2 id={S.turler.id}>{S.turler.label}</h2>
      <p>Web sitemizde aşağıdaki çerez türleri kullanılabilir:</p>
      <ul>
        {COOKIE_TYPES.map((t) => (
          <li key={t.name}>
            <strong>{t.name}</strong>
            <br />
            {t.text}
          </li>
        ))}
      </ul>

      <h2 id={S.veriler.id}>{S.veriler.label}</h2>
      <p>
        Çerezler aracılığıyla; IP adresi, tarayıcı ve cihaz bilgisi, ziyaret edilen sayfalar ve site
        üzerindeki hareketleriniz gibi veriler işlenebilir. Bu veriler,{' '}
        <Link href="/kvkk">KVKK Aydınlatma Metni</Link>’nde belirtilen esaslara tabidir.
      </p>

      <h2 id={S.yonetim.id}>{S.yonetim.label}</h2>
      <p>
        Zorunlu olmayan çerezler için onayınız, siteye ilk girişte gösterilen çerez bildirimi üzerinden alınır.
        Onayınızı dilediğiniz zaman geri alabilir; ayrıca tarayıcınızın ayarlarından çerezleri silebilir veya
        engelleyebilirsiniz:
      </p>
      <ul>
        {BROWSER_SETTINGS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>Zorunlu çerezleri engellemeniz halinde sitenin bazı işlevleri düzgün çalışmayabilir.</p>

      <h2 id={S.ucuncu.id}>{S.ucuncu.label}</h2>
      <p>
        Site üzerinde analitik veya içerik hizmeti sağlayan üçüncü taraflara ait çerezler bulunabilir. Bu
        tarafların kendi gizlilik ve çerez politikaları geçerlidir; KlinoVax bu çerezlerin içeriğinden sorumlu
        değildir.
      </p>

      <h2 id={S.onay.id}>{S.onay.label}</h2>
      <p>
        KlinoVax, işbu Çerez Politikası’nı güncelleme hakkını saklı tutar. Güncel sürüm web sitesinde
        yayımlandığı tarihte yürürlüğe girer. Kullandığımız çerezlerde değişiklik olması halinde bu sayfa
        güncellenir.
      </p>

      <h2 id={S.iletisim.id}>{S.iletisim.label}</h2>
      <p>
        Çerezler ve kişisel verilerinize ilişkin sorularınız için bizimle iletişime geçebilirsiniz.
        Başvurularınız en geç 30 (otuz) gün içinde sonuçlandırılır.
      </p>
      <p>
        E-posta: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
    </LegalPage>
  )
}
