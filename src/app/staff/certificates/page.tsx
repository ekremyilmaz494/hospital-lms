'use client';

import { useState } from 'react';
import {
  Award, Download, CheckCircle2, AlertTriangle, Copy, Eye, X, Archive,
} from 'lucide-react';
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

/** Gold medal seal — certificate artifact element */
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

/** Certificate artifact (preserved — this is the printable document) */
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
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0" style={{ width: '30%', height: '40%' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        <div className="absolute top-0 right-0" style={{ width: '30%', height: '40%', transform: 'scaleX(-1)' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        <div className="absolute bottom-0 left-0" style={{ width: '30%', height: '40%', transform: 'scaleY(-1)' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        <div className="absolute bottom-0 right-0" style={{ width: '30%', height: '40%', transform: 'scale(-1, -1)' }}>
          <div className="absolute inset-0" style={{ background: NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
      </div>

      <div className="relative h-full flex flex-col items-center justify-between px-8 pt-6 pb-4 sm:px-14 sm:pt-7 sm:pb-5" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
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
      <div className="cp-err">
        <div className="cp-err-icon"><AlertTriangle className="h-6 w-6" /></div>
        <h2>Sertifikalar yüklenemedi</h2>
        <p>{error}</p>
        <style>{`
          .cp-err { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 40px 20px; gap: 10px; max-width: 420px; margin: 0 auto; }
          .cp-err-icon { width: 56px; height: 56px; border-radius: 999px; background: #fdf5f2; color: #b3261e; display: flex; align-items: center; justify-content: center; }
          .cp-err h2 { font-family: var(--font-editorial, serif); font-size: 20px; color: #0a0a0a; margin: 0; }
          .cp-err p { font-size: 13px; color: #6b6a63; margin: 0; }
        `}</style>
      </div>
    );
  }

  const certificates = data ?? [];
  const active = certificates.filter(c => !c.isExpired).length;
  const expired = certificates.length - active;

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => toast('Sertifika kodu kopyalandı', 'success'));
  };

  return (
    <div className="cp-page">
      {/* ═══════ Editorial Header ═══════ */}
      <header className="cp-header">
        <span className="cp-eyebrow">Başarı Arşivi</span>
        <h1 className="cp-title">
          <em>Sertifikalarım</em>
        </h1>
        <div className="cp-summary">
          <span><strong>{certificates.length.toString().padStart(2, '0')}</strong> toplam</span>
          <span className="cp-summary-sep">·</span>
          <span><strong className="cp-summary-ok">{active.toString().padStart(2, '0')}</strong> aktif</span>
          {expired > 0 && (
            <>
              <span className="cp-summary-sep">·</span>
              <span><strong className="cp-summary-err">{expired.toString().padStart(2, '0')}</strong> süresi dolmuş</span>
            </>
          )}
        </div>
      </header>

      {/* ═══════ Certificates Grid ═══════ */}
      {certificates.length > 0 ? (
        <div className="cp-grid">
          {certificates.map((cert, i) => {
            const issued = new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
            return (
              <article
                key={cert.id}
                className={`cp-card ${cert.isExpired ? 'cp-card-expired' : ''}`}
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <span className="cp-card-rail" />

                <header className="cp-card-head">
                  <div className="cp-seal-wrap">
                    <div className="cp-seal">
                      <Award className="h-5 w-5" />
                    </div>
                  </div>
                  {cert.isExpired ? (
                    <span className="cp-chip cp-chip-err">
                      <AlertTriangle className="h-3 w-3" />
                      Süresi Dolmuş
                    </span>
                  ) : (
                    <span className="cp-chip cp-chip-ok">
                      <CheckCircle2 className="h-3 w-3" />
                      Aktif
                    </span>
                  )}
                </header>

                <h2 className="cp-card-title">{cert.training.title}</h2>

                <div className="cp-card-tags">
                  {cert.training.category && (
                    <span className="cp-tag">{cert.training.category}</span>
                  )}
                  {cert.training.isArchived && (
                    <span className="cp-tag cp-tag-archived" title="Bu eğitim artık aktif değil — sertifikanız geçerliliğini korur">
                      <Archive className="h-2.5 w-2.5" />
                      Arşivlendi
                    </span>
                  )}
                </div>

                <dl className="cp-metrics">
                  <div>
                    <dt>Puan</dt>
                    <dd>
                      <strong>{cert.score}</strong>
                      <span>%</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Tarih</dt>
                    <dd className="cp-metric-date">
                      <strong>{issued}</strong>
                    </dd>
                  </div>
                </dl>

                <div className="cp-code-row">
                  <span className="cp-code-label">Kod</span>
                  <code className="cp-code">{cert.certificateCode}</code>
                  <button
                    onClick={() => copyCode(cert.certificateCode)}
                    aria-label="Kopyala"
                    className="cp-copy-btn"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="cp-card-actions">
                  <button
                    onClick={() => setSelected(cert)}
                    className="cp-act cp-act-ghost"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Önizle</span>
                  </button>
                  <button
                    disabled={pdfLoading}
                    onClick={() => handleDownloadPDF(cert)}
                    className="cp-act cp-act-primary"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>{pdfLoading ? 'İndiriliyor…' : 'İndir'}</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="cp-empty">
          <div className="cp-empty-icon">
            <Award className="h-7 w-7" />
          </div>
          <span className="cp-eyebrow">Boş</span>
          <h2>Henüz sertifikan yok</h2>
          <p>Eğitimleri başarıyla tamamladığında sertifikaların burada arşivlenecek.</p>
        </div>
      )}

      {/* ═══════ Preview Modal ═══════ */}
      {selected && (
        <div className="cp-modal" onClick={() => setSelected(null)}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <header className="cp-modal-head">
              <div className="cp-modal-head-title">
                <Award className="h-4 w-4" />
                <span>Sertifika Önizlemesi</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Kapat"
                className="cp-modal-close"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="cp-modal-body">
              <CertificatePreview cert={selected} />
            </div>

            <footer className="cp-modal-foot">
              <button
                onClick={() => setSelected(null)}
                className="cp-act cp-act-ghost"
              >
                Kapat
              </button>
              <button
                disabled={pdfLoading}
                onClick={() => selected && handleDownloadPDF(selected)}
                className="cp-act cp-act-primary"
              >
                {pdfLoading ? (
                  <>
                    <span className="cp-spin" />
                    <span>Oluşturuluyor…</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    <span>PDF İndir</span>
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}

      <style jsx>{`
        .cp-page { display: flex; flex-direction: column; gap: 24px; padding-bottom: 40px; }

        /* ── Header ── */
        .cp-header {
          padding-bottom: 20px;
          border-bottom: 1px solid #ebe7df;
        }
        .cp-eyebrow {
          display: inline-block;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 10px;
        }
        .cp-title {
          font-family: var(--font-editorial, serif);
          font-size: clamp(30px, 5vw, 48px);
          font-weight: 500;
          font-variation-settings: 'opsz' 72, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 0;
        }
        .cp-title em {
          font-style: italic;
          font-variation-settings: 'opsz' 72, 'SOFT' 100;
        }
        .cp-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 10px;
          flex-wrap: wrap;
          font-family: var(--font-display, system-ui);
          font-size: 13px;
          color: #6b6a63;
          font-variant-numeric: tabular-nums;
        }
        .cp-summary strong {
          color: #0a0a0a;
          font-family: var(--font-editorial, serif);
          font-weight: 500;
          margin-right: 4px;
        }
        .cp-summary-ok { color: #0a7a47 !important; }
        .cp-summary-err { color: #b3261e !important; }
        .cp-summary-sep { color: #c8c2b0; }

        /* ── Grid ── */
        .cp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 14px;
        }

        /* ── Card ── */
        .cp-card {
          position: relative;
          padding: 22px 22px 20px 26px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          border-radius: 16px;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5), 0 1px 2px rgba(10, 10, 10, 0.02);
          overflow: hidden;
          opacity: 0;
          animation: cp-in 360ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: border-color 200ms ease, transform 260ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 220ms ease;
        }
        @keyframes cp-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .cp-card:hover {
          border-color: #0a7a47;
          transform: translateY(-2px);
          box-shadow: 0 4px 18px rgba(10, 122, 71, 0.08);
        }
        .cp-card-rail {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: #0a7a47;
        }
        .cp-card-expired .cp-card-rail { background: #b3261e; }
        .cp-card-expired:hover { border-color: #b3261e; box-shadow: 0 4px 18px rgba(179, 38, 30, 0.08); }

        .cp-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 18px;
        }
        .cp-seal-wrap {
          position: relative;
          width: 48px;
          height: 48px;
        }
        .cp-seal {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #d4b36e 0%, #a5823c 100%);
          color: #faf8f2;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(165, 130, 60, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3);
        }
        .cp-card-expired .cp-seal {
          background: linear-gradient(135deg, #e9c9c0 0%, #b3261e 100%);
        }

        .cp-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.04em;
        }
        .cp-chip-ok { background: #eaf6ef; color: #0a7a47; border: 1px solid #c8e6d5; }
        .cp-chip-err { background: #fdf5f2; color: #b3261e; border: 1px solid #e9c9c0; }

        .cp-card-title {
          font-family: var(--font-editorial, serif);
          font-size: 17px;
          font-weight: 500;
          font-variation-settings: 'opsz' 30, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.015em;
          line-height: 1.25;
          margin: 0 0 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .cp-card-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 14px;
        }
        .cp-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 9px;
          border-radius: 999px;
          background: #faf8f2;
          border: 1px solid #ebe7df;
          font-family: var(--font-display, system-ui);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: #6b6a63;
        }
        .cp-tag-archived { color: #8a5a11; background: #fef6e7; border-color: #e9c977; }

        .cp-metrics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin: 0 0 14px;
        }
        .cp-metrics > div {
          padding: 10px 12px;
          background: #faf8f2;
          border: 1px solid #ebe7df;
          border-radius: 10px;
        }
        .cp-metrics dt {
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a8578;
          margin-bottom: 4px;
        }
        .cp-metrics dd {
          display: flex;
          align-items: baseline;
          gap: 2px;
          font-family: var(--font-editorial, serif);
          font-size: 20px;
          font-weight: 500;
          font-variation-settings: 'opsz' 32, 'SOFT' 50;
          color: #0a0a0a;
          line-height: 1;
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
          margin: 0;
        }
        .cp-metrics dd span {
          font-family: var(--font-display, system-ui);
          font-size: 11px;
          color: #8a8578;
          font-weight: 500;
        }
        .cp-metric-date strong {
          font-size: 15px;
          font-weight: 500;
        }

        .cp-code-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #faf8f2;
          border: 1px dashed #ebe7df;
          border-radius: 10px;
          margin-bottom: 14px;
        }
        .cp-code-label {
          font-family: var(--font-display, system-ui);
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #8a8578;
          flex-shrink: 0;
        }
        .cp-code {
          flex: 1;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 600;
          color: #0a0a0a;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cp-copy-btn {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border-radius: 8px;
          background: #ffffff;
          border: 1px solid #ebe7df;
          color: #6b6a63;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .cp-copy-btn:hover { background: #0a0a0a; color: #fafaf7; border-color: #0a0a0a; }

        .cp-card-actions {
          display: flex;
          gap: 8px;
        }

        /* ── Buttons ── */
        .cp-act {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          flex: 1;
          height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          font-family: var(--font-display, system-ui);
          font-size: 12px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          text-decoration: none;
          transition: background 160ms ease, border-color 160ms ease, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cp-act:active:not(:disabled) { transform: scale(0.97); }
        .cp-act:disabled { opacity: 0.6; cursor: not-allowed; }
        .cp-act-ghost {
          background: transparent;
          color: #6b6a63;
          border-color: #ebe7df;
        }
        .cp-act-ghost:hover { border-color: #0a0a0a; color: #0a0a0a; background: #faf8f2; }
        .cp-act-primary {
          background: #0a0a0a;
          color: #fafaf7;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.1);
        }
        .cp-act-primary:hover:not(:disabled) { background: #1a1a1a; }

        .cp-spin {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          animation: cp-rot 700ms linear infinite;
        }
        @keyframes cp-rot { to { transform: rotate(360deg); } }

        /* ── Empty ── */
        .cp-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 80px 20px;
          gap: 12px;
          background: #ffffff;
          border: 1px dashed #ebe7df;
          border-radius: 16px;
        }
        .cp-empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 999px;
          background: linear-gradient(135deg, #d4b36e 0%, #a5823c 100%);
          color: #faf8f2;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(165, 130, 60, 0.2);
          margin-bottom: 6px;
        }
        .cp-empty h2 {
          font-family: var(--font-editorial, serif);
          font-size: 24px;
          font-weight: 500;
          font-variation-settings: 'opsz' 48, 'SOFT' 50;
          color: #0a0a0a;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .cp-empty p {
          font-size: 13px;
          color: #6b6a63;
          line-height: 1.55;
          max-width: 360px;
          margin: 0;
        }

        /* ── Modal ── */
        .cp-modal {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(10, 10, 10, 0.6);
          backdrop-filter: blur(8px);
        }
        .cp-modal-card {
          width: 100%;
          max-width: 720px;
          background: #ffffff;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(10, 10, 10, 0.35);
          display: flex;
          flex-direction: column;
          max-height: calc(100vh - 40px);
        }
        .cp-modal-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 16px 20px;
          border-bottom: 1px solid #ebe7df;
          background: #faf8f2;
          flex-shrink: 0;
        }
        .cp-modal-head-title {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-editorial, serif);
          font-size: 15px;
          font-weight: 500;
          color: #0a0a0a;
        }
        .cp-modal-head-title :global(svg) { color: #a5823c; }
        .cp-modal-close {
          width: 36px;
          height: 36px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid #ebe7df;
          color: #6b6a63;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
        }
        .cp-modal-close:hover { background: #0a0a0a; color: #fafaf7; border-color: #0a0a0a; }

        .cp-modal-body {
          padding: 24px;
          flex: 1;
          overflow-y: auto;
        }
        .cp-modal-foot {
          display: flex;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #ebe7df;
          background: #faf8f2;
          flex-shrink: 0;
        }
        .cp-modal-foot .cp-act { flex: 1; }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .cp-grid { grid-template-columns: 1fr; }
          .cp-card { padding: 18px 18px 16px 22px; }
          .cp-modal-body { padding: 16px; }
          .cp-modal-foot { flex-direction: column; }
        }
      `}</style>
    </div>
  );
}
