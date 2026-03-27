'use client';

import { ArrowLeft, BookOpen, Mail, Phone, MessageCircle, Shield, Video, FileText, Award } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';

const sections = [
  {
    icon: Video,
    title: 'Eğitim Sistemi',
    items: [
      'Eğitimler admin tarafından atanır ve personel panelinde görünür',
      'Her eğitim: Ön Sınav → Video İzleme → Son Sınav akışını takip eder',
      'Videolar ileri sarılamaz, tamamlanmadan sonraki aşamaya geçilemez',
      'Sınav süresi dolduğunda cevaplar otomatik gönderilir',
    ],
  },
  {
    icon: FileText,
    title: 'Sınav Kuralları',
    items: [
      'Sınav tam ekran modunda açılır',
      'Başarı notu varsayılan olarak %70\'dir (eğitim bazında değişir)',
      'Başarısız olunursa admin tarafından belirlenen deneme hakkı kadar tekrar edilebilir',
      'Tüm deneme hakları bittiğinde admin yeni hak verebilir',
    ],
  },
  {
    icon: Award,
    title: 'Sertifikalar',
    items: [
      'Başarılı olunan eğitimler için otomatik sertifika oluşturulur',
      'Sertifikalar PDF olarak indirilebilir',
      'Her sertifikanın benzersiz bir doğrulama kodu vardır',
    ],
  },
  {
    icon: Shield,
    title: 'Güvenlik & Gizlilik',
    items: [
      'Oturum belirli süre işlem yapılmadığında otomatik kapanır',
      'Tüm işlemler denetim kayıtlarına kaydedilir',
      'Her kurum sadece kendi verilerini görebilir',
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto">
        <BlurFade delay={0.1}>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 mb-6"
            style={{ color: 'var(--color-text-secondary)' }}
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Geri Dön
          </Button>

          <div className="flex items-center gap-3 mb-8">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: 'var(--color-primary-bg)' }}
            >
              <BookOpen className="h-6 w-6" style={{ color: 'var(--color-primary)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Yardım & Destek</h1>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Hastane LMS kullanım rehberi
              </p>
            </div>
          </div>
        </BlurFade>

        <div className="space-y-6">
          {sections.map((section, i) => (
            <BlurFade key={section.title} delay={0.15 + i * 0.05}>
              <div
                className="rounded-2xl border p-6"
                style={{
                  background: 'var(--color-surface)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <section.icon className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                  <h2 className="text-lg font-bold">{section.title}</h2>
                </div>
                <ul className="space-y-2.5">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--color-primary)' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </BlurFade>
          ))}
        </div>

        <BlurFade delay={0.5}>
          <div
            className="mt-8 rounded-2xl border p-6"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <h2 className="text-lg font-bold mb-4">İletişim</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <Mail className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                destek@hastanelms.com
              </div>
              <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                <Phone className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                0850 123 45 67
              </div>
            </div>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
