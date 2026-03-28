'use client';

import { ArrowLeft, BookOpen, Mail, Phone, Video, FileText, Award, Shield, GraduationCap, Play, ClipboardCheck, CheckCircle2, Lock, Eye, Building2, Headphones } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';

const trainingSteps = [
  { step: '01', title: 'Eğitim Atanır', desc: 'Admin tarafından personele eğitim atanır ve bildirim gönderilir', icon: GraduationCap },
  { step: '02', title: 'Ön Sınav', desc: 'Mevcut bilgi seviyenizi ölçen ön değerlendirme sınavı', icon: ClipboardCheck },
  { step: '03', title: 'Video Eğitim', desc: 'Eğitim videolarını sırasıyla izleyin — ileri sarma devre dışı', icon: Play },
  { step: '04', title: 'Son Sınav', desc: 'Öğrenme düzeyinizi ölçen final sınavı ve sertifika', icon: Award },
];

const sections = [
  {
    icon: FileText,
    title: 'Sınav Kuralları',
    accent: 'var(--color-info)',
    accentBg: 'rgba(59, 130, 246, 0.08)',
    items: [
      { label: 'Tam ekran modunda açılır', detail: 'Dikkat dağınıklığını önler' },
      { label: 'Varsayılan başarı notu %70', detail: 'Eğitim bazında değişkenlik gösterir' },
      { label: 'Deneme hakkı sınırlıdır', detail: 'Admin tarafından belirlenen hak kadar tekrar edilebilir' },
      { label: 'Cevaplar otomatik kaydedilir', detail: 'Sayfadan çıksanız bile kaldığınız yerden devam edersiniz' },
    ],
  },
  {
    icon: Award,
    title: 'Sertifikalar',
    accent: 'var(--color-accent)',
    accentBg: 'rgba(245, 158, 11, 0.08)',
    items: [
      { label: 'Otomatik oluşturulur', detail: 'Başarılı eğitimler için anında sertifika' },
      { label: 'PDF olarak indirilebilir', detail: 'Resmi belge formatında çıktı alın' },
      { label: 'Benzersiz doğrulama kodu', detail: 'Her sertifika doğrulanabilir bir koda sahiptir' },
    ],
  },
  {
    icon: Shield,
    title: 'Güvenlik & Gizlilik',
    accent: 'var(--color-success)',
    accentBg: 'rgba(13, 150, 104, 0.08)',
    items: [
      { label: 'Otomatik oturum sonlandırma', detail: 'Belirli süre işlem yapılmadığında oturum kapanır' },
      { label: 'Denetim kayıtları', detail: 'Tüm işlemler güvenlik için kaydedilir' },
      { label: 'Kurum izolasyonu', detail: 'Her kurum sadece kendi verilerini görebilir' },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #064e3b 0%, #0d9668 50%, #065f46 100%)',
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative max-w-5xl mx-auto px-6 pt-8 pb-16 md:px-10 md:pt-10 md:pb-20">
          <BlurFade delay={0}>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 mb-8 text-white/70 hover:text-white hover:bg-white/10"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              Geri Dön
            </Button>
          </BlurFade>

          <BlurFade delay={0.05}>
            <div className="flex items-start gap-5">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <BookOpen className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1
                  className="text-3xl md:text-4xl font-extrabold text-white tracking-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Yardım & Destek
                </h1>
                <p className="mt-2 text-base text-white/60 max-w-lg leading-relaxed">
                  Hastane LMS platformunu verimli kullanmanız için ihtiyacınız olan tüm bilgiler
                </p>
              </div>
            </div>
          </BlurFade>
        </div>

        {/* Curved bottom edge */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" fill="none" className="w-full" preserveAspectRatio="none" style={{ display: 'block' }}>
            <path d="M0 48h1440V24C1200 0 240 0 0 24v24z" fill="var(--color-bg)" />
          </svg>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 md:px-10 -mt-2">

        {/* Training Flow — Visual Journey */}
        <BlurFade delay={0.1}>
          <div
            className="rounded-2xl border p-8 md:p-10 mb-8"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
            }}
          >
            <div className="flex items-center gap-3 mb-8">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: 'rgba(13, 150, 104, 0.1)' }}
              >
                <Video className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                  Eğitim Akışı
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Her eğitim 4 aşamadan oluşur
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-0">
              {trainingSteps.map((s, i) => {
                const StepIcon = s.icon;
                return (
                  <div key={s.step} className="relative flex md:flex-col items-start md:items-center gap-4 md:gap-0">
                    {/* Connector line (between steps) */}
                    {i < trainingSteps.length - 1 && (
                      <div
                        className="hidden md:block absolute top-5 left-[calc(50%+28px)] right-[calc(-50%+28px)] h-px"
                        style={{ background: 'linear-gradient(90deg, var(--color-primary), var(--color-border))' }}
                      />
                    )}

                    {/* Step number circle */}
                    <div className="relative z-10 flex flex-col items-center">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                          boxShadow: '0 2px 8px rgba(13, 150, 104, 0.3)',
                        }}
                      >
                        {s.step}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="md:mt-4 md:text-center md:px-2">
                      <div className="flex md:justify-center mb-1.5">
                        <StepIcon className="h-4 w-4" style={{ color: 'var(--color-primary)' }} />
                      </div>
                      <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                        {s.title}
                      </h3>
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </BlurFade>

        {/* Info Sections — 2 Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">
          {sections.map((section, i) => {
            const SectionIcon = section.icon;
            return (
              <BlurFade key={section.title} delay={0.15 + i * 0.05}>
                <div
                  className="rounded-2xl border p-7 h-full"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: 'var(--color-border)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
                  }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ background: section.accentBg }}
                    >
                      <SectionIcon className="h-5 w-5" style={{ color: section.accent }} />
                    </div>
                    <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                      {section.title}
                    </h2>
                  </div>

                  <div className="space-y-4">
                    {section.items.map((item, j) => (
                      <div key={j} className="flex items-start gap-3">
                        <div
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                          style={{ background: section.accentBg }}
                        >
                          <CheckCircle2 className="h-3 w-3" style={{ color: section.accent }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                            {item.label}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                            {item.detail}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </BlurFade>
            );
          })}
        </div>

        {/* Contact Section — CTA Cards */}
        <BlurFade delay={0.35}>
          <div
            className="rounded-2xl border overflow-hidden mb-10"
            style={{
              background: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
            }}
          >
            <div
              className="px-7 py-5"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)' }}>
                İletişim & Destek
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Teknik destek veya sorularınız için bize ulaşın
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: 'var(--color-border)' }}>
              {[
                { icon: Mail, label: 'E-posta', value: 'destek@hastanelms.com', accent: 'var(--color-info)' },
                { icon: Phone, label: 'Telefon', value: '0850 123 45 67', accent: 'var(--color-success)' },
                { icon: Headphones, label: 'Canlı Destek', value: 'Hafta içi 09:00 - 18:00', accent: 'var(--color-accent)' },
              ].map((contact) => {
                const ContactIcon = contact.icon;
                return (
                  <div key={contact.label} className="flex items-center gap-4 px-7 py-5 group cursor-pointer" style={{ transition: 'background 200ms' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-bg)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: `${contact.accent}10`, transition: 'transform 200ms' }}
                    >
                      <ContactIcon className="h-5 w-5" style={{ color: contact.accent }} />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                        {contact.label}
                      </p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'var(--color-text-primary)' }}>
                        {contact.value}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </BlurFade>
      </div>
    </div>
  );
}
