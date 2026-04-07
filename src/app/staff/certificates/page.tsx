'use client';

import { useState } from 'react';
import {
  Award, Download, CheckCircle2, AlertTriangle, Copy, Eye, X, Shield, Star,
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

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/** Premium HTML certificate preview */
function CertificatePreview({ cert }: { cert: Certificate }) {
  const fullName = cert.user ? `${cert.user.firstName ?? ''} ${cert.user.lastName ?? ''}`.trim() : '';
  const orgName = cert.user?.organization?.name ?? 'Hastane LMS';
  const scoreColor = cert.score >= 90 ? '#059669' : cert.score >= 70 ? '#0d9668' : '#f59e0b';

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        background: 'linear-gradient(145deg, #f0fdf4 0%, #ecfdf5 40%, #f8fafc 100%)',
        border: '3px solid #059669',
        borderRadius: '16px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        aspectRatio: '1.414 / 1',
        minHeight: '280px',
      }}
    >
      {/* Corner decorations */}
      {[
        'top-0 left-0',
        'top-0 right-0 rotate-90',
        'bottom-0 left-0 -rotate-90',
        'bottom-0 right-0 rotate-180',
      ].map((pos, i) => (
        <div key={i} className={`absolute ${pos} w-10 h-10`}>
          <svg viewBox="0 0 40 40" fill="none">
            <path d="M0 0 L20 0 L20 4 L4 4 L4 20 L0 20 Z" fill="#059669" opacity="0.5" />
            <path d="M0 0 L12 0 L12 2 L2 2 L2 12 L0 12 Z" fill="#059669" />
          </svg>
        </div>
      ))}

      {/* Top accent line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 rounded-b-full" style={{ background: 'linear-gradient(90deg, transparent, #059669, transparent)' }} />

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ opacity: 0.03 }}>
        <Award style={{ width: '60%', height: '60%', color: '#059669' }} />
      </div>

      <div className="relative h-full flex flex-col items-center justify-between px-8 py-5">
        {/* Header */}
        <div className="flex flex-col items-center gap-1 w-full">
          <div className="flex items-center gap-2">
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, #059669)' }} />
            <span className="text-[9px] font-sans font-bold tracking-[0.3em] uppercase" style={{ color: '#059669' }}>
              {orgName}
            </span>
            <div className="h-px flex-1" style={{ background: 'linear-gradient(90deg, #059669, transparent)' }} />
          </div>

          <div className="flex items-center gap-2 mt-1">
            <Star className="h-3 w-3 fill-current" style={{ color: '#f59e0b' }} />
            <h1 className="text-[15px] font-bold tracking-widest uppercase" style={{ color: '#0d9668', letterSpacing: '0.2em' }}>
              Başarı Sertifikası
            </h1>
            <Star className="h-3 w-3 fill-current" style={{ color: '#f59e0b' }} />
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[9px] font-sans tracking-widest uppercase" style={{ color: '#64748b', letterSpacing: '0.15em' }}>
            Bu sertifika aşağıdaki kişiye verilmiştir
          </p>
          {fullName && (
            <p className="text-[18px] font-bold" style={{ color: '#0f172a', fontStyle: 'italic', textShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
              {fullName}
            </p>
          )}

          <div className="h-px w-24 mt-0.5" style={{ background: 'linear-gradient(90deg, transparent, #059669, transparent)' }} />

          <p className="text-[8px] font-sans tracking-widest uppercase mt-1" style={{ color: '#64748b' }}>
            Eğitim
          </p>
          <p className="text-[13px] font-bold max-w-[200px] leading-snug" style={{ color: '#059669' }}>
            {cert.training.title}
          </p>
        </div>

        {/* Footer */}
        <div className="w-full flex items-end justify-between">
          {/* Score */}
          <div className="flex flex-col items-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full border-2"
              style={{ borderColor: scoreColor, background: `${scoreColor}10` }}
            >
              <span className="text-[13px] font-bold font-mono" style={{ color: scoreColor }}>{cert.score}%</span>
            </div>
            <span className="text-[8px] font-sans mt-0.5" style={{ color: '#64748b' }}>Puan</span>
          </div>

          {/* Center bottom */}
          <div className="flex flex-col items-center gap-1">
            <Shield className="h-5 w-5" style={{ color: '#059669' }} />
            <div className="text-center">
              <p className="text-[7px] font-sans tracking-wider" style={{ color: '#94a3b8' }}>SERTİFİKA KODU</p>
              <p className="text-[9px] font-mono font-bold" style={{ color: '#059669' }}>{cert.certificateCode.slice(0, 20)}</p>
            </div>
          </div>

          {/* Date */}
          <div className="flex flex-col items-center">
            <div
              className="flex flex-col items-center justify-center rounded-lg px-3 py-1.5"
              style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}
            >
              <span className="text-[8px] font-sans" style={{ color: '#64748b' }}>Tarih</span>
              <span className="text-[9px] font-bold font-mono" style={{ color: '#0f172a' }}>
                {new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
            </div>
            {cert.isExpired && (
              <span className="text-[8px] font-sans mt-0.5" style={{ color: '#dc2626' }}>Süresi Dolmuş</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-0.5 rounded-t-full" style={{ background: 'linear-gradient(90deg, transparent, #059669, transparent)' }} />
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
              background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
              boxShadow: '0 4px 14px rgba(13, 150, 104, 0.25)',
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
                        : 'linear-gradient(90deg, var(--color-primary), #34d399)',
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
                      <button onClick={() => copyCode(cert.certificateCode)} className="shrink-0 p-2 sm:p-1 rounded-lg sm:rounded hover:bg-[var(--color-surface-hover)]">
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
          <p className="text-[14px] font-semibold mb-1">Henüz sertifikanız yok</p>
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
                className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold text-white disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}
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
