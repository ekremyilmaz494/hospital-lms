'use client';

import { useState, useRef } from 'react';
import {
  Award, Search, Download, Eye, Calendar, CheckCircle2,
  AlertTriangle, Clock,
  Copy,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BlurFade } from '@/components/ui/blur-fade';
import { useFetch } from '@/hooks/use-fetch';
import { PageLoading } from '@/components/shared/page-loading';
import { useToast } from '@/components/shared/toast';

interface CertUser {
  id: string;
  name: string;
  email: string;
  department: string;
  title: string;
  initials: string;
}

interface CertTraining {
  id: string;
  title: string;
  category: string;
}

interface Certificate {
  id: string;
  certificateCode: string;
  issuedAt: string;
  expiresAt: string | null;
  isExpired: boolean;
  user: CertUser;
  training: CertTraining;
  score: number;
  attemptNumber: number;
}

interface CertPageData {
  certificates: Certificate[];
  stats: { totalCerts: number; activeCerts: number; expiredCerts: number; expiringSoon: number };
  trainings: { id: string; title: string }[];
}

type StatusFilter = 'all' | 'active' | 'expired';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntilExpiry(expiresAt: string | null): number | null {
  if (!expiresAt) return null;
  return Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000);
}

export default function CertificatesPage() {
  const { toast } = useToast();
  const { data, isLoading, error, refetch } = useFetch<CertPageData>('/api/admin/certificates');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [trainingFilter, setTrainingFilter] = useState('');
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const certPdfRef = useRef<HTMLDivElement>(null);

  if (isLoading) return <PageLoading />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm" style={{ color: 'var(--color-error)' }}>{error}</div>
      </div>
    );
  }

  const certificates = data?.certificates ?? [];
  const stats = data?.stats ?? { totalCerts: 0, activeCerts: 0, expiredCerts: 0, expiringSoon: 0 };
  const trainings = data?.trainings ?? [];

  // Client-side search filter
  const filtered = certificates.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !c.user.name.toLowerCase().includes(q) &&
        !c.certificateCode.toLowerCase().includes(q) &&
        !c.training.title.toLowerCase().includes(q) &&
        !c.user.email.toLowerCase().includes(q)
      ) return false;
    }
    if (statusFilter === 'active' && c.isExpired) return false;
    if (statusFilter === 'expired' && !c.isExpired) return false;
    if (trainingFilter && c.training.id !== trainingFilter) return false;
    return true;
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      toast('Sertifika kodu kopyalandı', 'success');
    });
  };

  const statCards = [
    { label: 'Toplam Sertifika', value: stats.totalCerts, icon: Award, color: 'var(--color-primary)' },
    { label: 'Aktif', value: stats.activeCerts, icon: CheckCircle2, color: 'var(--color-success)' },
    { label: 'Süresi Dolacak', value: stats.expiringSoon, icon: Clock, color: 'var(--color-warning)' },
    { label: 'Süresi Dolmuş', value: stats.expiredCerts, icon: AlertTriangle, color: 'var(--color-error)' },
  ];

  return (
    <div>
      {/* Header */}
      <BlurFade delay={0}>
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
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
                Sertifika Yönetimi
              </h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                Personel sertifikalarını görüntüleyin ve yönetin
              </p>
            </div>
          </div>
          <button
            className="flex items-center gap-2 rounded-xl h-10 px-5 text-[13px] font-semibold text-white transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
              boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
            }}
            onClick={async () => {
              const res = await fetch('/api/admin/export/pdf?type=certificates');
              if (!res.ok) { toast('PDF oluşturulamadı', 'error'); return; }
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'sertifikalar.pdf';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
            Dışa Aktar
          </button>
        </div>
      </BlurFade>

      {/* Stat cards */}
      <BlurFade delay={0.03}>
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border p-5 transition-transform duration-200 hover:-translate-y-0.5"
              style={{
                background: 'var(--color-surface)',
                borderColor: 'var(--color-border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                  {s.label}
                </span>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: `${s.color}12` }}>
                  <s.icon className="h-4.5 w-4.5" style={{ color: s.color }} />
                </div>
              </div>
              <p className="text-2xl font-bold font-mono tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
      </BlurFade>

      {/* Filters */}
      <BlurFade delay={0.06}>
        <div
          className="flex items-center gap-3 rounded-xl border px-5 py-3 mb-6"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
        >
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Personel, sertifika kodu veya eğitim ara..."
              className="pl-9 h-10 rounded-lg text-[13px]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--color-bg)' }}>
            {([
              { key: 'all' as const, label: 'Tümü' },
              { key: 'active' as const, label: 'Aktif' },
              { key: 'expired' as const, label: 'Süresi Dolmuş' },
            ]).map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium transition-all duration-150"
                style={{
                  background: statusFilter === f.key ? 'var(--color-primary)' : 'transparent',
                  color: statusFilter === f.key ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {trainings.length > 0 && (
            <select
              value={trainingFilter}
              onChange={(e) => setTrainingFilter(e.target.value)}
              className="h-10 rounded-lg border px-3 text-[12px]"
              style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              <option value="">Tüm Eğitimler</option>
              {trainings.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          )}

          <span className="text-[12px] font-mono ml-auto" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} sonuç
          </span>
        </div>
      </BlurFade>

      {/* Certificate list */}
      <BlurFade delay={0.09}>
        {filtered.length > 0 ? (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ background: 'var(--color-bg)' }}>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Personel</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Eğitim</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Sertifika Kodu</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Puan</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Veriliş Tarihi</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Durum</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cert) => {
                  const days = daysUntilExpiry(cert.expiresAt);
                  const scoreColor = cert.score >= 90 ? 'var(--color-success)' : cert.score >= 70 ? 'var(--color-primary)' : 'var(--color-warning)';
                  return (
                    <tr
                      key={cert.id}
                      className="group transition-colors duration-150 hover:bg-(--color-surface-hover) cursor-pointer"
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                      onClick={() => setSelectedCert(cert)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-[10px] font-bold text-white" style={{ background: 'var(--color-primary)' }}>
                              {cert.user.initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{cert.user.name}</p>
                            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                              {cert.user.department}{cert.user.title ? ` · ${cert.user.title}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="font-medium">{cert.training.title}</p>
                          {cert.training.category && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md mt-0.5 inline-block" style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)' }}>
                              {cert.training.category}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <code className="text-[12px] font-mono font-semibold px-2 py-1 rounded-md" style={{ background: 'var(--color-bg)', color: 'var(--color-primary)' }}>
                            {cert.certificateCode}
                          </code>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyCode(cert.certificateCode); }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 rounded"
                            title="Kopyala"
                          >
                            <Copy className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold" style={{ color: scoreColor }}>{cert.score}%</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" style={{ color: 'var(--color-text-muted)' }} />
                          <span className="font-mono text-[12px]">{formatDate(cert.issuedAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {cert.isExpired ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)' }}>
                            <AlertTriangle className="h-3 w-3" /> Süresi Dolmuş
                          </span>
                        ) : days !== null && days <= 30 ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
                            <Clock className="h-3 w-3" /> {days} gün kaldı
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                            <CheckCircle2 className="h-3 w-3" /> Aktif
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedCert(cert); }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150 hover:bg-(--color-bg)"
                            title="Detay"
                          >
                            <Eye className="h-4 w-4" style={{ color: 'var(--color-text-muted)' }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="px-5 py-3 text-[12px]" style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)' }}>
              {filtered.length} kayıttan {filtered.length > 0 ? '1' : '0'}-{filtered.length} arası
            </div>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center rounded-2xl border py-20"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4" style={{ background: 'var(--color-bg)' }}>
              <Award className="h-7 w-7" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="text-[14px] font-semibold mb-1">Sertifika bulunamadı</p>
            <p className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
              {search || statusFilter !== 'all' || trainingFilter
                ? 'Filtrelere uygun sertifika yok'
                : 'Personel eğitimi tamamladığında sertifika otomatik oluşturulur'}
            </p>
          </div>
        )}
      </BlurFade>

      {/* Detail Modal */}
      {selectedCert && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4" onClick={() => setSelectedCert(null)}>
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
          <div
            className="relative w-full max-w-lg rounded-2xl overflow-hidden"
            style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-xl)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Certificate header */}
            <div
              className="relative px-8 pt-8 pb-6 text-center"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
              }}
            >
              <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4" style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <Award className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                  Tamamlama Sertifikası
                </h2>
                <p className="text-[13px] text-white/70 mt-1">Hastane LMS Eğitim Programı</p>
              </div>
            </div>

            <div className="px-8 py-6 space-y-5">
              {/* Holder */}
              <div className="text-center pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Bu sertifika</p>
                <p className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)' }}>{selectedCert.user.name}</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  {selectedCert.user.department}{selectedCert.user.title ? ` · ${selectedCert.user.title}` : ''}
                </p>
              </div>

              {/* Training */}
              <div className="text-center pb-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
                <p className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>Tamamlanan Eğitim</p>
                <p className="text-base font-bold">{selectedCert.training.title}</p>
                {selectedCert.training.category && (
                  <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                    {selectedCert.training.category}
                  </span>
                )}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Puan</p>
                  <p className="text-lg font-bold font-mono" style={{ color: 'var(--color-primary)' }}>{selectedCert.score}%</p>
                </div>
                <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Deneme</p>
                  <p className="text-lg font-bold font-mono">{selectedCert.attemptNumber}.</p>
                </div>
                <div className="text-center rounded-xl p-3" style={{ background: 'var(--color-bg)' }}>
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-muted)' }}>Durum</p>
                  <p className="text-lg font-bold" style={{ color: selectedCert.isExpired ? 'var(--color-error)' : 'var(--color-success)' }}>
                    {selectedCert.isExpired ? 'Dolmuş' : 'Aktif'}
                  </p>
                </div>
              </div>

              {/* Code & Dates */}
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Sertifika Kodu</span>
                  <div className="flex items-center gap-2">
                    <code className="text-[13px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>{selectedCert.certificateCode}</code>
                    <button onClick={() => copyCode(selectedCert.certificateCode)} className="p-1 rounded hover:bg-(--color-surface-hover)">
                      <Copy className="h-3.5 w-3.5" style={{ color: 'var(--color-text-muted)' }} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Veriliş Tarihi</span>
                  <span className="text-[13px] font-mono">{formatDate(selectedCert.issuedAt)}</span>
                </div>
                {selectedCert.expiresAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>Geçerlilik Tarihi</span>
                    <span className="text-[13px] font-mono" style={{ color: selectedCert.isExpired ? 'var(--color-error)' : undefined }}>
                      {formatDate(selectedCert.expiresAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2 rounded-xl h-11"
                  style={{ borderColor: 'var(--color-border)' }}
                  onClick={() => setSelectedCert(null)}
                >
                  Kapat
                </Button>
                <button
                  disabled={pdfLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl h-11 text-[13px] font-semibold text-white disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, var(--color-primary), #065f46)',
                    boxShadow: '0 4px 12px rgba(13, 150, 104, 0.2)',
                  }}
                  onClick={async () => {
                    if (!certPdfRef.current) return;
                    setPdfLoading(true);
                    try {
                      const html2canvas = (await import('html2canvas-pro')).default;
                      const { default: jsPDF } = await import('jspdf');
                      const el = certPdfRef.current;
                      el.style.display = 'block';
                      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                      el.style.display = 'none';
                      const imgData = canvas.toDataURL('image/png');
                      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
                      doc.addImage(imgData, 'PNG', 0, 0, 297, 210);
                      doc.save(`sertifika-${selectedCert.certificateCode}.pdf`);
                      toast('Sertifika PDF olarak indirildi', 'success');
                    } catch {
                      toast('PDF oluşturulamadı', 'error');
                    } finally {
                      setPdfLoading(false);
                    }
                  }}
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
        </div>
      )}

      {/* Hidden PDF Template — rendered offscreen, captured by html2canvas */}
      {selectedCert && (
        <div
          ref={certPdfRef}
          style={{
            display: 'none',
            width: '1122px',
            height: '793px',
            position: 'fixed',
            left: '-9999px',
            top: 0,
            background: '#f8fafc',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            overflow: 'hidden',
          }}
        >
          {/* Outer border */}
          <div style={{ position: 'absolute', inset: '20px', border: '3px solid #0d9668', borderRadius: '4px' }}>
            <div style={{ position: 'absolute', inset: '6px', border: '1px solid #0d966840' }} />
          </div>

          {/* Corner ornaments */}
          {[[24, 24], [1122 - 24 - 40, 24], [24, 793 - 24 - 40], [1122 - 24 - 40, 793 - 24 - 40]].map(([x, y], i) => (
            <div key={i} style={{ position: 'absolute', left: `${x}px`, top: `${y}px`, width: '40px', height: '40px', border: '1.5px solid #0d9668', borderRadius: '2px' }} />
          ))}

          {/* Top accent */}
          <div style={{ position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '6px', background: 'linear-gradient(90deg, #0d9668, #065f46)', borderRadius: '3px' }} />

          {/* Content container */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 80px' }}>

            {/* Medal */}
            <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #0d9668, #065f46)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', boxShadow: '0 4px 20px rgba(13,150,104,0.3)' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #0d9668, #065f46)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', fontWeight: 'bold' }}>✓</div>
              </div>
            </div>

            {/* Title */}
            <h1 style={{ fontSize: '38px', fontWeight: 800, color: '#0f172a', letterSpacing: '2px', margin: '16px 0 4px', textAlign: 'center' }}>TAMAMLAMA SERTİFİKASI</h1>
            <p style={{ fontSize: '14px', color: '#94a3b8', margin: 0, letterSpacing: '1px' }}>Hastane LMS Eğitim Programı</p>

            {/* Divider */}
            <div style={{ width: '300px', height: '1px', background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)', margin: '20px 0' }} />

            {/* Label */}
            <p style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '3px', margin: '0 0 8px' }}>Bu Sertifika</p>

            {/* Name */}
            <h2 style={{ fontSize: '32px', fontWeight: 700, color: '#0f172a', margin: '0 0 4px', textAlign: 'center' }}>{selectedCert.user.name}</h2>
            <p style={{ fontSize: '14px', color: '#64748b', margin: 0 }}>
              {selectedCert.user.department}{selectedCert.user.title ? ` · ${selectedCert.user.title}` : ''}
            </p>

            {/* Description */}
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: '12px 0 0', textAlign: 'center' }}>
              adlı personele, aşağıdaki eğitimi başarıyla tamamladığı için verilmiştir.
            </p>

            {/* Divider */}
            <div style={{ width: '300px', height: '1px', background: 'linear-gradient(90deg, transparent, #cbd5e1, transparent)', margin: '20px 0' }} />

            {/* Training */}
            <h3 style={{ fontSize: '22px', fontWeight: 700, color: '#0d9668', margin: '0 0 6px', textAlign: 'center' }}>{selectedCert.training.title}</h3>
            {selectedCert.training.category && (
              <span style={{ fontSize: '10px', color: '#64748b', background: '#f1f5f9', padding: '3px 12px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {selectedCert.training.category}
              </span>
            )}

            {/* Stats */}
            <div style={{ display: 'flex', gap: '16px', margin: '24px 0' }}>
              {[
                { label: 'PUAN', value: `${selectedCert.score}%` },
                { label: 'DENEME', value: `${selectedCert.attemptNumber}.` },
                { label: 'DURUM', value: selectedCert.isExpired ? 'Süresi Dolmuş' : 'Aktif' },
              ].map((b) => (
                <div key={b.label} style={{ width: '140px', background: '#f1f5f9', borderRadius: '10px', padding: '12px 0', textAlign: 'center' }}>
                  <p style={{ fontSize: '9px', color: '#94a3b8', letterSpacing: '2px', margin: '0 0 4px', textTransform: 'uppercase' }}>{b.label}</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{b.value}</p>
                </div>
              ))}
            </div>

            {/* Bottom info */}
            <div style={{ width: '100%', maxWidth: '700px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', marginTop: 'auto' }}>
              <div>
                <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Sertifika Kodu</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0d9668', margin: 0, fontFamily: 'monospace' }}>{selectedCert.certificateCode}</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Veriliş Tarihi</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{formatDate(selectedCert.issuedAt)}</p>
              </div>
              {selectedCert.expiresAt && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: '9px', color: '#94a3b8', margin: '0 0 4px', letterSpacing: '1px', textTransform: 'uppercase' }}>Geçerlilik Tarihi</p>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: selectedCert.isExpired ? '#dc2626' : '#0f172a', margin: 0 }}>{formatDate(selectedCert.expiresAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bottom accent */}
          <div style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', width: '160px', height: '5px', background: 'linear-gradient(90deg, #0d9668, #065f46)', borderRadius: '3px' }} />
        </div>
      )}
    </div>
  );
}
