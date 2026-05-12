'use client';

import dynamic from 'next/dynamic';
import { Info, Calendar, Award, Clock, ShieldCheck, Building2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategoryIcon } from '@/components/shared/category-icon';
import { K, type CategoryOption } from './types';

const RichTextEditor = dynamic(
  () => import('@/components/ui/rich-text-editor').then(m => ({ default: m.RichTextEditor })),
  {
    ssr: false,
    loading: () => <div className="animate-pulse rounded-lg border h-28" style={{ background: K.SURFACE, borderColor: K.BORDER }} />,
  }
);

interface BasicInfoStepProps {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
  categories: readonly CategoryOption[];
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  maxAttempts: number | '';
  setMaxAttempts: (v: number | '') => void;
  examDurationMinutes: number | '';
  setExamDurationMinutes: (v: number | '') => void;
  smgPoints: number | '';
  setSmgPoints: (v: number | '') => void;
  isCompulsory: boolean;
  setIsCompulsory: (v: boolean) => void;
  complianceDeadline: string;
  setComplianceDeadline: (v: string) => void;
  regulatoryBody: string;
  setRegulatoryBody: (v: string) => void;
  renewalPeriodMonths: number | '';
  setRenewalPeriodMonths: (v: number | '') => void;
  /** Cross-step context — Step 3'teki soru sayısı (uyarı için). 0 ise hiç soru yok. */
  questionCount?: number;
  /** Cross-step context — Baraj puanı (Step 3'ten); maxAttempts ile çelişki uyarısı için. */
  passingScore?: number;
}

export default function BasicInfoStep({
  title, setTitle,
  description, setDescription,
  selectedCategory, setSelectedCategory,
  categories,
  startDate, setStartDate,
  endDate, setEndDate,
  maxAttempts, setMaxAttempts,
  examDurationMinutes, setExamDurationMinutes,
  smgPoints, setSmgPoints,
  isCompulsory, setIsCompulsory,
  complianceDeadline, setComplianceDeadline,
  regulatoryBody, setRegulatoryBody,
  renewalPeriodMonths, setRenewalPeriodMonths,
  questionCount = 0,
  passingScore = 70,
}: BasicInfoStepProps) {
  // Cross-step uyarı: 1 deneme + yüksek baraj birleşimi başarısızlık üretir.
  // Compliance riski yok ama UX ipucu — admin bilinçli karar versin.
  const attemptsNum = maxAttempts === '' ? 3 : Number(maxAttempts);
  const showLowAttemptsHighScoreWarning = attemptsNum === 1 && passingScore >= 70;
  // Sınav süresi vs soru sayısı: soru başına ≥18 saniye olması beklenir.
  const examDur = examDurationMinutes === '' ? 30 : Number(examDurationMinutes);
  const showTightExamWarning = questionCount > 0 && examDur > 0 && (examDur * 60) / questionCount < 18;

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: K.PRIMARY_LIGHT }}>
          <Info className="h-5 w-5" style={{ color: K.PRIMARY }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: K.FONT_DISPLAY }}>Eğitim Bilgileri</h3>
          <p className="text-xs" style={{ color: K.TEXT_MUTED }}>Temel bilgileri doldurun</p>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <Label className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>Eğitim Adı *</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="örn. Enfeksiyon Kontrol Eğitimi"
            className="mt-2 h-12 text-base"
            style={{ background: K.BG, borderColor: K.BORDER, borderRadius: 10 }}
          />
        </div>

        <div>
          <Label className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>Kategori *</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
                className="flex items-center gap-2.5 rounded-xl border px-3.5 py-3 duration-200"
                style={{
                  borderColor: selectedCategory === cat.value ? K.PRIMARY : K.BORDER,
                  background: selectedCategory === cat.value ? K.PRIMARY_LIGHT : K.BG,
                  boxShadow: selectedCategory === cat.value ? '0 2px 8px rgba(13, 150, 104, 0.18)' : 'none',
                  transition: 'border-color 200ms ease, background 200ms ease, box-shadow 200ms ease',
                }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: selectedCategory === cat.value
                      ? K.PRIMARY
                      : `color-mix(in srgb, ${cat.color ?? K.PRIMARY} 10%, transparent)`,
                  }}
                >
                  <CategoryIcon
                    name={cat.icon}
                    className="h-4 w-4"
                    style={{
                      color: selectedCategory === cat.value
                        ? '#fff'
                        : (cat.color ?? K.TEXT_MUTED),
                    }}
                  />
                </div>
                <span
                  className="text-sm font-semibold"
                  style={{ color: selectedCategory === cat.value ? K.PRIMARY : K.TEXT_SECONDARY }}
                >
                  {cat.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-medium" style={{ color: K.TEXT_SECONDARY }}>Açıklama</Label>
          <div className="mt-2">
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Eğitim hakkında açıklama yazın..."
              minHeight={100}
            />
          </div>
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: K.TEXT_PRIMARY }}>Eğitim Tarihleri</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="h-3.5 w-3.5" style={{ color: K.INFO }} />
                <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Başlangıç</Label>
              </div>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Calendar className="h-3.5 w-3.5" style={{ color: K.ERROR }} />
                <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Bitiş</Label>
              </div>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
            </div>
          </div>
        </div>

        <div
          className="rounded-xl p-5"
          style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
        >
          <p className="text-sm font-semibold mb-1" style={{ color: K.TEXT_PRIMARY }}>Sınav Ayarları</p>
          <p className="text-[11px] mb-4" style={{ color: K.TEXT_MUTED }}>Baraj puanı &quot;Sınav Soruları&quot; adımında belirlenir — soru sayısına göre otomatik hesaplama yapılır.</p>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Award className="h-3.5 w-3.5" style={{ color: K.WARNING }} />
                <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Deneme Hakkı</Label>
              </div>
              <Input type="number" min={1} max={10} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value ? Number(e.target.value) : '')} placeholder="örn. 3" className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="h-3.5 w-3.5" style={{ color: K.PRIMARY_HOVER }} />
                <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Süre (dk)</Label>
              </div>
              {/* Backend `createTrainingBodySchema` 180 dk max ile validate eder — UI'da
                  daha fazla girip publish'te 400 alma yanlış-pozitifini önlemek için aynı limit. */}
              <Input type="number" min={1} max={180} value={examDurationMinutes} onChange={(e) => setExamDurationMinutes(e.target.value ? Number(e.target.value) : '')} placeholder="örn. 30" className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
              <p className="text-[10px] mt-1" style={{ color: K.TEXT_MUTED }}>maks. 180 dakika</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Award className="h-3.5 w-3.5" style={{ color: K.SUCCESS }} />
                <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>SMG Puanı</Label>
              </div>
              <Input type="number" min={0} max={999} value={smgPoints} onChange={(e) => setSmgPoints(e.target.value ? Number(e.target.value) : '')} placeholder="örn. 10" className="h-10" style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }} />
              <p className="text-[10px] mt-1" style={{ color: K.TEXT_MUTED }}>Eğitim geçilince staff&apos;a yazılacak SMG puanı</p>
            </div>
          </div>

          {/* Cross-step uyarıları — Step 3 verisiyle hesaplanır */}
          {(showLowAttemptsHighScoreWarning || showTightExamWarning) && (
            <div className="mt-4 space-y-2">
              {showLowAttemptsHighScoreWarning && (
                <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: K.WARNING_BG, border: `1.5px solid ${K.WARNING}` }}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: K.WARNING }} />
                  <p className="text-xs" style={{ color: K.TEXT_PRIMARY }}>
                    1 deneme hakkı + {passingScore} puan baraj kombinasyonu personeli kolayca başarısız yapabilir. Daha fazla deneme veya daha düşük baraj puanı önerilir.
                  </p>
                </div>
              )}
              {showTightExamWarning && (
                <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: K.WARNING_BG, border: `1.5px solid ${K.WARNING}` }}>
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: K.WARNING }} />
                  <p className="text-xs" style={{ color: K.TEXT_PRIMARY }}>
                    {examDur} dakikada {questionCount} soru — soru başına ~{Math.round((examDur * 60) / questionCount)} saniye düşer. Sınav süresini artırmayı veya soru sayısını azaltmayı düşünün.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Compliance / Uyum Ayarları */}
        <div
          className="rounded-xl p-5"
          style={{
            background: isCompulsory ? K.WARNING_BG : K.BG,
            border: `1px solid ${isCompulsory ? K.WARNING : K.BORDER}`,
            transition: 'background 150ms ease, border-color 150ms ease',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" style={{ color: isCompulsory ? K.WARNING : K.TEXT_MUTED }} />
              <p className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Zorunlu Eğitim (Uyum)</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCompulsory(!isCompulsory)}
              className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent"
              style={{
                background: isCompulsory ? K.WARNING : K.BORDER,
                transition: 'background 150ms ease',
              }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow"
                style={{
                  transform: isCompulsory ? 'translateX(20px)' : 'translateX(0)',
                  transition: 'transform 150ms ease',
                }}
              />
            </button>
          </div>
          {isCompulsory && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Calendar className="h-3.5 w-3.5" style={{ color: K.WARNING }} />
                  <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Uyum Son Tarihi</Label>
                </div>
                <Input
                  type="date"
                  value={complianceDeadline}
                  onChange={(e) => setComplianceDeadline(e.target.value)}
                  className="h-10"
                  style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 className="h-3.5 w-3.5" style={{ color: K.WARNING }} />
                  <Label className="text-xs font-medium" style={{ color: K.TEXT_MUTED }}>Düzenleyici Kurum</Label>
                </div>
                <Input
                  value={regulatoryBody}
                  onChange={(e) => setRegulatoryBody(e.target.value)}
                  placeholder="örn. Sağlık Bakanlığı, JCI"
                  className="h-10"
                  style={{ background: K.SURFACE, borderColor: K.BORDER, borderRadius: 10 }}
                />
              </div>
            </div>
          )}
          {!isCompulsory && (
            <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
              Bu eğitim zorunlu değil. Zorunlu olarak işaretlerseniz uyum takibi yapılır.
            </p>
          )}
        </div>

        {/* Sertifika Geçerliliği */}
        <div
          className="rounded-xl p-5"
          style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
        >
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw className="h-4 w-4" style={{ color: K.TEXT_MUTED }} />
            <p className="text-sm font-semibold" style={{ color: K.TEXT_PRIMARY }}>Sertifika Geçerliliği</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-medium mb-2 block" style={{ color: K.TEXT_MUTED }}>Sertifika Yenileme Süresi (Ay)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={renewalPeriodMonths}
                onChange={(e) => setRenewalPeriodMonths(e.target.value ? Number(e.target.value) : '')}
                placeholder="örn. 12 (boş = süresiz)"
                className="h-10"
                style={{ background: K.SURFACE, borderColor: K.BORDER, fontFamily: K.FONT_MONO, borderRadius: 10 }}
              />
              <p className="text-xs mt-1.5" style={{ color: K.TEXT_MUTED }}>
                Sertifika bu süre sonunda yenilenmelidir. Boş bırakılırsa süresiz geçerli olur.
              </p>
            </div>
            {isCompulsory && renewalPeriodMonths === '' && (
              <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: K.WARNING_BG, border: `1.5px solid ${K.WARNING}` }}>
                <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" style={{ color: K.WARNING }} />
                <p className="text-xs" style={{ color: K.TEXT_PRIMARY }}>
                  Zorunlu eğitimler için İSG/KVKK denetim gerekliliklerine göre yenileme süresi tanımlanması önerilir.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
