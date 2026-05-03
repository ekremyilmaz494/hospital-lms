'use client';

/**
 * AI Question Generator — wizard step 3'ün "Yapay Zeka ile Üret" tab içeriği.
 *
 * Akış: PDF kaynak seç → model seç → 10+5 üret → tek tek beğenmediğini sil
 * → "Soruları Ekle" ile manuel question listesine push.
 *
 * Tasarım: Editorial-clinical refinement. Sol sütun = sticky karar paneli,
 * sağ sütun = sonuçlar. Editorial italic Georgia hero, emerald aksanlar,
 * staggered CSS entrance animasyonları.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Sparkles, CheckCircle2, Trash2, RefreshCw, AlertCircle,
  Loader2, PlusCircle, Zap, ChevronDown, FileCheck2, BookOpenCheck,
  UploadCloud, X,
} from 'lucide-react';
import { CURATED_MODELS, DEFAULT_MODEL_ID, getModel } from '@/lib/openrouter-models';
import { K } from '@/app/admin/trainings/new/_steps/types';
import { useAiQuestionQueue } from '@/hooks/use-ai-question-queue';

export interface AiQuestionGeneratorProps {
  onAdd: (questions: { text: string; options: string[]; correct: number }[]) => void;
  /** Manuel sekmede admin'in yazdığı dolu sorular — AI dedup ve hedef toplam
   * hesabı için. Caller boş şablonları filtrelemiş olmalı. */
  manualQuestions: { text: string }[];
  /** Henüz "Soruları Ekle" basılmamış ama üretilmiş soru sayısı.
   *  Parent step navigation'ı engellemek için kullanır. */
  onPendingChange?: (count: number) => void;
}

interface UploadedSource {
  s3Key: string;
  fileName: string;
  sizeBytes: number;
  pageCount?: number;
}

const MAX_SOURCES = 3;
const MAX_TOTAL_SIZE_MB = 30;
const ACCEPTED_TYPES = ['application/pdf'];

// Tier rozetleri için sıkı emerald tabanlı sofistike palet — varsayılan medikal AI
// renk kombinasyonlarından (mor/mavi gradient) kaçınıyoruz.
const tierStyles: Record<string, { dot: string; label: string; bg: string }> = {
  premium: { dot: '#0d9668', label: '#065f46', bg: '#ecfdf5' },
  dengeli: { dot: '#0891b2', label: '#155e75', bg: '#ecfeff' },
  hızlı: { dot: '#d97706', label: '#92400e', bg: '#fffbeb' },
  'uzun-context': { dot: '#7c3aed', label: '#5b21b6', bg: '#f5f3ff' },
  'açık-kaynak': { dot: '#475569', label: '#1e293b', bg: '#f1f5f9' },
};

const FONT_EDITORIAL = "var(--font-editorial, Georgia, serif)";

export default function AiQuestionGenerator({ onAdd, manualQuestions, onPendingChange }: AiQuestionGeneratorProps) {
  const [uploadedSources, setUploadedSources] = useState<UploadedSource[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [modelId, setModelId] = useState<string>(DEFAULT_MODEL_ID);
  const selectedModel = getModel(modelId) ?? CURATED_MODELS[0];
  const tierColor = tierStyles[selectedModel.tier] ?? tierStyles.premium;

  // Hastane sınavlarında toplam soru sayısı sabit 10. AI sadece manuel'in
  // tamamlamadığı kadarını üretir; ek 5 yedek hook içinde otomatik gelir.
  const TOTAL_TARGET = 10;
  const manualCount = manualQuestions.length;
  const aiCountToGenerate = Math.max(0, TOTAL_TARGET - manualCount);

  // staticExcluded: manuel soruların metinleri — AI'ya "bunları tekrar etme" demek için
  const staticExcluded = useMemo(
    () => manualQuestions.map((q) => ({ text: q.text })),
    [manualQuestions],
  );

  const selectedKeys = useMemo(() => uploadedSources.map((s) => s.s3Key), [uploadedSources]);

  const queue = useAiQuestionQueue({
    sourceS3Keys: selectedKeys,
    model: modelId,
    displayTarget: aiCountToGenerate,
    staticExcluded,
  });

  // Üretilmiş ama henüz "Soruları Ekle" ile manuel listeye taşınmamış sayıyı parent'a bildir.
  // Parent step 3 validation'ında bunu kullanarak ileri geçişi engeller.
  // Unmount olduğunda 0 döneriz: tab değiştiğinde queue zaten kaybolur.
  useEffect(() => {
    onPendingChange?.(queue.displayed.length);
    return () => onPendingChange?.(0);
  }, [queue.displayed.length, onPendingChange]);

  const removeSource = (s3Key: string) => {
    setUploadedSources((prev) => prev.filter((s) => s.s3Key !== s3Key));
  };

  const uploadFile = useCallback(async (file: File) => {
    setUploadError(null);
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError(`${file.name}: sadece PDF dosyaları kabul edilir.`);
      return;
    }
    if (uploadedSources.length >= MAX_SOURCES) {
      setUploadError(`En fazla ${MAX_SOURCES} kaynak yüklenebilir.`);
      return;
    }
    const totalMb = (uploadedSources.reduce((sum, s) => sum + s.sizeBytes, 0) + file.size) / (1024 * 1024);
    if (totalMb > MAX_TOTAL_SIZE_MB) {
      setUploadError(`Toplam dosya boyutu ${MAX_TOTAL_SIZE_MB}MB'ı aşamaz.`);
      return;
    }
    setUploading(true);
    try {
      // Aşama 1: Vercel function'dan presigned URL al (sadece JSON, body limit yok).
      const presignRes = await fetch('/api/upload/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || 'application/pdf',
        }),
      });
      if (!presignRes.ok) {
        const body = (await presignRes.json().catch(() => ({}))) as { error?: string };
        setUploadError(body.error ?? `Yükleme hazırlığı başarısız (${presignRes.status}).`);
        return;
      }
      const presign = (await presignRes.json()) as { uploadUrl: string; key: string; fileName: string };

      // Aşama 2: Browser → S3 doğrudan PUT (Vercel function bypass, body limit yok).
      // Content-Type S3 imzasıyla birebir eşleşmeli.
      const putRes = await fetch(presign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/pdf' },
        body: file,
      });
      if (!putRes.ok) {
        setUploadError(`S3 yüklemesi başarısız (${putRes.status}).`);
        return;
      }

      setUploadedSources((prev) => [
        ...prev,
        { s3Key: presign.key, fileName: presign.fileName, sizeBytes: file.size },
      ]);
    } catch {
      setUploadError('Ağ hatası — yükleme tamamlanamadı.');
    } finally {
      setUploading(false);
    }
  }, [uploadedSources]);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((f) => void uploadFile(f));
  }, [uploadFile]);

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

  const hasResults = queue.displayed.length > 0;
  const showInitialUi = !hasResults && !queue.isGenerating;

  return (
    <>
      <Styles />

      <div className="aiq-root">
        {/* Sol sticky panel — kararlar */}
        <aside className="aiq-sidebar">
          <div className="aiq-hero">
            <div className="aiq-hero-tag">
              <Sparkles size={11} strokeWidth={2.5} />
              <span>YAPAY ZEKA</span>
            </div>
            <h2 className="aiq-hero-title">
              Soruyu <em>kaynak</em>
              <br />
              üretsin.
            </h2>
            <p className="aiq-hero-sub">
              Yüklediğin PDF&apos;ten çoktan seçmeli soru. Beğenmediğini sil — yerine yenisi gelir.
            </p>
          </div>

          {/* Adım 1 — Kaynak Yükle */}
          <section className="aiq-section">
            <header className="aiq-section-head">
              <span className="aiq-step-num">01</span>
              <span className="aiq-step-label">Kaynak PDF</span>
              <span className="aiq-section-count">{uploadedSources.length}/{MAX_SOURCES}</span>
            </header>

            {uploadedSources.length > 0 && (
              <ul className="aiq-source-list">
                {uploadedSources.map((src) => (
                  <li key={src.s3Key}>
                    <div className="aiq-source aiq-source--on aiq-source--uploaded">
                      <span className="aiq-source-check">
                        <CheckCircle2 size={14} strokeWidth={2.5} />
                      </span>
                      <span className="aiq-source-info">
                        <span className="aiq-source-name">{src.fileName}</span>
                        <span className="aiq-source-meta">
                          <BookOpenCheck size={11} strokeWidth={2} />
                          {(src.sizeBytes / 1024 / 1024).toFixed(1)} MB
                        </span>
                      </span>
                      <button
                        type="button"
                        className="aiq-source-remove"
                        onClick={() => removeSource(src.s3Key)}
                        aria-label="Kaldır"
                        title="Bu kaynağı kaldır"
                      >
                        <X size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {uploadedSources.length < MAX_SOURCES && (
              <label
                className={
                  dragOver ? 'aiq-uploader aiq-uploader--drag' : 'aiq-uploader'
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => {
                    handleFiles(e.target.files);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  style={{ display: 'none' }}
                />
                <div className="aiq-uploader-icon">
                  {uploading ? (
                    <Loader2 size={20} strokeWidth={2} className="aiq-spin-icon" />
                  ) : (
                    <UploadCloud size={20} strokeWidth={2} />
                  )}
                </div>
                <div className="aiq-uploader-text">
                  <span className="aiq-uploader-title">
                    {uploading ? 'Yükleniyor…' : 'PDF sürükle veya seçmek için tıkla'}
                  </span>
                  <span className="aiq-uploader-hint">
                    Maks {MAX_SOURCES} dosya · toplam {MAX_TOTAL_SIZE_MB}MB
                  </span>
                </div>
              </label>
            )}

            {uploadError && (
              <p className="aiq-source-error">
                <AlertCircle size={11} strokeWidth={2.5} />
                {uploadError}
              </p>
            )}
          </section>

          {/* Adım 2 — Model */}
          <section className="aiq-section">
            <header className="aiq-section-head">
              <span className="aiq-step-num">02</span>
              <span className="aiq-step-label">Yapay Zeka Modeli</span>
            </header>
            <div className="aiq-model-select-wrap">
              <span className="aiq-model-tier-dot" style={{ background: tierColor.dot }} />
              <select
                className="aiq-model-select"
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
              >
                {CURATED_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} — {m.tier}{m.supportsPdf ? '' : ' (PDF yok)'}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="aiq-model-chevron" />
            </div>
            <div className="aiq-model-meta">
              <span
                className="aiq-tier-pill"
                style={{ background: tierColor.bg, color: tierColor.label }}
              >
                {selectedModel.tier}
              </span>
              {selectedModel.supportsPdf ? (
                <span className="aiq-pdf-pill aiq-pdf-pill--on">
                  <FileCheck2 size={11} strokeWidth={2.5} /> PDF native
                </span>
              ) : (
                <span className="aiq-pdf-pill aiq-pdf-pill--off">
                  <AlertCircle size={11} strokeWidth={2.5} /> PDF yok
                </span>
              )}
            </div>
            <p className="aiq-model-desc">{selectedModel.description}</p>
          </section>

          {/* Generate / regenerate */}
          {showInitialUi && (
            <button
              type="button"
              className="aiq-cta"
              disabled={selectedKeys.length === 0 || aiCountToGenerate === 0}
              onClick={() => void queue.generate()}
            >
              <span className="aiq-cta-icon">
                <Zap size={16} strokeWidth={2.5} />
              </span>
              <span className="aiq-cta-label">
                {aiCountToGenerate === 0
                  ? 'AI üretmesi gerekmez'
                  : `${aiCountToGenerate} Soru Üret`}
              </span>
              <span className="aiq-cta-hint">~30s</span>
            </button>
          )}

          {hasResults && (
            <div className="aiq-action-stack">
              <button
                type="button"
                className="aiq-cta"
                onClick={handleAdd}
                disabled={queue.displayed.length === 0}
              >
                <span className="aiq-cta-icon">
                  <PlusCircle size={16} strokeWidth={2.5} />
                </span>
                <span className="aiq-cta-label">
                  Soruları Ekle <em>({queue.displayed.length})</em>
                </span>
              </button>
              <button
                type="button"
                className="aiq-cta-secondary"
                onClick={handleRegenerate}
              >
                <RefreshCw size={13} strokeWidth={2.5} />
                Tümünü Yeniden Üret
              </button>
            </div>
          )}

          {queue.error && (
            <div className="aiq-error">
              <AlertCircle size={14} strokeWidth={2.5} />
              <span>{queue.error}</span>
            </div>
          )}
        </aside>

        {/* Sağ sütun — sonuçlar */}
        <main className="aiq-results">
          {/* Empty result state — admin generate butonuna basmadan önce */}
          {showInitialUi && (
            <div className="aiq-results-empty">
              <div className="aiq-results-empty-bg" />
              <div className="aiq-results-empty-content">
                <span className="aiq-results-empty-mono">
                  {aiCountToGenerate > 0
                    ? `${aiCountToGenerate} SORU · KAYNAK GROUNDED · ~30 SANİYE`
                    : 'TOPLAM 10 SORU · MANUEL YETERLİ'}
                </span>
                <h3>
                  {aiCountToGenerate > 0 ? (
                    <>Üretmeye <em>hazır</em>.</>
                  ) : manualCount > TOTAL_TARGET ? (
                    <>Manuel <em>fazla</em>.</>
                  ) : (
                    <>Manuel <em>yetiyor</em>.</>
                  )}
                </h3>
                {manualCount > TOTAL_TARGET ? (
                  <p>
                    Manuel sekmede <strong>{manualCount}</strong> soru var; toplam hedef <em>10</em>. Sınavın 10 soruluk olması için Manuel&apos;den <strong>{manualCount - TOTAL_TARGET}</strong> soru sil veya bu sekmeyi atla.
                  </p>
                ) : manualCount === TOTAL_TARGET ? (
                  <p>
                    Manuel&apos;de tam <em>10</em> sorun var. AI&apos;ya gerek yok — &ldquo;Sonraki Adım&rdquo;a geçebilirsin.
                  </p>
                ) : manualCount > 0 ? (
                  <p>
                    Manuel sekmedeki <strong>{manualCount}</strong> sorun korunuyor. AI <strong>{aiCountToGenerate}</strong> soru daha üretecek; toplam <em>10</em>&apos;a ulaşacak.
                  </p>
                ) : (
                  <p>
                    Sistem <em>{aiCountToGenerate + 5}</em> soru üretecek. {aiCountToGenerate} tanesi burada görünür, 5 tanesi yedek olarak sahne arkasında bekler.
                  </p>
                )}
                {aiCountToGenerate > 0 && (
                  <p>
                    Bir soruyu sildiğinde — kuyruktan biri anında onun yerini alır. Hep <em>{aiCountToGenerate} soru</em>.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Loading state */}
          {queue.isGenerating && (
            <div className="aiq-loading">
              <div className="aiq-loading-banner">
                <div className="aiq-spin">
                  <Loader2 size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <p className="aiq-loading-title">Sorular hazırlanıyor</p>
                  <p className="aiq-loading-hint">
                    {selectedModel.label} kaynağı okuyor. 30-60 saniye sürebilir.
                  </p>
                </div>
              </div>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aiq-skeleton" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className="aiq-skeleton-head">
                    <div className="aiq-skeleton-num" />
                    <div className="aiq-skeleton-line aiq-skeleton-line--3" />
                  </div>
                  <div className="aiq-skeleton-opts">
                    <div className="aiq-skeleton-line" />
                    <div className="aiq-skeleton-line aiq-skeleton-line--2" />
                    <div className="aiq-skeleton-line aiq-skeleton-line--3" />
                    <div className="aiq-skeleton-line" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Results */}
          {hasResults && !queue.isGenerating && (
            <>
              {/* Kullanıcının "Soruları Ekle" butonuna basmadan ilerlemesini önlemek için inline uyarı.
                  Parent step 3 validation da geçişi engeller, bu görsel hatırlatma içindir. */}
              <div className="aiq-pending-banner" role="alert">
                <AlertCircle size={16} strokeWidth={2.5} />
                <div className="aiq-pending-banner-text">
                  <strong>Bu sorular henüz kaydedilmedi.</strong>
                  <span>
                    Eğitime eklemek için solda <em>&ldquo;Soruları Ekle ({queue.displayed.length})&rdquo;</em> butonuna bas. Aksi halde sınava dahil edilmezler.
                  </span>
                </div>
              </div>

              <div className="aiq-results-head">
                <div>
                  <h3 className="aiq-results-title">
                    <em>{queue.displayed.length}</em> soru hazır
                  </h3>
                  <p className="aiq-results-sub">
                    Beğenmediğin soruyu sil — yerine yenisi otomatik gelecek.
                  </p>
                </div>
                <div className="aiq-results-meta">
                  {queue.queue.length > 0 && (
                    <span className="aiq-buffer-tag" title="Yedek sorular sahne arkasında bekliyor">
                      <span className="aiq-buffer-num">+{queue.queue.length}</span>
                      <span className="aiq-buffer-label">yedek hazır</span>
                    </span>
                  )}
                  {queue.isReplenishing && (
                    <span className="aiq-replenish-tag">
                      <span className="aiq-pulse-dot" />
                      Yeni yedek hazırlanıyor
                    </span>
                  )}
                </div>
              </div>

              <ol className="aiq-list">
                {queue.displayed.map((q, qIdx) => (
                  <li
                    key={q.clientId}
                    className="aiq-card"
                    style={{ animationDelay: `${qIdx * 50}ms` }}
                  >
                    <div className="aiq-card-head">
                      <span className="aiq-card-num">
                        {String(qIdx + 1).padStart(2, '0')}
                      </span>
                      <p className="aiq-card-q">{q.questionText}</p>
                      <button
                        type="button"
                        className="aiq-card-del"
                        onClick={() => queue.remove(q.clientId)}
                        aria-label="Bu soruyu sil"
                        title="Soruyu sil — yerine yenisi gelecek"
                      >
                        <Trash2 size={14} strokeWidth={2.5} />
                      </button>
                    </div>
                    <div className="aiq-card-opts">
                      {q.options.slice(0, 4).map((opt, optIdx) => {
                        const isCorrect = q.correctIndex === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={
                              isCorrect ? 'aiq-opt aiq-opt--correct' : 'aiq-opt'
                            }
                          >
                            <span className="aiq-opt-letter">
                              {['A', 'B', 'C', 'D'][optIdx]}
                            </span>
                            <span className="aiq-opt-text">{opt}</span>
                            {isCorrect && (
                              <span className="aiq-opt-mark">
                                <CheckCircle2 size={14} strokeWidth={2.5} />
                                <span>Doğru</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </main>
      </div>
    </>
  );
}

/**
 * Stil — tek bir <style> tag'ında, scope'lu .aiq- prefix.
 * Tasarım dili: editorial italic Georgia heading'ler, emerald monoton akzent,
 * sıkı tipografi hiyerarşisi, tek-tek-anlamlı motion, generic AI palet'inden
 * kaçınma (mor gradient yok, beyaz backdrop yok).
 */
function Styles() {
  return (
    <style>{`
      .aiq-root {
        display: grid;
        grid-template-columns: 1fr;
        gap: 28px;
        --aiq-ink: ${K.TEXT_PRIMARY};
        --aiq-soft-ink: ${K.TEXT_SECONDARY};
        --aiq-muted: ${K.TEXT_MUTED};
        --aiq-emerald: ${K.PRIMARY};
        --aiq-emerald-deep: ${K.PRIMARY_HOVER};
        --aiq-emerald-pale: ${K.PRIMARY_LIGHT};
        --aiq-emerald-soft: ${K.PRIMARY_SOFT};
        --aiq-cream: ${K.BG};
        --aiq-cream-soft: ${K.BG_SOFT};
        --aiq-surface: ${K.SURFACE};
        --aiq-border: ${K.BORDER};
        --aiq-border-soft: ${K.BORDER_SOFT};
        --aiq-warning: ${K.WARNING};
        --aiq-error: ${K.ERROR};
        --aiq-success: ${K.SUCCESS};
        --aiq-success-bg: ${K.SUCCESS_BG};
        --aiq-display: ${K.FONT_DISPLAY};
        --aiq-mono: ${K.FONT_MONO};
        --aiq-editorial: ${FONT_EDITORIAL};
      }

      @media (min-width: 1024px) {
        .aiq-root {
          grid-template-columns: 380px 1fr;
          gap: 36px;
          align-items: start;
        }
      }

      /* ─── SIDEBAR ────────────────────────────────────────── */
      .aiq-sidebar {
        position: relative;
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      @media (min-width: 1024px) {
        .aiq-sidebar {
          position: sticky;
          top: 16px;
          max-height: calc(100vh - 32px);
          overflow-y: auto;
          padding-right: 4px;
          padding-bottom: 8px;
        }
        .aiq-sidebar::-webkit-scrollbar { width: 4px; }
        .aiq-sidebar::-webkit-scrollbar-thumb {
          background: var(--aiq-border-soft);
          border-radius: 4px;
        }
      }

      /* HERO */
      .aiq-hero {
        position: relative;
        padding: 22px 24px 24px;
        border-radius: 16px;
        background:
          radial-gradient(circle at 100% 0%, ${K.PRIMARY_LIGHT}88 0%, transparent 65%),
          linear-gradient(180deg, var(--aiq-cream) 0%, var(--aiq-surface) 100%);
        border: 1px solid var(--aiq-border-soft);
        overflow: hidden;
      }
      .aiq-hero::after {
        content: '';
        position: absolute;
        inset: -2px;
        background: linear-gradient(135deg, ${K.PRIMARY}11 0%, transparent 40%);
        pointer-events: none;
      }
      .aiq-hero-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px 4px 8px;
        background: var(--aiq-surface);
        border: 1px solid var(--aiq-border);
        border-radius: 999px;
        font-family: var(--aiq-display);
        font-size: 9.5px;
        font-weight: 700;
        letter-spacing: 0.18em;
        color: var(--aiq-emerald-deep);
        position: relative;
        z-index: 1;
      }
      .aiq-hero-tag svg {
        color: var(--aiq-emerald);
      }
      .aiq-hero-title {
        margin: 14px 0 10px;
        font-family: var(--aiq-display);
        font-size: 30px;
        line-height: 1.05;
        font-weight: 700;
        letter-spacing: -0.025em;
        color: var(--aiq-ink);
        position: relative;
        z-index: 1;
      }
      .aiq-hero-title em {
        font-family: var(--aiq-editorial);
        font-style: italic;
        font-weight: 500;
        color: var(--aiq-emerald);
        letter-spacing: -0.015em;
      }
      .aiq-hero-sub {
        font-family: var(--aiq-display);
        font-size: 13px;
        line-height: 1.55;
        color: var(--aiq-soft-ink);
        max-width: 28ch;
        position: relative;
        z-index: 1;
      }

      /* SECTION */
      .aiq-section {
        padding: 16px 18px 18px;
        background: var(--aiq-surface);
        border: 1px solid var(--aiq-border-soft);
        border-radius: 14px;
      }
      .aiq-section-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
        padding-bottom: 10px;
        border-bottom: 1px dashed var(--aiq-border-soft);
      }
      .aiq-step-num {
        font-family: var(--aiq-editorial);
        font-style: italic;
        font-weight: 600;
        font-size: 18px;
        color: var(--aiq-emerald);
        line-height: 1;
        letter-spacing: -0.02em;
      }
      .aiq-step-label {
        font-family: var(--aiq-display);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--aiq-soft-ink);
        flex: 1;
      }
      .aiq-section-count {
        font-family: var(--aiq-mono);
        font-size: 11px;
        font-weight: 700;
        color: var(--aiq-emerald-deep);
        background: var(--aiq-emerald-pale);
        padding: 2px 8px;
        border-radius: 999px;
      }

      /* SOURCE LIST */
      .aiq-source-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .aiq-source {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--aiq-border-soft);
        border-radius: 10px;
        background: var(--aiq-cream);
        cursor: pointer;
        transition: border-color 160ms ease, background 160ms ease;
      }
      .aiq-source:hover {
        border-color: var(--aiq-border);
      }
      .aiq-source--on {
        border-color: var(--aiq-emerald);
        background: var(--aiq-emerald-soft);
      }
      .aiq-source input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
      }
      .aiq-source-check {
        flex-shrink: 0;
        width: 18px;
        height: 18px;
        border-radius: 5px;
        background: var(--aiq-surface);
        border: 1.5px solid var(--aiq-border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: background 160ms ease, border-color 160ms ease;
      }
      .aiq-source--on .aiq-source-check {
        background: var(--aiq-emerald);
        border-color: var(--aiq-emerald);
      }
      .aiq-source-info {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .aiq-source-name {
        font-family: var(--aiq-display);
        font-size: 13px;
        font-weight: 600;
        color: var(--aiq-ink);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .aiq-source-meta {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: var(--aiq-mono);
        font-size: 10.5px;
        font-weight: 600;
        color: var(--aiq-muted);
        letter-spacing: 0.02em;
      }
      .aiq-source--uploaded {
        cursor: default;
      }
      .aiq-source-remove {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        background: transparent;
        border: 0;
        border-radius: 6px;
        color: var(--aiq-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease;
      }
      .aiq-source-remove:hover {
        background: ${K.ERROR_BG};
        color: var(--aiq-error);
      }

      /* UPLOADER */
      .aiq-uploader {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 14px;
        background: var(--aiq-cream);
        border: 1.5px dashed var(--aiq-border);
        border-radius: 12px;
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease;
        margin-top: 8px;
      }
      .aiq-uploader:hover {
        background: var(--aiq-emerald-soft);
        border-color: var(--aiq-emerald);
      }
      .aiq-uploader--drag {
        background: var(--aiq-emerald-pale);
        border-color: var(--aiq-emerald);
        border-style: solid;
      }
      .aiq-uploader-icon {
        flex-shrink: 0;
        width: 38px;
        height: 38px;
        background: var(--aiq-surface);
        border: 1px solid var(--aiq-border-soft);
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--aiq-emerald-deep);
      }
      .aiq-uploader:hover .aiq-uploader-icon {
        background: var(--aiq-surface);
        border-color: var(--aiq-emerald);
      }
      .aiq-uploader--drag .aiq-uploader-icon {
        background: var(--aiq-emerald);
        color: white;
        border-color: var(--aiq-emerald);
      }
      .aiq-uploader-text {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .aiq-uploader-title {
        font-family: var(--aiq-display);
        font-size: 13px;
        font-weight: 600;
        color: var(--aiq-ink);
      }
      .aiq-uploader-hint {
        font-family: var(--aiq-display);
        font-size: 11px;
        color: var(--aiq-muted);
      }
      .aiq-spin-icon {
        animation: aiq-spin 1s linear infinite;
      }
      .aiq-source-error {
        display: flex;
        align-items: flex-start;
        gap: 5px;
        margin: 10px 0 0;
        font-family: var(--aiq-display);
        font-size: 11px;
        line-height: 1.4;
        color: var(--aiq-error);
      }

      /* MODEL */
      .aiq-model-select-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }
      .aiq-model-tier-dot {
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        width: 9px;
        height: 9px;
        border-radius: 50%;
        box-shadow: 0 0 0 3px var(--aiq-cream);
        pointer-events: none;
        z-index: 1;
      }
      .aiq-model-select {
        appearance: none;
        width: 100%;
        height: 42px;
        padding: 0 36px 0 32px;
        background: var(--aiq-cream);
        border: 1px solid var(--aiq-border);
        border-radius: 10px;
        font-family: var(--aiq-display);
        font-size: 13px;
        font-weight: 600;
        color: var(--aiq-ink);
        cursor: pointer;
        outline: none;
        transition: border-color 160ms ease, background 160ms ease;
      }
      .aiq-model-select:hover {
        background: var(--aiq-surface);
      }
      .aiq-model-select:focus {
        border-color: var(--aiq-emerald);
        background: var(--aiq-surface);
      }
      .aiq-model-chevron {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--aiq-muted);
        pointer-events: none;
      }
      .aiq-model-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }
      .aiq-tier-pill {
        padding: 3px 10px;
        font-family: var(--aiq-display);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.06em;
        border-radius: 999px;
        text-transform: lowercase;
      }
      .aiq-pdf-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px 3px 8px;
        font-family: var(--aiq-display);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.04em;
        border-radius: 999px;
      }
      .aiq-pdf-pill--on {
        background: var(--aiq-success-bg);
        color: var(--aiq-success);
      }
      .aiq-pdf-pill--off {
        background: ${K.WARNING_BG};
        color: var(--aiq-warning);
      }
      .aiq-model-desc {
        margin-top: 10px;
        font-family: var(--aiq-display);
        font-size: 12px;
        line-height: 1.5;
        color: var(--aiq-muted);
      }

      /* CTA */
      .aiq-cta {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        height: 52px;
        padding: 0 18px;
        background: linear-gradient(135deg, var(--aiq-emerald) 0%, var(--aiq-emerald-deep) 100%);
        color: white;
        border: 0;
        border-radius: 12px;
        font-family: var(--aiq-display);
        font-size: 14px;
        font-weight: 700;
        letter-spacing: -0.005em;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        box-shadow:
          0 1px 0 0 rgba(255, 255, 255, 0.18) inset,
          0 6px 18px -4px rgba(13, 150, 104, 0.45);
        transition: transform 140ms ease, box-shadow 200ms ease, opacity 160ms ease;
      }
      .aiq-cta::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
        animation: aiq-shimmer 2.6s ease-in-out infinite;
      }
      @keyframes aiq-shimmer {
        0% { left: -100%; }
        50%, 100% { left: 100%; }
      }
      .aiq-cta:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow:
          0 1px 0 0 rgba(255, 255, 255, 0.18) inset,
          0 10px 24px -4px rgba(13, 150, 104, 0.55);
      }
      .aiq-cta:active:not(:disabled) {
        transform: translateY(0);
      }
      .aiq-cta:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .aiq-cta:disabled::before { display: none; }
      .aiq-cta-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        background: rgba(255, 255, 255, 0.18);
        border-radius: 8px;
      }
      .aiq-cta-label { flex: 1; text-align: left; }
      .aiq-cta-label em {
        font-family: var(--aiq-editorial);
        font-style: italic;
        font-weight: 500;
        opacity: 0.85;
      }
      .aiq-cta-hint {
        font-family: var(--aiq-mono);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.04em;
        opacity: 0.7;
        padding: 3px 7px;
        background: rgba(255, 255, 255, 0.12);
        border-radius: 5px;
      }

      .aiq-action-stack {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .aiq-cta-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 38px;
        background: transparent;
        border: 1px solid var(--aiq-border);
        border-radius: 10px;
        font-family: var(--aiq-display);
        font-size: 12.5px;
        font-weight: 600;
        color: var(--aiq-soft-ink);
        cursor: pointer;
        transition: background 160ms ease, border-color 160ms ease, color 160ms ease;
      }
      .aiq-cta-secondary:hover {
        border-color: var(--aiq-emerald);
        color: var(--aiq-emerald-deep);
        background: var(--aiq-emerald-soft);
      }

      /* ERROR */
      .aiq-error {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        padding: 12px 14px;
        background: ${K.ERROR_BG};
        border: 1px solid var(--aiq-error);
        border-radius: 10px;
        font-family: var(--aiq-display);
        font-size: 12.5px;
        line-height: 1.45;
        color: var(--aiq-error);
      }
      .aiq-error svg {
        flex-shrink: 0;
        margin-top: 1px;
      }

      /* ─── RESULTS ────────────────────────────────────────── */
      .aiq-results {
        min-height: 480px;
        position: relative;
      }

      /* Empty hero */
      .aiq-results-empty {
        position: relative;
        min-height: 480px;
        border-radius: 18px;
        border: 1px solid var(--aiq-border-soft);
        background: var(--aiq-surface);
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
      }
      .aiq-results-empty-bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 80% 20%, ${K.PRIMARY_LIGHT}66 0%, transparent 55%),
          radial-gradient(circle at 20% 80%, ${K.PRIMARY_SOFT} 0%, transparent 50%),
          repeating-linear-gradient(135deg, transparent 0 12px, ${K.BORDER_SOFT}55 12px 13px);
        pointer-events: none;
      }
      .aiq-results-empty-content {
        position: relative;
        max-width: 420px;
        text-align: center;
      }
      .aiq-results-empty-mono {
        display: inline-block;
        font-family: var(--aiq-mono);
        font-size: 10.5px;
        font-weight: 700;
        letter-spacing: 0.22em;
        color: var(--aiq-emerald-deep);
        background: var(--aiq-cream);
        padding: 5px 12px;
        border-radius: 999px;
        border: 1px solid var(--aiq-border-soft);
        margin-bottom: 22px;
      }
      .aiq-results-empty-content h3 {
        font-family: var(--aiq-display);
        font-size: 38px;
        font-weight: 700;
        line-height: 1.05;
        letter-spacing: -0.025em;
        color: var(--aiq-ink);
        margin: 0 0 16px;
      }
      .aiq-results-empty-content h3 em {
        font-family: var(--aiq-editorial);
        font-style: italic;
        font-weight: 500;
        color: var(--aiq-emerald);
        letter-spacing: -0.015em;
      }
      .aiq-results-empty-content p {
        font-family: var(--aiq-display);
        font-size: 14.5px;
        line-height: 1.6;
        color: var(--aiq-soft-ink);
        margin: 0 0 12px;
      }
      .aiq-results-empty-content p em {
        font-family: var(--aiq-editorial);
        font-style: italic;
        color: var(--aiq-emerald-deep);
        font-weight: 500;
      }


      /* Loading */
      .aiq-loading {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .aiq-loading-banner {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 18px;
        background: var(--aiq-cream);
        border: 1px solid var(--aiq-border-soft);
        border-radius: 14px;
      }
      .aiq-spin {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--aiq-emerald-pale);
        color: var(--aiq-emerald-deep);
        display: flex;
        align-items: center;
        justify-content: center;
        animation: aiq-spin 1s linear infinite;
      }
      @keyframes aiq-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .aiq-loading-title {
        font-family: var(--aiq-display);
        font-size: 14px;
        font-weight: 700;
        color: var(--aiq-ink);
        margin: 0 0 2px;
      }
      .aiq-loading-hint {
        font-family: var(--aiq-display);
        font-size: 12px;
        color: var(--aiq-muted);
        margin: 0;
      }
      .aiq-skeleton {
        padding: 16px 18px;
        background: var(--aiq-surface);
        border: 1px solid var(--aiq-border-soft);
        border-radius: 14px;
        animation: aiq-fade 800ms ease both;
        opacity: 0;
      }
      @keyframes aiq-fade {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .aiq-skeleton-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 12px;
      }
      .aiq-skeleton-num {
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: linear-gradient(90deg, ${K.BORDER_SOFT}, ${K.BORDER}, ${K.BORDER_SOFT});
        background-size: 200% 100%;
        animation: aiq-shimmer-bg 1.5s linear infinite;
      }
      .aiq-skeleton-line {
        height: 11px;
        flex: 1;
        border-radius: 4px;
        background: linear-gradient(90deg, ${K.BORDER_SOFT}, ${K.BORDER}, ${K.BORDER_SOFT});
        background-size: 200% 100%;
        animation: aiq-shimmer-bg 1.5s linear infinite;
      }
      .aiq-skeleton-line--2 { width: 80%; flex: none; }
      .aiq-skeleton-line--3 { width: 60%; flex: none; }
      @keyframes aiq-shimmer-bg {
        from { background-position: 200% 0; }
        to { background-position: -200% 0; }
      }
      .aiq-skeleton-opts {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      /* PENDING BANNER — "Soruları Ekle" basılmadan kaydedilmediğini hatırlatır */
      .aiq-pending-banner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px 18px;
        margin-bottom: 16px;
        background: ${K.WARNING_BG};
        border: 1px solid ${K.WARNING};
        border-left-width: 4px;
        border-radius: 12px;
        animation: aiq-banner-pulse 3s ease-in-out infinite;
      }
      @keyframes aiq-banner-pulse {
        0%, 100% { box-shadow: 0 0 0 0 ${K.WARNING}00; }
        50% { box-shadow: 0 0 0 4px ${K.WARNING}22; }
      }
      .aiq-pending-banner svg {
        flex-shrink: 0;
        color: ${K.WARNING};
        margin-top: 1px;
      }
      .aiq-pending-banner-text {
        display: flex;
        flex-direction: column;
        gap: 3px;
        font-family: var(--aiq-display);
        font-size: 13px;
        line-height: 1.5;
        color: #6b3e0a;
      }
      .aiq-pending-banner-text strong {
        font-weight: 700;
        color: #4a2906;
      }
      .aiq-pending-banner-text em {
        font-family: var(--aiq-editorial);
        font-style: italic;
        font-weight: 600;
      }

      /* RESULTS HEAD */
      .aiq-results-head {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--aiq-border-soft);
      }
      .aiq-results-title {
        font-family: var(--aiq-display);
        font-size: 22px;
        font-weight: 700;
        letter-spacing: -0.02em;
        color: var(--aiq-ink);
        margin: 0 0 2px;
      }
      .aiq-results-title em {
        font-family: var(--aiq-editorial);
        font-style: italic;
        font-weight: 500;
        color: var(--aiq-emerald);
      }
      .aiq-results-sub {
        font-family: var(--aiq-display);
        font-size: 12.5px;
        color: var(--aiq-muted);
        margin: 0;
      }
      .aiq-results-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .aiq-buffer-tag {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 4px 11px 4px 8px;
        background: var(--aiq-cream);
        border: 1px dashed var(--aiq-emerald);
        border-radius: 999px;
        font-family: var(--aiq-display);
        font-size: 11px;
        font-weight: 600;
        color: var(--aiq-emerald-deep);
        white-space: nowrap;
      }
      .aiq-buffer-num {
        font-family: var(--aiq-mono);
        font-weight: 700;
        font-size: 11.5px;
        color: var(--aiq-emerald);
        background: var(--aiq-emerald-soft);
        padding: 2px 7px;
        border-radius: 5px;
      }
      .aiq-buffer-label {
        letter-spacing: 0.01em;
      }
      .aiq-replenish-tag {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 11px 5px 9px;
        background: var(--aiq-emerald-soft);
        color: var(--aiq-emerald-deep);
        border-radius: 999px;
        font-family: var(--aiq-display);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.01em;
        white-space: nowrap;
      }
      .aiq-pulse-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--aiq-emerald);
        animation: aiq-pulse 1.4s ease-in-out infinite;
      }
      @keyframes aiq-pulse {
        0%, 100% { opacity: 0.3; transform: scale(0.85); }
        50% { opacity: 1; transform: scale(1.1); }
      }

      /* QUESTION CARD */
      .aiq-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .aiq-card {
        position: relative;
        background: var(--aiq-surface);
        border: 1px solid var(--aiq-border-soft);
        border-radius: 16px;
        overflow: hidden;
        animation: aiq-card-enter 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
        transition: border-color 220ms ease, box-shadow 220ms ease;
      }
      @keyframes aiq-card-enter {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .aiq-card:hover {
        border-color: var(--aiq-border);
        box-shadow: 0 4px 16px -8px rgba(15, 23, 42, 0.08);
      }
      .aiq-card-head {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 18px 20px 14px;
      }
      .aiq-card-num {
        flex-shrink: 0;
        font-family: var(--aiq-editorial);
        font-style: italic;
        font-weight: 600;
        font-size: 26px;
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--aiq-emerald);
        min-width: 36px;
        margin-top: 2px;
      }
      .aiq-card-q {
        flex: 1;
        font-family: var(--aiq-display);
        font-size: 15.5px;
        font-weight: 600;
        line-height: 1.45;
        color: var(--aiq-ink);
        margin: 0;
        letter-spacing: -0.005em;
      }
      .aiq-card-del {
        flex-shrink: 0;
        width: 30px;
        height: 30px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 8px;
        color: var(--aiq-muted);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
      }
      .aiq-card-del:hover {
        background: ${K.ERROR_BG};
        color: var(--aiq-error);
        border-color: ${K.ERROR}55;
      }
      .aiq-card-opts {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 0 20px 18px;
      }
      .aiq-opt {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        background: var(--aiq-cream);
        border: 1px solid var(--aiq-border-soft);
        border-radius: 10px;
        font-family: var(--aiq-display);
        font-size: 13.5px;
        line-height: 1.45;
        color: var(--aiq-soft-ink);
        transition: border-color 160ms ease, background 160ms ease;
      }
      .aiq-opt:hover {
        border-color: var(--aiq-border);
      }
      .aiq-opt--correct {
        background:
          linear-gradient(90deg, var(--aiq-success-bg) 0%, transparent 100%),
          var(--aiq-surface);
        border-color: var(--aiq-success);
      }
      .aiq-opt-letter {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        background: var(--aiq-cream-soft);
        color: var(--aiq-muted);
        border-radius: 6px;
        font-family: var(--aiq-mono);
        font-size: 11px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        letter-spacing: 0;
      }
      .aiq-opt--correct .aiq-opt-letter {
        background: var(--aiq-success);
        color: white;
      }
      .aiq-opt-text {
        flex: 1;
        color: var(--aiq-ink);
      }
      .aiq-opt--correct .aiq-opt-text {
        font-weight: 600;
      }
      .aiq-opt-mark {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        flex-shrink: 0;
        font-family: var(--aiq-display);
        font-size: 11px;
        font-weight: 700;
        color: var(--aiq-success);
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
    `}</style>
  );
}
