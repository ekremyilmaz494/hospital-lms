'use client';

/**
 * Sertifikalarım — "Clinical Editorial" redesign.
 * Artifact (navy+gold belge) korundu — page shell editorial dile taşındı.
 * cream + ink + gold + serif display + mono caps + navy/gold premium artifact.
 */

import { useState } from 'react';
import {
  Award, Download, CheckCircle2, AlertTriangle, Copy, Eye, X, Archive,
} from 'lucide-react';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/components/shared/toast';
import { INK, INK_SOFT, CREAM, RULE, GOLD, OLIVE, CARD_BG } from '@/lib/editorial-palette';

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

/* Certificates-özel navy (premium artifact chrome) — editorial palette'te yok. */
const NAVY = '#0b1e3f';

/* ════════════════════════════════════════════════════════
   PRESERVED: Gold seal + Certificate artifact (belgenin kendisi)
   ════════════════════════════════════════════════════════ */

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

function CertificatePreview({ cert }: { cert: Certificate }) {
  const fullName = cert.user ? `${cert.user.firstName ?? ''} ${cert.user.lastName ?? ''}`.trim() : '';
  const orgLogo = (cert.user?.organization as { logoUrl?: string | null } | undefined)?.logoUrl ?? '/logos/devakent.png';
  const issued = new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
  const expiryLabel = cert.expiresAt
    ? `${new Date(cert.expiresAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}${cert.isExpired ? ' (Süresi Dolmuş)' : ''}`
    : 'Süresiz';

  const ART_NAVY = '#0b1e3f';
  const ART_NAVY_DARK = '#06142d';
  const ART_NAVY_MID = '#16305a';
  const ART_GOLD = '#c9a961';
  const ART_GOLD_DARK = '#a5823c';
  const ART_GOLD_LIGHT = '#e6c88a';
  const ART_CREAM = '#faf6eb';

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      style={{
        background: ART_CREAM,
        borderRadius: '4px',
        aspectRatio: '1.414 / 1',
        minHeight: '300px',
        border: `1px solid ${ART_GOLD}`,
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0" style={{ width: '30%', height: '40%' }}>
          <div className="absolute inset-0" style={{ background: ART_NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        <div className="absolute top-0 right-0" style={{ width: '30%', height: '40%', transform: 'scaleX(-1)' }}>
          <div className="absolute inset-0" style={{ background: ART_NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        <div className="absolute bottom-0 left-0" style={{ width: '30%', height: '40%', transform: 'scaleY(-1)' }}>
          <div className="absolute inset-0" style={{ background: ART_NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
        <div className="absolute bottom-0 right-0" style={{ width: '30%', height: '40%', transform: 'scale(-1, -1)' }}>
          <div className="absolute inset-0" style={{ background: ART_NAVY, clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_DARK, clipPath: 'polygon(0 0, 72% 0, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD, clipPath: 'polygon(72% 0, 82% 0, 0 82%, 0 75%)' }} />
          <div className="absolute inset-0" style={{ background: ART_NAVY_MID, clipPath: 'polygon(82% 0, 100% 0, 0 100%, 0 82%)' }} />
          <div className="absolute inset-0" style={{ background: ART_GOLD_LIGHT, clipPath: 'polygon(40% 0, 42% 0, 0 42%, 0 40%)' }} />
        </div>
      </div>

      <div className="relative h-full flex flex-col items-center justify-between px-8 pt-6 pb-4 sm:px-14 sm:pt-7 sm:pb-5" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
        <div className="flex flex-col items-center gap-1 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={orgLogo} alt="Hastane Logosu" className="h-10 sm:h-12 object-contain" style={{ maxWidth: '55%' }} />
          <h1 className="text-[22px] sm:text-[30px] font-bold tracking-[0.05em] mt-1" style={{ color: ART_GOLD_DARK, letterSpacing: '0.08em' }}>
            BAŞARI SERTİFİKASI
          </h1>
          <div className="flex items-center gap-2 w-full max-w-[60%] mt-0.5">
            <div className="flex-1 h-px" style={{ background: ART_GOLD }} />
            <div className="w-1.5 h-1.5 rotate-45" style={{ background: ART_GOLD }} />
            <div className="flex-1 h-px" style={{ background: ART_GOLD }} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-[10px] sm:text-[11px] italic" style={{ color: '#6e737d' }}>Bu sertifika,</p>
          {fullName && (
            <p className="text-[18px] sm:text-[24px] font-bold tracking-wide uppercase" style={{ color: ART_NAVY, fontFamily: 'system-ui, sans-serif' }}>
              {fullName}
            </p>
          )}
          <p className="text-[11px] sm:text-[13px] font-semibold max-w-[70%] leading-tight" style={{ color: ART_NAVY_MID }}>
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
              <div style={{ color: ART_GOLD_DARK }} className="font-bold mt-0.5">Sınav Puanı: %{cert.score}</div>
            )}
          </div>
        </div>

        <div className="w-full flex items-end justify-between px-2" style={{ fontFamily: 'system-ui, sans-serif' }}>
          <div className="flex flex-col items-center gap-0.5" style={{ width: '28%' }}>
            <div className="h-px w-full" style={{ background: ART_NAVY }} />
            <span className="text-[9px] font-bold" style={{ color: ART_NAVY }}>Yetkili İmza</span>
            <span className="text-[7px]" style={{ color: '#6e737d' }}>Official</span>
          </div>
          <div className="flex flex-col items-center -mb-1">
            <GoldSeal />
          </div>
          <div className="flex flex-col items-center gap-0.5" style={{ width: '28%' }}>
            <div className="h-px w-full" style={{ background: ART_NAVY }} />
            <span className="text-[9px] font-bold" style={{ color: ART_NAVY }}>Eğitmen İmza</span>
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

/* ════════════════════════════════════════════════════════
   Page
   ════════════════════════════════════════════════════════ */

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

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => toast('Sertifika kodu kopyalandı', 'success'));
  };

  const certificates = data ?? [];
  const active = certificates.filter(c => !c.isExpired).length;
  const expired = certificates.length - active;

  return (
    <div
      className="relative -mx-4 -my-4 md:-mx-8 md:-my-8 min-h-full"
      style={{
        backgroundColor: CREAM,
        color: INK,
        fontFamily: 'var(--font-inter), Inter, system-ui, sans-serif',
      }}
    >
      <div className="relative px-4 sm:px-10 lg:px-16 pt-5 pb-16">
        {/* ───── Masthead ───── */}
        <header
          className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 pb-5"
          style={{ borderBottom: `3px solid ${INK}` }}
        >
          <div className="flex items-end gap-4">
            <h1
              className="text-[36px] sm:text-[48px] leading-[0.95] font-semibold tracking-[-0.025em]"
              style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              başarı arşivi<span style={{ color: GOLD }}>.</span>
            </h1>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <SummaryStat label="Toplam" value={certificates.length} tone={INK} />
            <span className="h-8 w-px" style={{ backgroundColor: RULE }} />
            <SummaryStat label="Aktif" value={active} tone={OLIVE} />
            {expired > 0 && (
              <>
                <span className="h-8 w-px" style={{ backgroundColor: RULE }} />
                <SummaryStat label="Süresi dolmuş" value={expired} tone="#b3261e" />
              </>
            )}
          </div>
        </header>

        <p
          className="mt-3 text-[12px] uppercase tracking-[0.16em]"
          style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
        >
          Tamamladığın eğitimlerin resmi belgeleri · PDF olarak indirilebilir
        </p>

        {isLoading ? (
          <CertificatesSkeleton />
        ) : error ? (
          <div
            className="mt-10 grid items-start gap-4 p-5"
            style={{
              gridTemplateColumns: '6px 44px 1fr',
              backgroundColor: '#fdf5f2',
              borderTop: `1px solid #e9c9c0`,
              borderRight: `1px solid #e9c9c0`,
              borderBottom: `1px solid #e9c9c0`,
              borderRadius: '4px',
            }}
          >
            <span style={{ backgroundColor: '#b3261e', alignSelf: 'stretch', borderRadius: '2px' }} />
            <div
              className="flex items-center justify-center"
              style={{ width: 44, height: 44, backgroundColor: '#b3261e', borderRadius: '2px' }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: CREAM }} />
            </div>
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: '#b3261e', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                Yükleme hatası
              </p>
              <p className="mt-1 text-[14px]" style={{ color: '#7a1d14' }}>{error}</p>
            </div>
          </div>
        ) : certificates.length === 0 ? (
          <div
            className="mt-10 flex flex-col items-center justify-center text-center px-6 py-20"
            style={{
              border: `1px dashed ${GOLD}`,
              borderRadius: '4px',
              backgroundColor: 'rgba(201, 169, 97, 0.04)',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 56, height: 56,
                backgroundColor: NAVY,
                border: `2px solid ${GOLD}`,
                borderRadius: '2px',
              }}
            >
              <Award style={{ width: 24, height: 24, color: GOLD }} />
            </div>
            <p
              className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              Boş arşiv
            </p>
            <p
              className="mt-2 text-[20px] font-semibold tracking-[-0.01em]"
              style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              Henüz sertifikan yok
            </p>
            <p className="mt-1 max-w-md text-[13px]" style={{ color: INK_SOFT }}>
              Eğitimleri başarıyla tamamladığında sertifikaların bu arşivde görünecek.
            </p>
          </div>
        ) : (
          <section className="mt-10">
            <header
              className="grid items-end gap-4 pb-3"
              style={{ gridTemplateColumns: '40px 1fr max-content', borderBottom: `3px solid ${GOLD}` }}
            >
              <span
                className="text-[13px] font-semibold tracking-[0.2em]"
                style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                §
              </span>
              <div>
                <h2
                  className="text-[22px] leading-tight font-semibold tracking-[-0.02em]"
                  style={{ fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                >
                  Belge arşivi
                </h2>
                <p
                  className="mt-0.5 text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                >
                  Kronolojik sıra — en yeni üstte
                </p>
              </div>
              <span
                className="text-[11px] font-semibold tabular-nums"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                [{certificates.length.toString().padStart(2, '0')}]
              </span>
            </header>

            <div
              className="mt-5 grid gap-4"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
            >
              {certificates.map((cert, i) => (
                <CertificateCard
                  key={cert.id}
                  cert={cert}
                  index={i + 1}
                  pdfLoading={pdfLoading}
                  onPreview={() => setSelected(cert)}
                  onDownload={() => handleDownloadPDF(cert)}
                  onCopy={() => copyCode(cert.certificateCode)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ═══════ Preview Modal ═══════ */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(6, 16, 33, 0.72)', backdropFilter: 'blur(6px)' }}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: CREAM,
              border: `1px solid ${INK}`,
              borderRadius: '4px',
              boxShadow: '0 20px 60px rgba(6, 16, 33, 0.4)',
            }}
          >
            <header
              className="flex items-center justify-between px-5 py-3"
              style={{ borderBottom: `2px solid ${INK}` }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 32, height: 32,
                    backgroundColor: NAVY,
                    border: `1px solid ${GOLD}`,
                    borderRadius: '2px',
                  }}
                >
                  <Award className="h-4 w-4" style={{ color: GOLD }} />
                </span>
                <div>
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
                  >
                    № {selected.certificateCode.slice(-6).toUpperCase()}
                  </p>
                  <h3
                    className="text-[16px] font-semibold tracking-[-0.01em]"
                    style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
                  >
                    Sertifika önizlemesi
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                aria-label="Kapat"
                className="flex items-center justify-center"
                style={{
                  width: 32, height: 32,
                  color: INK_SOFT,
                  border: `1px solid ${RULE}`,
                  borderRadius: '2px',
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 overflow-auto p-5 sm:p-8" style={{ backgroundColor: CREAM }}>
              <CertificatePreview cert={selected} />
            </div>

            <footer
              className="flex items-center justify-end gap-2 px-5 py-3"
              style={{ borderTop: `1px solid ${RULE}`, backgroundColor: 'rgba(10, 22, 40, 0.02)' }}
            >
              <button
                onClick={() => setSelected(null)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  color: INK,
                  border: `1px solid ${INK}`,
                  borderRadius: '2px',
                  backgroundColor: 'transparent',
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                }}
              >
                Kapat
              </button>
              <button
                disabled={pdfLoading}
                onClick={() => selected && handleDownloadPDF(selected)}
                className="inline-flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{
                  color: CREAM,
                  backgroundColor: NAVY,
                  border: `1px solid ${GOLD}`,
                  borderRadius: '2px',
                  opacity: pdfLoading ? 0.7 : 1,
                  fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
                }}
              >
                {pdfLoading ? (
                  <>
                    <span
                      className="inline-block h-3 w-3 animate-spin rounded-full"
                      style={{ border: `2px solid ${GOLD}`, borderTopColor: 'transparent' }}
                    />
                    Oluşturuluyor
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" style={{ color: GOLD }} />
                    PDF İndir
                  </>
                )}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Atoms
   ───────────────────────────────────────────────────── */

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="flex flex-col items-start">
      <span
        className="text-[9px] font-semibold uppercase tracking-[0.2em] leading-none"
        style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
      >
        {label}
      </span>
      <span
        className="mt-1 text-[22px] font-semibold leading-none tracking-[-0.02em]"
        style={{ color: tone, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
      >
        {value.toString().padStart(2, '0')}
      </span>
    </div>
  );
}

function CertificateCard({
  cert, index, pdfLoading, onPreview, onDownload, onCopy,
}: {
  cert: Certificate; index: number; pdfLoading: boolean;
  onPreview: () => void; onDownload: () => void; onCopy: () => void;
}) {
  const isExpired = cert.isExpired;
  const railColor = isExpired ? '#b3261e' : GOLD;
  const issued = new Date(cert.issuedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <article
      className="group relative overflow-hidden flex flex-col"
      style={{
        backgroundColor: CARD_BG,
        borderTop: `1px solid ${RULE}`,
        borderRight: `1px solid ${RULE}`,
        borderBottom: `1px solid ${RULE}`,
        borderLeft: `6px solid ${railColor}`,
        borderRadius: '4px',
        transition: 'box-shadow 200ms ease, transform 220ms ease',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(10, 22, 40, 0.08)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {/* Top navy band with medal */}
      <div
        className="relative flex items-center justify-between px-4 py-3"
        style={{
          backgroundColor: isExpired ? '#2a0f0c' : NAVY,
          borderBottom: `2px solid ${GOLD}`,
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="flex items-center justify-center"
            style={{
              width: 32, height: 32,
              backgroundColor: 'rgba(201, 169, 97, 0.15)',
              border: `1px solid ${GOLD}`,
              borderRadius: '2px',
            }}
          >
            <Award className="h-4 w-4" style={{ color: GOLD }} />
          </span>
          <div>
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: GOLD, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              № {index.toString().padStart(3, '0')}
            </p>
            <p
              className="text-[10px] uppercase tracking-[0.14em]"
              style={{ color: 'rgba(250, 247, 242, 0.55)', fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              Başarı Sertifikası
            </p>
          </div>
        </div>
        {isExpired ? (
          <span
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
            style={{
              color: '#fef6e7', backgroundColor: '#b3261e',
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            <AlertTriangle className="h-3 w-3" />
            DOLDU
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
            style={{
              color: NAVY, backgroundColor: GOLD,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            <CheckCircle2 className="h-3 w-3" />
            AKTİF
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-4">
        <h3
          className="text-[16px] font-semibold tracking-[-0.01em] leading-snug"
          style={{
            color: INK,
            fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {cert.training.title}
        </h3>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {cert.training.category && (
            <span
              className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
              style={{
                color: INK_SOFT, backgroundColor: 'rgba(0,0,0,0.04)',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
            >
              {cert.training.category.toUpperCase()}
            </span>
          )}
          {cert.training.isArchived && (
            <span
              className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] leading-none"
              style={{
                color: '#8a5a11', backgroundColor: '#f4efdf',
                fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              }}
              title="Eğitim arşivlendi — sertifika geçerliliğini korur"
            >
              <Archive className="h-2.5 w-2.5" />
              ARŞİV
            </span>
          )}
        </div>

        {/* Metrics */}
        <div
          className="mt-3 grid"
          style={{
            gridTemplateColumns: '1fr 1fr',
            border: `1px solid ${RULE}`,
            borderRadius: '2px',
          }}
        >
          <div className="px-3 py-2" style={{ borderRight: `1px solid ${RULE}` }}>
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              Puan
            </p>
            <p className="mt-0.5 flex items-baseline gap-0.5">
              <span
                className="text-[24px] font-semibold tabular-nums leading-none tracking-[-0.025em]"
                style={{ color: OLIVE, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
              >
                {cert.score}
              </span>
              <span
                className="text-[11px] font-semibold"
                style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
              >
                %
              </span>
            </p>
          </div>
          <div className="px-3 py-2">
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.16em]"
              style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
            >
              Tarih
            </p>
            <p
              className="mt-0.5 text-[14px] font-semibold tracking-[-0.01em]"
              style={{ color: INK, fontFamily: 'var(--font-plus-jakarta-sans), "Plus Jakarta Sans", serif' }}
            >
              {issued}
            </p>
          </div>
        </div>

        {/* Code row */}
        <div
          className="mt-3 flex items-center gap-2 px-2.5 py-1.5"
          style={{
            backgroundColor: 'rgba(10, 22, 40, 0.03)',
            border: `1px solid ${RULE}`,
            borderRadius: '2px',
          }}
        >
          <span
            className="text-[9px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: INK_SOFT, fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace' }}
          >
            KOD
          </span>
          <code
            className="flex-1 text-[11px] truncate tabular-nums"
            style={{
              color: INK,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
              letterSpacing: '0.04em',
            }}
          >
            {cert.certificateCode}
          </code>
          <button
            onClick={onCopy}
            aria-label="Kodu kopyala"
            className="flex items-center justify-center shrink-0"
            style={{
              width: 22, height: 22,
              color: INK_SOFT,
              border: `1px solid ${RULE}`,
              borderRadius: '2px',
              backgroundColor: CARD_BG,
              transition: 'color 160ms ease, border-color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = GOLD; e.currentTarget.style.borderColor = GOLD; }}
            onMouseLeave={e => { e.currentTarget.style.color = INK_SOFT; e.currentTarget.style.borderColor = RULE; }}
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>

        {/* Actions */}
        <div className="mt-3 flex gap-2 mt-auto pt-3">
          <button
            onClick={onPreview}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              color: INK,
              border: `1px solid ${INK}`,
              borderRadius: '2px',
              backgroundColor: 'transparent',
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            <Eye className="h-3 w-3" style={{ color: GOLD }} />
            Önizle
          </button>
          <button
            disabled={pdfLoading}
            onClick={onDownload}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{
              color: CREAM,
              backgroundColor: NAVY,
              border: `1px solid ${GOLD}`,
              borderRadius: '2px',
              opacity: pdfLoading ? 0.7 : 1,
              fontFamily: 'var(--font-jetbrains-mono), ui-monospace, monospace',
            }}
          >
            <Download className="h-3 w-3" style={{ color: GOLD }} />
            {pdfLoading ? '…' : 'İndir'}
          </button>
        </div>
      </div>
    </article>
  );
}

function CertificatesSkeleton() {
  return (
    <div className="mt-10">
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-72" style={{ backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: '4px' }} />
        ))}
      </div>
    </div>
  );
}
