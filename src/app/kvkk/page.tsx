import Link from 'next/link'
import { ArrowLeft, Shield, Database, Share2, Clock, UserCheck, Mail, Scale } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'

export const metadata = {
  title: 'KVKK Aydınlatma Metni — Devakent Hastanesi',
  description: 'Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni',
}

const sections = [
  {
    icon: Shield,
    title: '1. Veri Sorumlusu',
    content:
      'Devakent Hastanesi Platformu olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla kişisel verilerinizi aşağıda açıklanan amaçlar doğrultusunda ve kanuna uygun olarak işlemekteyiz.',
  },
  {
    icon: Database,
    title: '2. Kişisel Verilerin İşlenme Amacı',
    content:
      'Kişisel verileriniz; personel eğitim süreçlerinin yönetilmesi, sınav ve değerlendirme faaliyetlerinin gerçekleştirilmesi, eğitim performansının raporlanması, yasal yükümlülüklerin yerine getirilmesi, sertifika düzenlenmesi, bilgi güvenliği süreçlerinin yürütülmesi ve iletişim faaliyetlerinin yönetilmesi amaçlarıyla işlenmektedir.',
  },
  {
    icon: Scale,
    title: '3. İşlemenin Hukuki Sebepleri',
    content: 'Kişisel verileriniz aşağıdaki hukuki sebeplere dayanılarak işlenmektedir (KVKK md. 5/2):',
    items: [
      'md. 5/2-c — Sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması (iş akdi gereği eğitim kayıtlarının tutulması)',
      'md. 5/2-ç — Veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi (Sağlık Bakanlığı zorunlu eğitim gereksinimleri)',
      'md. 5/2-f — Veri sorumlusunun meşru menfaatleri için zorunlu olması (platform güvenliği, sistem yönetimi)',
    ],
  },
  {
    icon: UserCheck,
    title: '4. İşlenen Kişisel Veriler',
    items: [
      'Ad ve Soyad',
      'E-posta adresi',
      'Departman ve unvan bilgisi',
      'Sınav sonuçları ve başarı durumu',
      'Video izleme kayıtları ve ilerleme bilgileri',
      'Oturum açma zaman damgaları ve IP adresi (audit log)',
    ],
  },
  {
    icon: Share2,
    title: '5. Verilerin Aktarılması',
    content:
      'Kişisel verileriniz, hizmetin sunulabilmesi için aşağıdaki üçüncü taraf hizmet sağlayıcılarla paylaşılabilir:',
    items: [
      'Supabase (Avrupa Birliği) — Kimlik doğrulama ve veritabanı hizmetleri',
      'Amazon Web Services S3 (Avrupa Birliği) — Video depolama ve içerik dağıtımı',
      'Vercel Inc. (Avrupa Birliği) — Uygulama hosting ve CDN hizmetleri',
    ],
    footer:
      'Verileriniz yurt dışına aktarılırken KVKK\'nın 9. maddesi kapsamında gerekli güvenceler sağlanmaktadır.',
  },
  {
    icon: Clock,
    title: '6. Veri Saklama Süresi',
    content: 'Kişisel verileriniz aşağıdaki süreler boyunca saklanır:',
    items: [
      'Kimlik ve iletişim bilgileri (ad, e-posta): İş akdi sona ermesinden itibaren 10 yıl (BK md. 146)',
      'Video izleme kayıtları ve sertifikalar: 5 yıl',
      'IP adresi ve audit loglar: 2 yıl',
    ],
    footer:
      'Saklama süresinin dolması veya işleme amacının ortadan kalkması halinde veriler silinir ya da anonim hale getirilir.',
  },
  {
    icon: UserCheck,
    title: '7. Veri Sahibinin Hakları',
    content: 'KVKK\'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:',
    items: [
      'Kişisel verilerinizin işlenip işlenmediğini öğrenme',
      'Kişisel verileriniz işlenmişse buna ilişkin bilgi talep etme',
      'Kişisel verilerinizin işlenme amacını ve bunların amacına uygun kullanılıp kullanılmadığını öğrenme',
      'Yurt içinde veya yurt dışında kişisel verilerinizin aktarıldığı üçüncü kişileri bilme',
      'Kişisel verilerinizin eksik veya yanlış işlenmiş olması hâlinde bunların düzeltilmesini isteme',
      'KVKK\'nın 7. maddesi kapsamında kişisel verilerinizin silinmesini veya yok edilmesini isteme',
      'İşlenen verilerin münhasıran otomatik sistemler vasıtasıyla analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme',
    ],
  },
  {
    icon: Mail,
    title: '8. İletişim',
    content:
      'KVKK kapsamındaki haklarınızı kullanmak için aşağıdaki kanallardan bizimle iletişime geçebilirsiniz. Başvurularınız en geç 30 (otuz) gün içinde sonuçlandırılacaktır.',
    footer: 'E-posta: kvkk@hastanelms.com',
  },
]

export default function KVKKPage() {
  return (
    <div className="min-h-screen" style={{ background: '#f5f0e6' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: 'rgba(245, 240, 230, 0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderColor: 'rgba(26, 58, 40, 0.08)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold transition-colors duration-150"
            style={{ color: '#0d9668' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Giriş Sayfasına Dön
          </Link>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #0d9668, #1a3a28)' }}
            >
              D
            </div>
            <span className="text-sm font-semibold" style={{ color: '#1a3a28' }}>Devakent Hastanesi</span>
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
                color: '#0d9668',
              }}
            >
              <Shield className="h-3.5 w-3.5" />
              6698 Sayılı Kanun
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3" style={{ color: '#1a3a28' }}>
              KVKK Aydınlatma Metni
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: '#4a7060' }}>
              Kişisel Verilerin Korunması Kanunu kapsamında veri işleme faaliyetlerimize ilişkin aydınlatma metni.
            </p>
          </div>
        </BlurFade>

        <div className="space-y-8">
          {sections.map((section, i) => (
            <BlurFade key={section.title} delay={0.15 + i * 0.05}>
              <section
                className="rounded-2xl p-5 sm:p-6 bg-white"
                style={{
                  border: '1px solid rgba(26, 58, 40, 0.08)',
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: 'rgba(13, 150, 104, 0.1)',
                    }}
                  >
                    <section.icon className="h-4.5 w-4.5" style={{ color: '#0d9668' }} />
                  </div>
                  <h2 className="text-lg font-bold tracking-tight" style={{ color: '#1a3a28' }}>{section.title}</h2>
                </div>

                {section.content && (
                  <p
                    className="text-sm leading-relaxed mb-3"
                    style={{ color: '#4a7060' }}
                  >
                    {section.content}
                  </p>
                )}

                {section.items && (
                  <ul className="space-y-2 ml-1">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: '#4a7060' }}>
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: '#0d9668' }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {section.footer && (
                  <p
                    className="mt-4 text-sm font-medium"
                    style={{ color: '#1a3a28' }}
                  >
                    {section.footer}
                  </p>
                )}
              </section>
            </BlurFade>
          ))}
        </div>

        <BlurFade delay={0.6}>
          <div className="mt-12 text-center">
            <p className="text-xs" style={{ color: '#4a7060' }}>
              Son güncelleme: Mart 2026 &middot; &copy; 2026 Devakent Hastanesi Platformu
            </p>
          </div>
        </BlurFade>
      </main>
    </div>
  )
}
