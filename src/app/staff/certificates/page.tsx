'use client';

import { useState } from 'react';
import {
  Award, Download, CheckCircle2, AlertTriangle, Copy, Eye, X,
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
  training: { title: string; category: string };
  score: number;
  attemptNumber: number;
  user?: { firstName?: string; lastName?: string; organization?: { name?: string } };
}

/** Greek key corner ornament SVG */
function CornerOrnament({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 60" className={className} fill="#1e1e1e">
      {/* Outer frame */}
      <rect x="0" y="0" width="60" height="7" />
      <rect x="0" y="0" width="7" height="60" />
      <rect x="0" y="53" width="60" height="7" />
      <rect x="53" y="0" width="7" height="60" />
      {/* Inner key */}
      <rect x="14" y="18" width="32" height="5" />
      <rect x="22" y="14" width="5" height="32" />
      {/* Center block */}
      <rect x="23" y="23" width="14" height="14" />
    </svg>
  );
}

/** Gold seal SVG */
function GoldSeal() {
  const points = 24;
  const outerR = 28;
  const innerR = 24;
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
    <svg viewBox="0 0 60 60" className="h-14 w-14 sm:h-16 sm:w-16">
      <path d={d} fill="#B48C32" />
      <circle cx="30" cy="30" r="20" fill="#966E1E" />
      <circle cx="30" cy="30" r="17" fill="#B48C32" />
      <circle cx="30" cy="30" r="13" fill="#966E1E" />
      {/* Star */}
      <polygon
        points="30,19 32.5,26 40,26 34,30.5 36,38 30,33.5 24,38 26,30.5 20,26 27.5,26"
        fill="#B48C32"
      />
      <text x="30" y="46" textAnchor="middle" fill="white" fontSize="4" fontWeight="bold" fontFamily="sans-serif">BASARI</text>
    </svg>
  );
}

/** Premium HTML certificate preview — professional design */
function CertificatePreview({ cert }: { cert: Certificate }) {
  const fullName = cert.user ? `${cert.user.firstName ?? ''} ${cert.user.lastName ?? ''}`.trim() : '';
  const orgName = cert.user?.organization?.name ?? 'Devakent Hastanesi';

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        background: `
          repeating-linear-gradient(45deg, transparent, transparent 6px, rgba(200,210,220,0.15) 6px, rgba(200,210,220,0.15) 7px),
          repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(200,210,220,0.15) 6px, rgba(200,210,220,0.15) 7px),
          #fcfdfe
        `,
        borderRadius: '4px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        aspectRatio: '1.414 / 1',
        minHeight: '280px',
      }}
    >
      {/* Top-left diagonal stripes */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div
          className="absolute"
          style={{
            top: 0, left: 0,
            width: '40%', height: '45%',
            background: 'var(--brand-600)',
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: 0, left: 0,
            width: '33%', height: '38%',
            background: '#1e1e1e',
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: 0, left: 0,
            width: '23%', height: '26%',
            background: 'var(--brand-600)',
            clipPath: 'polygon(0 0, 100% 0, 0 100%)',
          }}
        />
      </div>

      {/* Bottom-right diagonal stripes */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div
          className="absolute"
          style={{
            bottom: 0, right: 0,
            width: '40%', height: '45%',
            background: '#1e1e1e',
            clipPath: 'polygon(100% 100%, 0 100%, 100% 0)',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: 0, right: 0,
            width: '30%', height: '35%',
            background: 'var(--brand-600)',
            clipPath: 'polygon(100% 100%, 0 100%, 100% 0)',
          }}
        />
        <div
          className="absolute"
          style={{
            bottom: 0, right: 0,
            width: '19%', height: '22%',
            background: 'var(--brand-800)',
            clipPath: 'polygon(100% 100%, 0 100%, 100% 0)',
          }}
        />
      </div>

      {/* Corner ornaments */}
      <CornerOrnament className="absolute top-2 left-2 w-8 h-8 sm:w-10 sm:h-10" />
      <CornerOrnament className="absolute top-2 right-2 w-8 h-8 sm:w-10 sm:h-10 -scale-x-100" />
      <CornerOrnament className="absolute bottom-2 left-2 w-8 h-8 sm:w-10 sm:h-10 -scale-y-100" />
      <CornerOrnament className="absolute bottom-2 right-2 w-8 h-8 sm:w-10 sm:h-10 -scale-x-100 -scale-y-100" />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-between px-8 py-5 sm:px-12 sm:py-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-0.5 w-full">
          {/* Green diamond logo */}
          <div
            className="w-4 h-4 sm:w-5 sm:h-5 rotate-45 mb-1"
            style={{ background: 'var(--brand-600)' }}
          />
          <span className="text-[8px] sm:text-[9px] font-sans font-bold tracking-[0.3em] uppercase" style={{ color: '#94a3b8' }}>
            {orgName}
          </span>

          <h1 className="text-[18px] sm:text-[22px] font-bold tracking-[0.15em] uppercase mt-1" style={{ color: 'var(--brand-600)' }}>
            SERTİFİKA
          </h1>
          <span className="text-[10px] sm:text-[11px] font-sans tracking-[0.2em] uppercase" style={{ color: '#1e1e1e' }}>
            BAŞARI BELGESİ
          </span>

          {/* Separator */}
          <div className="h-px w-20 mt-1" style={{ background: 'linear-gradient(90deg, transparent, var(--brand-600), transparent)' }} />
        </div>

        {/* Body */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <p className="text-[8px] sm:text-[9px] font-sans tracking-[0.15em] uppercase" style={{ color: '#94a3b8' }}>
            Bu sertifika aşağıdaki kişiye verilmiştir
          </p>
          {fullName && (
            <p className="text-[16px] sm:text-[20px] font-bold italic" style={{ color: '#0f172a' }}>
              {fullName}
            </p>
          )}
          {/* Name underline */}
          <div className="h-px w-32 sm:w-40" style={{ background: 'var(--brand-600)' }} />

          <p className="text-[8px] font-sans tracking-widest uppercase mt-1" style={{ color: '#94a3b8' }}>
            Eğitim
          </p>
          <p className="text-[11px] sm:text-[13px] font-bold max-w-[200px] leading-snug" style={{ color: 'var(--brand-600)' }}>
            {cert.training.title}
          </p>

          {cert.score != null && (
            <div className="mt-1">
              <span className="text-[8px] font-sans tracking-wider uppercase" style={{ color: '#94a3b8' }}>Puan: </span>
              <span className="text-[12px] font-bold font-mono" style={{ color: '#0f172a' }}>{cert.score}%</span>
            </div>
          )}
        </div>

        {/* Footer: Date | Seal | Signature */}
        <div className="w-full flex items-end justify-between">
          {/* Date */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-sans tracking-wider uppercase" style={{ color: '#94a3b8' }}>Tarih</span>
            <div className="h-px w-16" style={{ background: '#1e1e1e' }} />
            <span className="text-[9px] font-bold font-mono" style={{ color: '#0f172a' }}>
              {new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            {cert.isExpired && (
              <span className="text-[7px] font-sans" style={{ color: '#dc2626' }}>Süresi Dolmuş</span>
            )}
          </div>

          {/* Gold seal */}
          <div className="flex flex-col items-center -mb-1">
            <GoldSeal />
            <p className="text-[7px] font-mono mt-0.5" style={{ color: '#94a3b8' }}>
              {cert.certificateCode.slice(0, 18)}
            </p>
          </div>

          {/* Signature */}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] font-sans tracking-wider uppercase" style={{ color: '#94a3b8' }}>İmza</span>
            <div className="h-px w-16" style={{ background: '#1e1e1e' }} />
          </div>
        </div>
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
                    {cert.training.category && (
                      <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md mb-3" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                        {cert.training.category}
                      </span>
                    )}

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
                      <button onClick={() => copyCode(cert.certificateCode)} aria-label="Sertifika kodunu kopyala" className="shrink-0 p-2 sm:p-1 rounded-lg sm:rounded hover:bg-[var(--color-surface-hover)]">
                        <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 rounded-xl text-[12px] h-9"
                        style={{ borderColor: 'var(--color-border)' }}
                        onClick={() => setSelected(cert)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Önizle
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 rounded-xl text-[12px] h-9"
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
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--color-bg)]"
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
