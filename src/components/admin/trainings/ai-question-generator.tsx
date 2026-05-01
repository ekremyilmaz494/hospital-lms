'use client';

/**
 * AI Question Generator — wizard step 3'ün "Yapay Zeka ile Üret" tab içeriği.
 *
 * Akış: PDF kaynak seç → model seç → 10+5 üret → tek tek beğenmediğini sil
 * → "Soruları Ekle" ile manuel question listesine push.
 */

import { useMemo, useState } from 'react';
import {
  Sparkles, FileText, CheckCircle2, Trash2, RefreshCw, AlertCircle,
  Loader2, PlusCircle, Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CURATED_MODELS, DEFAULT_MODEL_ID, getModel } from '@/lib/openrouter-models';
import { K, type VideoItem } from '@/app/admin/trainings/new/_steps/types';
import { useAiQuestionQueue } from '@/hooks/use-ai-question-queue';

export interface AiQuestionGeneratorProps {
  videos: VideoItem[];
  onAdd: (questions: { text: string; options: string[]; correct: number }[]) => void;
}

const tierColors: Record<string, { bg: string; fg: string }> = {
  premium: { bg: '#ede9fe', fg: '#6d28d9' },
  dengeli: { bg: '#dbeafe', fg: '#1d4ed8' },
  hızlı: { bg: '#fef3c7', fg: '#b45309' },
  'uzun-context': { bg: '#cffafe', fg: '#0e7490' },
  'açık-kaynak': { bg: '#f1f5f9', fg: '#475569' },
};

export default function AiQuestionGenerator({ videos, onAdd }: AiQuestionGeneratorProps) {
  // Sadece PDF olan veya documentKey'i olan içerikler kaynak adayı.
  const pdfSources = useMemo(
    () => videos.filter((v) => v.contentType === 'pdf' || !!v.documentKey),
    [videos],
  );

  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    // Varsayılan olarak hepsini seç (admin daha az tıklasın).
    pdfSources.map((v) => v.documentKey || v.url).filter(Boolean) as string[],
  );
  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);

  const selectedModel = getModel(modelId) ?? CURATED_MODELS[0];

  const queue = useAiQuestionQueue({
    sourceS3Keys: selectedKeys,
    model: modelId,
  });

  const toggleSource = (key: string) => {
    setSelectedKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleAdd = () => {
    if (queue.displayed.length === 0) return;
    const mapped = queue.displayed.map((q) => ({
      text: q.questionText,
      options: q.options.slice(0, 4),
      correct: q.correctIndex,
    }));
    onAdd(mapped);
    queue.reset();
  };

  const handleRegenerate = () => {
    queue.reset();
    void queue.generate();
  };

  // Boş PDF kaynak durumu.
  if (pdfSources.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: K.WARNING_BG,
          border: `1.5px dashed ${K.WARNING}`,
          color: K.TEXT_SECONDARY,
        }}
      >
        <FileText className="mx-auto mb-3 h-10 w-10" style={{ color: K.WARNING }} />
        <h3 className="font-semibold text-base mb-1" style={{ color: K.TEXT_PRIMARY, fontFamily: K.FONT_DISPLAY }}>
          PDF kaynağı bulunamadı
        </h3>
        <p className="text-sm" style={{ color: K.TEXT_MUTED }}>
          Önce <strong>İçerik</strong> adımında bir PDF dosyası yükleyin. AI sorularını PDF&apos;ten üretir.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: K.PRIMARY_LIGHT }}
        >
          <Bot className="h-5 w-5" style={{ color: K.PRIMARY }} />
        </div>
        <div>
          <h3 className="text-base font-bold" style={{ fontFamily: K.FONT_DISPLAY, color: K.TEXT_PRIMARY }}>
            Yapay Zeka ile Soru Üret
          </h3>
          <p className="text-xs" style={{ color: K.TEXT_MUTED }}>
            Yüklediğin PDF&apos;ten 10 çoktan seçmeli soru hazırlanır. Beğenmediğini sil — yerine yenisi gelir.
          </p>
        </div>
      </div>

      {/* Source Picker */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
      >
        <p className="text-xs font-semibold mb-1.5" style={{ color: K.TEXT_SECONDARY }}>
          KAYNAK PDF&apos;LER
        </p>
        {pdfSources.map((v) => {
          const key = (v.documentKey || v.url) as string;
          const checked = selectedKeys.includes(key);
          return (
            <label
              key={v.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer"
              style={{
                background: checked ? K.PRIMARY_SOFT : K.SURFACE,
                border: `1.5px solid ${checked ? K.PRIMARY : K.BORDER_SOFT}`,
                transition: 'background 150ms ease, border-color 150ms ease',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleSource(key)}
                style={{ accentColor: K.PRIMARY }}
                className="h-4 w-4"
              />
              <FileText className="h-4 w-4 shrink-0" style={{ color: K.TEXT_MUTED }} />
              <span className="text-sm font-medium truncate" style={{ color: K.TEXT_PRIMARY }}>
                {v.title || v.file?.name || 'Dokuman'}
              </span>
              {typeof v.pageCount === 'number' && (
                <span className="ml-auto text-[11px] shrink-0" style={{ color: K.TEXT_MUTED }}>
                  {v.pageCount} sayfa
                </span>
              )}
            </label>
          );
        })}
      </div>

      {/* Model Selector */}
      <div
        className="rounded-xl p-4"
        style={{ background: K.BG, border: `1.5px solid ${K.BORDER}` }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: K.TEXT_SECONDARY }}>
          AI MODELİ
        </p>
        <select
          value={modelId}
          onChange={(e) => setModelId(e.target.value)}
          className="w-full h-11 px-3 rounded-lg text-sm font-medium"
          style={{
            background: K.SURFACE,
            border: `1.5px solid ${K.BORDER}`,
            color: K.TEXT_PRIMARY,
          }}
        >
          {CURATED_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.tier}
              {m.supportsPdf ? ' ✓ PDF' : ' ⚠ PDF yok'}
            </option>
          ))}
        </select>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{
              background: tierColors[selectedModel.tier]?.bg ?? K.BG_SOFT,
              color: tierColors[selectedModel.tier]?.fg ?? K.TEXT_SECONDARY,
            }}
          >
            {selectedModel.tier}
          </span>
          {selectedModel.supportsPdf ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: K.SUCCESS_BG, color: K.SUCCESS }}
            >
              <CheckCircle2 className="h-3 w-3" /> PDF native
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: K.WARNING_BG, color: K.WARNING }}
            >
              <AlertCircle className="h-3 w-3" /> PDF desteklenmiyor
            </span>
          )}
        </div>
        <p className="text-xs mt-2" style={{ color: K.TEXT_MUTED }}>
          {selectedModel.description}
        </p>
      </div>

      {/* Generate / Regenerate / Add bar */}
      {queue.displayed.length === 0 && !queue.isGenerating && (
        <Button
          onClick={() => void queue.generate()}
          disabled={selectedKeys.length === 0 || queue.isGenerating}
          className="w-full gap-2 h-12 rounded-xl font-semibold text-white"
          style={{
            background: K.PRIMARY,
            boxShadow: '0 4px 12px rgba(13, 150, 104, 0.25)',
            opacity: selectedKeys.length === 0 ? 0.5 : 1,
            transition: 'opacity 150ms ease',
          }}
        >
          <Sparkles className="h-4 w-4" /> 10 Soru Üret
        </Button>
      )}

      {/* Error */}
      {queue.error && (
        <div
          className="rounded-xl px-4 py-3 flex items-start gap-2 text-sm"
          style={{
            background: K.ERROR_BG,
            border: `1.5px solid ${K.ERROR}`,
            color: K.ERROR,
          }}
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{queue.error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {queue.isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: K.TEXT_MUTED }}>
            <Loader2 className="h-4 w-4 animate-spin" /> Sorular hazırlanıyor — bu 30-60 saniye sürebilir.
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-5 animate-pulse"
              style={{ background: K.BG, border: `1.5px solid ${K.BORDER_SOFT}` }}
            >
              <div className="h-4 w-3/4 rounded mb-3" style={{ background: K.BORDER_SOFT }} />
              <div className="space-y-2">
                <div className="h-3 w-full rounded" style={{ background: K.BORDER_SOFT }} />
                <div className="h-3 w-5/6 rounded" style={{ background: K.BORDER_SOFT }} />
                <div className="h-3 w-4/6 rounded" style={{ background: K.BORDER_SOFT }} />
                <div className="h-3 w-3/6 rounded" style={{ background: K.BORDER_SOFT }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Question cards */}
      {queue.displayed.length > 0 && !queue.isGenerating && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: K.TEXT_SECONDARY }}>
              ÜRETİLEN SORULAR ({queue.displayed.length}/10)
            </p>
            {queue.isReplenishing && (
              <span className="inline-flex items-center gap-1.5 text-[11px]" style={{ color: K.TEXT_MUTED }}>
                <Loader2 className="h-3 w-3 animate-spin" />
                Arka planda yenisi hazırlanıyor…
              </span>
            )}
          </div>

          {queue.displayed.map((q, qIdx) => (
            <div
              key={q.clientId}
              className="rounded-xl"
              style={{ background: K.SURFACE, border: `1.5px solid ${K.BORDER}` }}
            >
              <div
                className="flex items-start gap-3 px-5 py-3.5"
                style={{ borderBottom: `1.5px solid ${K.BORDER_SOFT}` }}
              >
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                  style={{ background: K.PRIMARY }}
                >
                  {qIdx + 1}
                </div>
                <p className="flex-1 text-sm font-medium leading-relaxed" style={{ color: K.TEXT_PRIMARY }}>
                  {q.questionText}
                </p>
                <button
                  onClick={() => queue.remove(q.clientId)}
                  className="rounded-lg p-1.5 shrink-0"
                  style={{ color: K.ERROR, transition: 'opacity 150ms ease' }}
                  title="Bu soruyu sil ve yenisini iste"
                  type="button"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5 pt-3 space-y-2">
                {q.options.slice(0, 4).map((opt, optIdx) => {
                  const isCorrect = q.correctIndex === optIdx;
                  return (
                    <div
                      key={optIdx}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                      style={{
                        background: isCorrect ? K.SUCCESS_BG : K.BG,
                        border: `1.5px solid ${isCorrect ? K.SUCCESS : K.BORDER_SOFT}`,
                      }}
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                        style={{
                          background: isCorrect ? K.SUCCESS : K.BG_SOFT,
                          color: isCorrect ? 'white' : K.TEXT_MUTED,
                        }}
                      >
                        {['A', 'B', 'C', 'D'][optIdx]}
                      </span>
                      <span className="flex-1" style={{ color: K.TEXT_PRIMARY }}>
                        {opt}
                      </span>
                      {isCorrect && (
                        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: K.SUCCESS }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Bottom action bar */}
          {queue.displayed.length === 10 && (
            <div
              className="sticky bottom-0 rounded-xl px-4 py-3 flex items-center gap-3"
              style={{
                background: K.SURFACE,
                border: `1.5px solid ${K.PRIMARY}`,
                boxShadow: '0 -4px 12px rgba(15, 23, 42, 0.05)',
              }}
            >
              <Button
                onClick={handleAdd}
                className="flex-1 gap-2 h-11 rounded-xl font-semibold text-white"
                style={{
                  background: K.PRIMARY,
                  transition: 'opacity 150ms ease',
                }}
              >
                <PlusCircle className="h-4 w-4" /> Soruları Ekle (10)
              </Button>
              <Button
                onClick={handleRegenerate}
                variant="outline"
                className="gap-2 h-11 rounded-xl font-semibold"
                style={{
                  borderColor: K.BORDER,
                  color: K.TEXT_SECONDARY,
                  background: K.SURFACE,
                }}
              >
                <RefreshCw className="h-4 w-4" /> Yeniden Üret
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
