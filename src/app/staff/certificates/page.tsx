'use client';

import { useState } from 'react';
import {
  Award, Download, Calendar, CheckCircle2, AlertTriangle, Clock, Copy, Eye,
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
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export default function StaffCertificatesPage() {
  const { toast } = useToast();
  const { data, isLoading, error } = useFetch<Certificate[]>('/api/staff/certificates');
  const [selected, setSelected] = useState<Certificate | null>(null);

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
            <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              Sertifikalarım
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              {certificates.length} sertifika · {active} aktif
            </p>
          </div>
        </div>
      </BlurFade>

      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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

                  <div className="p-5">
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

                    {/* Training title */}
                    <h3 className="text-[14px] font-bold mb-1 line-clamp-2">{cert.training.title}</h3>
                    {cert.training.category && (
                      <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-md mb-3" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                        {cert.training.category}
                      </span>
                    )}

                    {/* Score + Date */}
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

                    {/* Certificate code */}
                    <div className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                      <code className="flex-1 text-[11px] font-mono font-semibold truncate" style={{ color: 'var(--color-primary)' }}>
                        {cert.certificateCode}
                      </code>
                      <button onClick={() => copyCode(cert.certificateCode)} className="shrink-0 p-1 rounded hover:bg-[var(--color-surface-hover)]">
                        <Copy className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 rounded-xl text-[12px] h-9"
                        style={{ borderColor: 'var(--color-border)' }}
                        onClick={() => setSelected(cert)}
                      >
                        <Eye className="h-3.5 w-3.5" /> Görüntüle
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 gap-1.5 rounded-xl text-[12px] h-9"
                        style={{ borderColor: 'var(--color-border)' }}
                        onClick={() => toast('Yakında eklenecek', 'info')}
                      >
                        <Download className="h-3.5 w-3.5" /> İndir
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

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onClick={() => setSelected(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-8 pt-8 pb-6 text-center" style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl mx-auto mb-3" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <Award className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>Tamamlama Sertifikası</h2>
              <p className="text-[12px] text-white/60 mt-1">Hastane LMS</p>
            </div>

            <div className="px-8 py-6 space-y-5">
              <div className="text-center pb-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-base font-bold">{selected.training.title}</p>
                {selected.training.category && (
                  <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    {selected.training.category}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Puan</p>
                  <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{selected.score}%</p>
                </div>
                <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Deneme</p>
                  <p className="text-lg font-bold font-mono">{selected.attemptNumber}.</p>
                </div>
                <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Durum</p>
                  <p className="text-lg font-bold" style={{ color: selected.isExpired ? 'var(--color-error)' : 'var(--color-success)' }}>
                    {selected.isExpired ? 'Dolmuş' : 'Aktif'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl p-4 space-y-2.5" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Sertifika Kodu</span>
                  <div className="flex items-center gap-1.5">
                    <code className="text-[12px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{selected.certificateCode}</code>
                    <button onClick={() => copyCode(selected.certificateCode)} className="p-1 rounded">
                      <Copy className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Veriliş Tarihi</span>
                  <span className="text-[12px] font-mono">{formatDate(selected.issuedAt)}</span>
                </div>
                {selected.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>Geçerlilik</span>
                    <span className="text-[12px] font-mono">{formatDate(selected.expiresAt)}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1 rounded-xl h-11" style={{ borderColor: 'var(--color-border)' }} onClick={() => setSelected(null)}>
                  Kapat
                </Button>
                <button
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, var(--color-primary), #065f46)' }}
                  onClick={() => toast('Yakında eklenecek', 'info')}
                >
                  <Download className="h-4 w-4" /> PDF İndir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
