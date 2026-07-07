import Link from 'next/link'
import { ArrowLeft, Cookie, Layers, Database, Settings, Share2, RefreshCw, Mail } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'

export const metadata = {
  title: 'Çerez Politikası — KlinoVax',
  description: 'KlinoVax web sitesinde kullanılan çerezler ve benzeri teknolojiler hakkında bilgilendirme.',
}

// KlinoVax palette (admin chrome tokens) — kvkk sayfasıyla birebir aynı
const INK = '#1c1917'        // --k-text-primary (warm dark)
const INK_SOFT = '#78716c'   // --k-text-muted (warm gray)
const CREAM = '#fafaf9'      // --k-bg (warm gray)
const RULE = '#e7e5e4'       // --k-border (warm gray)
const ACCENT = '#0d9668'     // --k-primary (emerald-600)

const sections = [
  {
    icon: Cookie,
    title: '1. Çerez Nedir?',
    content:
      'Çerezler (cookies), ziyaret ettiğiniz web siteleri tarafından tarayıcınıza kaydedilen küçük metin dosyalarıdır. Çerezler; sitenin doğru çalışmasını, oturumunuzun güvenli tutulmasını, tercihlerinizin hatırlanmasını ve site kullanımının analiz edilerek iyileştirilmesini sağlar.',
  },
  {
    icon: Layers,
    title: '2. Kullandığımız Çerez Türleri',
    content: 'Web sitemizde aşağıdaki çerez türleri kullanılabilir:',
    items: [
      'Zorunlu çerezler — Sitenin temel işlevleri, oturum yönetimi ve güvenlik için gereklidir. Devre dışı bırakılamaz, onay gerektirmez.',
      'İşlevsel çerezler — Dil, tema gibi tercihlerinizin hatırlanmasını sağlar. Açık rızaya tabidir.',
      'Performans / Analitik çerezler — Site kullanımının ölçülmesi ve iyileştirilmesi amacıyla kullanılır. Açık rızaya tabidir.',
      'Pazarlama çerezleri — Kullanıldığı hallerde, ilgi alanınıza yönelik tanıtım amacıyla çalışır. Açık rızaya tabidir.',
    ],
  },
  {
    icon: Database,
    title: '3. Çerezlerle İşlenen Veriler',
    content:
      'Çerezler aracılığıyla; IP adresi, tarayıcı ve cihaz bilgisi, ziyaret edilen sayfalar ve site üzerindeki hareketleriniz gibi veriler işlenebilir. Bu veriler, KVKK Aydınlatma Metni’nde belirtilen esaslara tabidir.',
  },
  {
    icon: Settings,
    title: '4. Çerezlerin Yönetimi',
    content:
      'Zorunlu olmayan çerezler için onayınız, siteye ilk girişte gösterilen çerez bildirimi üzerinden alınır. Onayınızı dilediğiniz zaman geri alabilir; ayrıca tarayıcınızın ayarlarından çerezleri silebilir veya engelleyebilirsiniz:',
    items: [
      'Chrome: Ayarlar › Gizlilik ve güvenlik › Çerezler ve diğer site verileri',
      'Safari: Tercihler › Gizlilik',
      'Firefox: Ayarlar › Gizlilik ve Güvenlik',
      'Edge: Ayarlar › Çerezler ve site izinleri',
    ],
    footer:
      'Zorunlu çerezleri engellemeniz halinde sitenin bazı işlevleri düzgün çalışmayabilir.',
  },
  {
    icon: Share2,
    title: '5. Üçüncü Taraf Çerezleri',
    content:
      'Site üzerinde analitik veya içerik hizmeti sağlayan üçüncü taraflara ait çerezler bulunabilir. Bu tarafların kendi gizlilik ve çerez politikaları geçerlidir; KlinoVax bu çerezlerin içeriğinden sorumlu değildir.',
  },
  {
    icon: RefreshCw,
    title: '6. Onay ve Güncelleme',
    content:
      'KlinoVax, işbu Çerez Politikası’nı güncelleme hakkını saklı tutar. Güncel sürüm web sitesinde yayımlandığı tarihte yürürlüğe girer. Kullandığımız çerezlerde değişiklik olması halinde bu sayfa güncellenir.',
  },
  {
    icon: Mail,
    title: '7. İletişim',
    content:
      'Çerezler ve kişisel verilerinize ilişkin sorularınız için bizimle iletişime geçebilirsiniz. Başvurularınız en geç 30 (otuz) gün içinde sonuçlandırılır.',
    footer: 'E-posta: kvkk@klinovax.info',
  },
]

export default function CerezPolitikasiPage() {
  return (
    <div className="min-h-screen" style={{ background: CREAM }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: 'rgba(250, 250, 249, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: RULE,
        }}
      >
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold transition-colors duration-150"
            style={{ color: ACCENT }}
          >
            <ArrowLeft className="h-4 w-4" />
            Giriş Sayfasına Dön
          </Link>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                borderRadius: 10,
                boxShadow: '0 6px 18px rgba(16, 185, 129, 0.32), inset 0 1px 0 rgba(255,255,255,0.3)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-editorial), Georgia, serif',
                  fontStyle: 'italic', fontWeight: 700, fontSize: 18,
                  color: '#ffffff', lineHeight: 1, transform: 'translateY(1px)',
                }}
              >
                K
              </span>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-editorial), Georgia, serif',
                fontStyle: 'italic', fontWeight: 500, fontSize: 18,
                color: INK, letterSpacing: '-0.01em',
              }}
            >
              KlinoVax
            </span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-12">
        <BlurFade delay={0.1}>
          <div className="mb-10">
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
              style={{
                background: 'rgba(13, 150, 104, 0.1)',
                color: ACCENT,
                border: `1px solid ${RULE}`,
              }}
            >
              <Cookie className="h-3.5 w-3.5" />
              Çerez Aydınlatması
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3" style={{ color: INK }}>
              Çerez Politikası
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
              Web sitemizde kullanılan çerezler ve benzeri teknolojiler hakkında bilgilendirme.
            </p>
          </div>
        </BlurFade>

        <div className="space-y-8">
          {sections.map((section, i) => (
            <BlurFade key={section.title} delay={0.15 + i * 0.05}>
              <section
                className="rounded-2xl p-5 sm:p-6 bg-white"
                style={{
                  border: `1px solid ${RULE}`,
                  boxShadow: '0 1px 3px rgba(28, 25, 23, 0.04)',
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: 'rgba(13, 150, 104, 0.1)' }}
                  >
                    <section.icon className="h-4.5 w-4.5" style={{ color: ACCENT }} />
                  </div>
                  <h2 className="text-lg font-bold tracking-tight" style={{ color: INK }}>{section.title}</h2>
                </div>

                {section.content && (
                  <p className="text-sm leading-relaxed mb-3" style={{ color: INK_SOFT }}>
                    {section.content}
                  </p>
                )}

                {section.items && (
                  <ul className="space-y-2 ml-1">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: INK_SOFT }}>
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: ACCENT }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {section.footer && (
                  <p className="mt-4 text-sm font-medium" style={{ color: INK }}>
                    {section.footer}
                  </p>
                )}
              </section>
            </BlurFade>
          ))}
        </div>

        <BlurFade delay={0.6}>
          <div className="mt-12 text-center">
            <p className="text-xs" style={{ color: INK_SOFT }}>
              Son güncelleme: Temmuz 2026 &middot; &copy; 2026 KlinoVax
            </p>
          </div>
        </BlurFade>
      </main>
    </div>
  )
}
