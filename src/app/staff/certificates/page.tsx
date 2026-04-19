'use client';

import { useState } from 'react';
import {
  Award, Download, CheckCircle2, AlertTriangle, Copy, Eye, X, Archive,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface Certificate {
  id: string;
  certificateCode: string;
  issuedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  training: { title: string; category: string; isArchived?: boolean };
  score: number;
  attemptNumber: number;
  user?: { firstName?: string; lastName?: string; organization?: { name?: string } };
}

/** Gold medal seal SVG */
function GoldSeal() {
  const points = 16;
  const outerR = 26;
  const innerR = 20;
  let d = '';
  for (let i = 0; i < points; i++) {
    const a1 = (i * 2 * Math.PI) / points;
    const a2 = ((i + 0.5) * 2 * Math.PI) / points;
    const a3 = ((i + 1) * 2 * Math.PI) / points;
    const cmd = i === 0 ? 'M' : 'L';
    d += `${cmd}${30 + outerR * Math.cos(a1)},${30 + outerR * Math.sin(a1)} `;
    d += `L${30 + innerR * Math.cos(a2)},${30 + innerR * Math.sin(a2)} `;
    if (i === points - 1) d += `L${30 + outerR * Math.cos(a3)},${30 + outerR * Math.sin(a3)} Z`;
  }
  return (
    <svg viewBox="0 0 60 60" className="h-12 w-12">
      <path d={d} fill="#c9a961" />
      <circle cx="30" cy="30" r="17" fill="#a5823c" />
      <circle cx="30" cy="30" r="14" fill="#c9a961" />
      <circle cx="30" cy="30" r="11" fill="#a5823c" />
      <polygon
        points="30,20 32,26.5 39,26.5 33.5,30.5 35.5,37 30,33 24.5,37 26.5,30.5 21,26.5 28,26.5"
        fill="#e6c88a"
      />
    </svg>
  );
}

/** yeniii.png style certificate preview — navy corners + gold accents */
function CertificatePreview({ cert }: { cert: Certificate }) {
  const fullName = cert.user ? `${cert.user.firstName ?? ''} ${cert.user.lastName ?? ''}`.trim() : '';
  const orgLogo = (cert.user?.organization as { logoUrl?: string | null } | undefined)?.logoUrl ?? '/logos/devakent.png';
  const issued = new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const expiryLabel = cert.expiresAt
    ? `${new Date(cert.expiresAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}${cert.isExpired ? ' (Süresi Dolmuş)' : ''}`
    : 'Süresiz';

  const NAVY = '#0b1e3f';
  const NAVY_DARK = '#06142d';
  const NAVY_MID = '#16305a';
  const GOLD = '#c9a961';
  const GOLD_DARK = '#a5823c';
  const GOLD_LIGHT = '#e6c88a';
  const CREAM = '#faf6eb';

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        background: CREAM,
        borderRadius: '4px',
        aspectRatio: '1.414 / 1',
        minHeight: '300px',
        border: `1px solid ${GOLD}`,
      }}
    >
      {/* Top-left corner block */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0" style={{ width: '30%', height: '40%' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        {/* Top-right */}
        <div className="absolute top-0 right-0" style={{ width: '30%', height: '40%', transform: 'scaleX(-1)' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        {/* Bottom-left */}
        <div className="absolute bottom-0 left-0" style={{ width: '30%', height: '40%', transform: 'scaleY(-1)' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        {/* Bottom-right */}
        <div className="absolute bottom-0 right-0" style={{ width: '30%', height: '40%', transform: 'scale(-1, -1)' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-between px-8 pt-6 pb-4 sm:px-14 sm:pt-7 sm:pb-5" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        {/* Header: logo + title */}
        <div className="flex flex-col items-center gap-1 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={orgLogo} alt="Hastane Logosu" className="h-10 sm:h-12 object-contain" style={{ maxWidth: '55%' }} />
          <h1 className="text-[22px] sm:text-[30px] font-bold tracking-[0.05em] mt-1" style={{ color: GOLD_DARK, letterSpacing: '0.08em' }}>
            BAŞARI SERTİFİKASI
          </h1>
          <div className="flex items-center gap-2 w-full max-w-[60%] mt-0.5">
            <div className="flex-1 h-px" style={{ background: GOLD }} />
            <div className="w-1.5 h-1.5 rotate-45" style={{ background: GOLD }} />
            <div className="flex-1 h-px" style={{ background: GOLD }} />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[10px] sm:text-[11px] italic" style={{ color: '#6e737d' }}>Bu sertifika,</p>
          {fullName && (
            <p className="text-[18px] sm:text-[24px] font-bold tracking-wide uppercase" style={{ color: NAVY, fontFamily: 'system-ui, sans-serif' }}>
              {fullName}
            </p>
          )}
          <p className="text-[11px] sm:text-[13px] font-semibold max-w-[70%] leading-tight" style={{ color: NAVY_MID }}>
            {cert.training.title}
          </p>
          <p className="text-[9px] sm:text-[10px]" style={{ color: '#232837' }}>
            eğitimini başarıyla tamamlamıştır.
          </p>
          <div className="mt-1 text-[8px] sm:text-[9px]" style={{ color: '#232837', fontFamily: 'system-ui, sans-serif' }}>
            <div>Veriliş Tarihi: <span className="font-semibold">{issued}</span></div>
            <div style={{ color: cert.isExpired ? '#c82828' : '#232837' }}>
              Geçerlilik Tarihi: <span className="font-semibold">{expiryLabel}</span>
            </div>
            {cert.score != null && (
              <div style={{ color: GOLD_DARK }} className="font-bold mt-0.5">Sınav Puanı: %{cert.score}</div>
            )}
          </div>
        </div>

        {/* Footer: signatures + gold seal */}
        <div className="w-full flex items-end justify-between px-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="flex flex-col items-center gap-0.5" style={{ width: '28%' }}>
            <div className="h-px w-full" style={{ background: NAVY }} />
            <span className="text-[9px] font-bold" style={{ color: NAVY }}>Yetkili İmza</span>
            <span className="text-[7px]" style={{ color: '#6e737d' }}>Official</span>
          </div>
          <div className="flex flex-col items-center -mb-1">
            <GoldSeal />
          </div>
          <div className="flex flex-col items-center gap-0.5" style={{ width: '28%' }}>
            <div className="h-px w-full" style={{ background: NAVY }} />
            <span className="text-[9px] font-bold" style={{ color: NAVY }}>Eğitmen İmza</span>
            <span className="text-[7px]" style={{ color: '#6e737d' }}>Mühür</span>
          </div>
        </div>
        <p className="absolute bottom-1 left-0 right-0 text-center text-[6px]" style={{ color: '#6e737d', fontFamily: 'system-ui, sans-serif' }}>
          Sertifika Kodu: {cert.certificateCode}
        </p>
      </div>
    </div>
  );
}

export default function StaffCertificatesPage() {
  const { toast } = useToast();
  const { data: rawData, isLoading, error } = useFetch<{ certificates: Certificate[]; total: number }>('/api/staff/certificates');
  const data = rawData?.certificates ?? null;
  const [selected, setSelected] = useState<Certificate | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPDF = async (cert: Certificate) => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/certificates/${cert.id}/pdf`);
      if (!res.ok) throw new Error('PDF indirilemedi');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sertifika-${cert.certificateCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Sertifika PDF olarak indirildi', 'success');
    } catch {
      toast('PDF oluşturulamadı', 'error');
    } finally {
      setPdfLoading(false);
    }
  };

  if (isLoading) return <PageLoading />;
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  const certificates = data ?? [];
  const active = certificates.filter(c => !c.isExpired).length;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => toast('Sertifika kodu kopyalandı', 'success'));
  };

  return (
    <div>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-center gap-4 mb-8">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))',
              boxShadow: '0 4px 14px color-mix(in srgb, var(--brand-600) calc(0.25 * 100%), transparent)',
            }}
          >
            <Award className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Sertifikalarım
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {certificates.length} sertifika · {active} aktif
            </p>
          </div>
        </div>
      </BlurFade>

      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert, i) => {
            const scoreColor = cert.score >= 90 ? 'var(--color-success)' : cert.score >= 70 ? 'var(--color-primary)' : 'var(--color-warning)';
            return (
              <BlurFade key={cert.id} delay={0.05 + i * 0.04}>
                <div
                  className="group relative rounded-2xl border overflow-hidden transition-all duration-200 hover:-translate-y-1"
                  style={{
                    background: 'var(--color-surface)',
                    borderColor: cert.isExpired ? 'var(--color-error)20' : 'var(--color-border)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Top accent */}
                  <div
                    className="h-1.5"
                    style={{
                      background: cert.isExpired
                        ? 'linear-gradient(90deg, var(--color-error), #f87171)'
                        : 'linear-gradient(90deg, var(--color-primary), var(--brand-400))',
                    }}
                  />

                  <div className="p-4 sm:p-5">
                    {/* Status badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl"
                        style={{ background: cert.isExpired ? 'var(--color-error-bg)' : 'var(--color-primary-light)' }}
                      >
                        <Award className="h-5 w-5" style={{ color: cert.isExpired ? 'var(--color-error)' : 'var(--color-primary)' }} />
                      </div>
                      {cert.isExpired ? (
                        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                          <AlertTriangle className="h-3 w-3" /> Süresi Dolmuş
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                          <CheckCircle2 className="h-3 w-3" /> Aktif
                        </span>
                      )}
                    </div>

                    <h3 className="text-[14px] font-bold mb-1 line-clamp-2">{cert.training.title}</h3>
                    <div className="flex items-center gap-1.5 flex-wrap mb-3">
                      {cert.training.category && (
                        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                          {cert.training.category}
                        </span>
                      )}
                      {cert.training.isArchived && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                          style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}
                          title="Bu eğitim artık aktif değil — sertifikanız geçerliliğini korur"
                        >
                          <Archive className="h-2.5 w-2.5" /> Arşivlenmiş
                        </span>
                      )}
                    </div>


                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Puan</p>
                        <p className="text-lg font-bold font-mono" style={{ color: scoreColor }}>{cert.score}%</p>
                      </div>
                      <div className="rounded-xl p-3 text-center" style={{ background: 'var(--color-bg)' }}>
                        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Tarih</p>
                        <p className="text-[12px] font-semibold font-mono">{new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: '2-digit' })}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg p-2.5 mb-4" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <code className="flex-1 text-[11px] font-mono font-semibold truncate" style={{ color: 'var(--color-primary)' }}>
                        {cert.certificateCode}
                      </code>
                      <button onClick={() => copyCode(cert.certificateCode)} aria-label="Sertifika kodunu kopyala" className="shrink-0 flex h-11 w-11 sm:h-7 sm:w-7 items-center justify-center rounded-lg sm:rounded hover:bg-[var(--color-surface-hover)]">
                        <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 rounded-xl text-[12px] h-11 sm:h-9"
                        style={{ borderColor: 'var(--color-border)' }}
                        onClick={() => setSelected(cert)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Önizle
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 rounded-xl text-[12px] h-11 sm:h-9"
                        style={{ borderColor: 'var(--color-border)' }}
                        disabled={pdfLoading}
                        onClick={() => handleDownloadPDF(cert)}
                      >
                        <Download className="h-3.5 w-3.5" /> {pdfLoading ? 'İndiriliyor...' : 'İndir'}
                      </Button>
                    </div>
                  </div>
                </div>
              </BlurFade>
            );
          })}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-2xl border py-20"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-bg)' }}>
            <Award className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <p className="text-[14px] font-semibold mb-1">Eğitimleri başarıyla tamamladığınızda sertifikalarınız burada görünecek.</p>
          <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
            Eğitimleri tamamladığınızda sertifikalarınız burada görünecek
          </p>
        </div>
      )}

      {/* Certificate Preview Modal */}
      {selected && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }} />
          <div
            className="relative w-full max-w-2xl rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5" style={{ color: 'var(--color-primary)' }} />
                <span className="text-[14px] font-bold">Sertifika Önizlemesi</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Kapat"
                className="flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-lg hover:bg-[var(--color-bg)]"
              >
                <X className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>

            {/* Certificate preview */}
            <div className="p-6">
              <CertificatePreview cert={selected} />
            </div>

            {/* Actions */}
            <div className="flex gap-3 px-6 pb-6">
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-11"
                style={{ borderColor: 'var(--color-border)' }}
                onClick={() => setSelected(null)}
              >
                Kapat
              </Button>
              <button
                disabled={pdfLoading}
                aria-label="Sertifikayı PDF olarak indir"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--brand-800))' }}
                onClick={() => selected && handleDownloadPDF(selected)}
              >
                {pdfLoading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Oluşturuluyor...</>
                ) : (
                  <><Download className="h-4 w-4" /> PDF İndir</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
