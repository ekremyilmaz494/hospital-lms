import Link from 'next/link'
import { ArrowLeft, Shield, Database, Share2, Clock, UserCheck, Mail } from 'lucide-react'
import { BlurFade } from '@/components/ui/blur-fade'

export const metadata = {
  title: 'KVKK Aydınlatma Metni — Hastane LMS',
  description: 'Kişisel Verilerin Korunması Kanunu kapsamında aydınlatma metni',
}

const sections = [
  {
    icon: Shield,
    title: '1. Veri Sorumlusu',
    content:
      'Hastane LMS Platformu olarak, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında veri sorumlusu sıfatıyla kişisel verilerinizi aşağıda açıklanan amaçlar doğrultusunda ve kanuna uygun olarak işlemekteyiz.',
  },
  {
    icon: Database,
    title: '2. Kişisel Verilerin İşlenme Amacı',
    content:
      'Kişisel verileriniz; personel eğitim süreçlerinin yönetilmesi, sınav ve değerlendirme faaliyetlerinin gerçekleştirilmesi, eğitim performansının raporlanması, yasal yükümlülüklerin yerine getirilmesi, sertifika düzenlenmesi, bilgi güvenliği süreçlerinin yürütülmesi ve iletişim faaliyetlerinin yönetilmesi amaçlarıyla işlenmektedir.',
  },
  {
    icon: UserCheck,
    title: '3. İşlenen Kişisel Veriler',
    items: [
      'Ad ve Soyad',
      'E-posta adresi',
      'TC Kimlik Numarası',
      'Departman bilgisi',
      'Sınav sonuçları ve başarı durumu',
      'Video izleme kayıtları ve ilerleme bilgileri',
      'Oturum açma zaman damgaları',
    ],
  },
  {
    icon: Share2,
    title: '4. Verilerin Aktarılması',
    content:
      'Kişisel verileriniz, hizmetin sunulabilmesi için aşağıdaki üçüncü taraf hizmet sağlayıcılarla paylaşılabilir:',
    items: [
      'Supabase (Avrupa Birliği) — Kimlik doğrulama ve veritabanı hizmetleri',
      'Amazon Web Services S3 (Avrupa Birliği) — Video depolama ve içerik dağıtımı',
    ],
    footer:
      'Verileriniz yurt dışına aktarılırken KVKK\'nın 9. maddesi kapsamında gerekli önlemler alınmaktadır.',
  },
  {
    icon: Clock,
    title: '5. Veri Saklama Süresi',
    content:
      'Kişisel verileriniz, aktif üyeliğiniz süresince ve üyeliğinizin sona ermesinden itibaren 2 (iki) yıl boyunca saklanmaktadır. Yasal zorunluluklar saklı kalmak kaydıyla, bu sürenin sonunda verileriniz silinir veya anonim hale getirilir.',
  },
  {
    icon: UserCheck,
    title: '6. Veri Sahibinin Hakları',
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
    title: '7. İletişim',
    content:
      'KVKK kapsamındaki haklarınızı kullanmak için aşağıdaki kanallardan bizimle iletişime geçebilirsiniz. Başvurularınız en geç 30 (otuz) gün içinde sonuçlandırılacaktır.',
    footer: 'E-posta: kvkk@hastanelms.com',
  },
]

export default function KVKKPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-30 border-b"
        style={{
          background: 'color-mix(in srgb, var(--color-bg) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link
            href="/auth/login"
            className="flex items-center gap-2 text-sm font-semibold transition-colors duration-150"
            style={{ color: 'var(--color-primary)' }}
          >
            <ArrowLeft className="h-4 w-4" />
            Giriş Sayfasına Dön
          </Link>
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold font-heading"
              style={{ background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)', color: 'var(--color-primary)' }}
            >
              H
            </div>
            <span className="text-sm font-semibold font-heading">Hastane LMS</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-6 py-12">
        <BlurFade delay={0.1}>
          <div className="mb-10">
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
              style={{
                background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                color: 'var(--color-primary)',
              }}
            >
              <Shield className="h-3.5 w-3.5" />
              6698 Sayılı Kanun
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              KVKK Aydınlatma Metni
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              Kişisel Verilerin Korunması Kanunu kapsamında veri işleme faaliyetlerimize ilişkin aydınlatma metni.
            </p>
          </div>
        </BlurFade>

        <div className="space-y-8">
          {sections.map((section, i) => (
            <BlurFade key={section.title} delay={0.15 + i * 0.05}>
              <section
                className="rounded-2xl p-6"
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{
                      background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                    }}
                  >
                    <section.icon className="h-4.5 w-4.5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <h2 className="text-lg font-bold tracking-tight">{section.title}</h2>
                </div>

                {section.content && (
                  <p
                    className="text-sm leading-relaxed mb-3"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {section.content}
                  </p>
                )}

                {section.items && (
                  <ul className="space-y-2 ml-1">
                    {section.items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        <span
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: 'var(--color-primary)' }}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}

                {section.footer && (
                  <p
                    className="mt-4 text-sm font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
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
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Son güncelleme: Mart 2026 &middot; &copy; 2026 Hastane LMS Platformu
            </p>
          </div>
        </BlurFade>
      </main>
    </div>
  )
}
