/**
 * OpenRouter client — soru üretimi için.
 *
 * OpenRouter, OpenAI-compatible API kullanır → resmi `openai` SDK'sı ile
 * `baseURL` override ederek kullanıyoruz. Multimodal mesajlar (PDF/görsel)
 * Anthropic Claude formatında "type: file" content block ile gönderiliyor;
 * OpenRouter bu formatı kabul edilen tüm modellere route ediyor.
 */
import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from '@/lib/logger';
import { getDownloadUrl, downloadBuffer } from '@/lib/s3';
import { getModel, isValidModelId } from '@/lib/openrouter-models';
import {
  QUESTION_GENERATION_SYSTEM_PROMPT,
  buildUserPrompt,
  type ExcludedQuestion,
} from '@/lib/openrouter-prompt';
import {
  isOfficeMimeType,
  extractTextFromOfficeDocument,
  extractTextFromPdf,
  OFFICE_MIME_TYPES,
} from '@/lib/document-extractor';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
// Büyük kaynaklarda PDF metin çıkarımı (sunucuda) + 20 soru üretimi 60s'i
// aşabiliyor. Route maxDuration=300 ile uyumlu olacak şekilde ~280s.
const REQUEST_TIMEOUT_MS = 280_000;

// Çok büyük (yüzlerce sayfa) PDF'in çıkarılan metnini, context-window aşımı ve
// maliyeti sınırlamak için kaynak başına cap'le. ~200K karakter ≈ 50K token.
const PDF_TEXT_MAX_CHARS = 200_000;

/** OpenRouter'dan dönen tek soru. Zod ile validate ediliyor.
 *  sourceQuote ZORUNLU — kaynaktan birebir alıntı; boş gelirse soru filtrelenir
 *  (model "kaynak dışı" üretmiş demektir, hallucination koruması). */
const generatedQuestionSchema = z.object({
  questionText: z.string().min(5).max(500),
  options: z.array(z.string().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  sourceQuote: z.string().min(3).max(400),
  sourcePage: z.number().int().positive().optional(),
});

const generationResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

/** Kaynak dosya — S3'te key + (opsiyonel) bilinen MIME type.
 *  MIME type bilinmiyorsa key extension'undan tahmin edilir. */
export interface SourceFile {
  s3Key: string;
  mimeType?: string;
  filename?: string;
}

export interface GenerateOptions {
  /** OpenRouter model id (CURATED_MODELS'tan biri) */
  model: string;
  /** Kaynak dosyalar — admin'in step 2'de yüklediği PDF/DOCX/PPTX/XLSX/image */
  sources: SourceFile[];
  /** Üretilecek soru sayısı */
  count: number;
  /** Tekrar etmemesi gereken mevcut sorular */
  excluded?: ExcludedQuestion[];
  /** Org-specific OpenRouter key (opsiyonel; yoksa platform key kullanılır) */
  customApiKey?: string | null;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

/**
 * OpenRouter client'ı oluşturur. customApiKey verilmişse onu, yoksa
 * platform'un OPENROUTER_API_KEY env'ini kullanır.
 */
function createClient(customApiKey?: string | null): OpenAI {
  const apiKey = customApiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError(
      "OpenRouter API key bulunamadı. OPENROUTER_API_KEY env değişkeni tanımlı değil veya organizasyonun özel key'i eksik."
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    defaultHeaders: {
      // OpenRouter rankings için opsiyonel ama önerilen
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://klinovax.com',
      'X-Title': 'KlinoVax LMS',
    },
  });
}

/**
 * Kaynak dosyayı OpenAI/Anthropic formatlı content block(s)'a çevirir.
 *
 * PDF: S3'ten buffer indir, sunucuda text'e çevir (unpdf), `text` content block.
 *   (OpenRouter native/cloudflare-ai PDF parse'ı 12MB+ dosyalarda timeout/500
 *    veriyordu — provider parse'a bağımlılık kaldırıldı.)
 * Image: `image_url` content block.
 * Office (DOCX/PPTX/XLSX): S3'ten buffer indir, text'e çevir, `text` content
 *   block olarak döner. Çıkan metin boşsa boş array döner (caller filtreler).
 *
 * Tek bir kaynak birden fazla content block üretebilir (örn. text wrapper).
 */
async function buildContentBlocks(
  source: SourceFile
): Promise<OpenAI.Chat.Completions.ChatCompletionContentPart[]> {
  const lower = source.s3Key.toLowerCase();
  const filename = source.filename ?? source.s3Key.split('/').pop() ?? 'document';
  const isPdf = lower.endsWith('.pdf') || source.mimeType === 'application/pdf';
  // Otomatik video transkripti — pipeline transcripts/{org}/{seg}/{uuid}.txt yazar
  // (lib/transcripts.ts). Düz UTF-8 metin; PDF/office gibi <source> bloğuna gömülür.
  const isTranscript =
    source.mimeType === 'text/plain' ||
    (lower.startsWith('transcripts/') && lower.endsWith('.txt'));
  const isImage = /\.(png|jpe?g|webp|gif)$/.test(lower);
  const officeMime =
    source.mimeType && isOfficeMimeType(source.mimeType)
      ? source.mimeType
      : guessOfficeMimeFromExtension(lower);

  if (isPdf) {
    // PDF'i sunucuda metne çevir (office gibi) — OpenRouter PDF parse'a bağımsız.
    const buffer = await downloadBuffer(source.s3Key);
    let text = await extractTextFromPdf(buffer);
    if (!text) {
      // Gömülü metni olmayan PDF (taranmış/görsel-only) → unpdf çıkaramaz.
      // Sessizce DÜŞÜRME: çoklu kaynakta bu PDF'ten hiç soru gelmiyordu
      // (kullanıcı şikâyeti). Model PDF destekliyor (generateQuestions üstte
      // garanti eder) → PDF'i native `file` bloğuyla gönder, Claude vision ile
      // okusun. Text PDF'ler hızlı unpdf yolunda kalır (#189 timeout kazancı
      // korunur; native yol yalnızca gerçekten vision gereken taranmış PDF'e
      // dokunur). Büyük taranmış PDF native parse yavaş olabilir → 280s timeout
      // + "zaman aşımı" mesajı güvenlik ağı. (Gelecekte daha sağlam OCR için
      //  OpenRouter mistral-ocr plugin'i değerlendirilebilir — ücretli.)
      logger.warn('openrouter', 'pdf metni boş — native PDF (vision) fallback', {
        s3Key: source.s3Key,
      });
      const url = await getDownloadUrl(source.s3Key);
      return [
        {
          type: 'file',
          file: { file_data: url, filename },
        } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart,
      ];
    }
    if (text.length > PDF_TEXT_MAX_CHARS) {
      logger.warn('openrouter', 'pdf text truncated', {
        s3Key: source.s3Key,
        originalChars: text.length,
        cap: PDF_TEXT_MAX_CHARS,
      });
      text = text.slice(0, PDF_TEXT_MAX_CHARS);
    }
    return [
      {
        type: 'text',
        text: `<source filename="${filename}" type="PDF">\n${text}\n</source>`,
      },
    ];
  }

  if (isTranscript) {
    const buffer = await downloadBuffer(source.s3Key);
    let text = buffer.toString('utf8');
    if (!text.trim()) {
      logger.warn('openrouter', 'transcript source yielded empty text', {
        s3Key: source.s3Key,
      });
      return [];
    }
    if (text.length > PDF_TEXT_MAX_CHARS) {
      logger.warn('openrouter', 'transcript text truncated', {
        s3Key: source.s3Key,
        originalChars: text.length,
        cap: PDF_TEXT_MAX_CHARS,
      });
      text = text.slice(0, PDF_TEXT_MAX_CHARS);
    }
    return [
      {
        type: 'text',
        text: `<source filename="${filename}" type="Video Transkripti">\n${text}\n</source>`,
      },
    ];
  }

  if (isImage) {
    const url = await getDownloadUrl(source.s3Key);
    return [{ type: 'image_url', image_url: { url } }];
  }

  if (officeMime) {
    // Office formatları: sunucuda text'e çevir, prompt'a göm.
    const buffer = await downloadBuffer(source.s3Key);
    const text = await extractTextFromOfficeDocument(buffer, officeMime);
    if (!text) {
      logger.warn('openrouter', 'office document yielded empty text', {
        s3Key: source.s3Key,
        mimeType: officeMime,
      });
      return [];
    }
    const formatLabel =
      officeMime === OFFICE_MIME_TYPES.DOCX
        ? 'Word'
        : officeMime === OFFICE_MIME_TYPES.PPTX
          ? 'PowerPoint'
          : 'Excel';
    return [
      {
        type: 'text',
        text: `<source filename="${filename}" type="${formatLabel}">\n${text}\n</source>`,
      },
    ];
  }

  throw new OpenRouterError(
    `Desteklenmeyen kaynak türü: ${source.s3Key}. Sadece PDF, görsel (png/jpg/webp), office (DOCX/PPTX/XLSX) ve video transkripti destekleniyor.`
  );
}

function guessOfficeMimeFromExtension(lower: string): string | null {
  if (lower.endsWith('.docx')) return OFFICE_MIME_TYPES.DOCX;
  if (lower.endsWith('.pptx')) return OFFICE_MIME_TYPES.PPTX;
  if (lower.endsWith('.xlsx')) return OFFICE_MIME_TYPES.XLSX;
  return null;
}

/**
 * OpenRouter'a soru üretimi isteği gönderir.
 *
 * Hata stratejisi:
 * - Model API hatası (4xx/5xx) → OpenRouterError throw
 * - Cevap valid JSON değil → tek retry (modele "sadece JSON döndür" hatırlat)
 * - Zod validation fail → invalid soruları skip et, kalan soruları döndür
 *   (caller ihtiyaç duyduğu kadar replenish çağrısıyla tamamlar)
 */
export async function generateQuestions(opts: GenerateOptions): Promise<GeneratedQuestion[]> {
  if (!isValidModelId(opts.model)) {
    throw new OpenRouterError(`Geçersiz model id: ${opts.model}`);
  }
  if (opts.count < 1 || opts.count > 20) {
    throw new OpenRouterError(`count 1-20 arası olmalı, alındı: ${opts.count}`);
  }
  if (opts.sources.length === 0) {
    throw new OpenRouterError('En az bir kaynak (PDF/görsel/DOCX/PPTX/XLSX) gerekli.');
  }

  const model = getModel(opts.model);
  const hasPdf = opts.sources.some(
    (s) => s.s3Key.toLowerCase().endsWith('.pdf') || s.mimeType === 'application/pdf'
  );
  if (model && !model.supportsPdf && hasPdf) {
    throw new OpenRouterError(
      `${model.label} modeli PDF dosyalarını desteklemiyor. Lütfen PDF destekli bir model seçin (Claude veya Gemini).`
    );
  }

  const client = createClient(opts.customApiKey);

  // Kaynak content block'larını paralel hazırla (S3 signed URL + office text extract eş zamanlı)
  const blocksNested = await Promise.all(opts.sources.map(buildContentBlocks));
  const contentBlocks = blocksNested.flat();
  if (contentBlocks.length === 0) {
    throw new OpenRouterError(
      'Kaynak dosyalardan metin çıkarılamadı. Office formatında metin yoksa (sadece görsel slide gibi), lütfen PDF olarak yükleyin.'
    );
  }

  // Kaynak adları — çoklu kaynakta modele "tüm belgelere dağıt" talimatı için.
  const sourceNames = opts.sources.map(
    (s) => s.filename ?? s.s3Key.split('/').pop() ?? 'belge',
  );

  // User mesaj content'i: önce tüm kaynaklar, sonra prompt metni
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    ...contentBlocks,
    { type: 'text', text: buildUserPrompt(opts.count, opts.excluded, sourceNames) },
  ];

  let rawResponse: string | null = null;
  try {
    // Kaynaklar (PDF/office) zaten sunucuda metne çevrildi → modele düz metin
    // gidiyor; OpenRouter PDF parse plugin'ine (cloudflare-ai/native) gerek yok.
    const completion = await client.chat.completions.create({
      model: opts.model,
      // JSON mode (destekleyen modellerde sıkı JSON çıktısı)
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: QUESTION_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      // Faktüel/kaynağa-sadık üretim için düşük temperature.
      // 0.7 → 0.3 (hallucination riski azalır, çeşitlilik biraz düşer; sınav doğruluğu öncelik).
      temperature: 0.3,
      max_tokens: 6000, // 20 soru ~ 3.3K token; uzun sourceQuote'lu modellerde
      // truncation'ı önlemek için marj. Kesilen JSON = parse
      // fail = 20 sorunun hepsi çöpe.
    });
    // OpenRouter, provider hatası / kredi / rate-limit / moderation durumunda bazen
    // HTTP 200 + { error: {...} } (choices YOK) döndürür; SDK 2xx olduğu için throw
    // ETMEZ. Envelope'u elle kontrol et ki GERÇEK sebep yüzeye çıksın — yoksa
    // `completion.choices[0]` erişimi "Cannot read properties of undefined (reading '0')"
    // fırlatır ve asıl provider mesajı maskelenir.
    const errorEnvelope = (
      completion as unknown as {
        error?: { message?: string; code?: number | string };
      }
    ).error;
    if (errorEnvelope) {
      logger.error('openrouter', 'provider returned error envelope (no choices)', {
        model: opts.model,
        code: errorEnvelope.code,
        message: errorEnvelope.message,
      });
      throw new OpenRouterError(
        `Model sağlayıcı hatası: ${errorEnvelope.message ?? 'bilinmeyen hata'}` +
          (errorEnvelope.code ? ` (kod: ${errorEnvelope.code})` : '')
      );
    }
    // `choices` beklenmedik şekilde yoksa optional-chaining ile güvenli eriş (?.[0]).
    rawResponse = completion.choices?.[0]?.message?.content ?? null;
    if (!rawResponse) {
      throw new OpenRouterError(
        'OpenRouter beklenen formatta yanıt döndürmedi (boş içerik). Lütfen tekrar deneyin veya farklı bir model seçin.'
      );
    }
  } catch (err) {
    logger.error('openrouter', 'chat completion failed', {
      model: opts.model,
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof OpenRouterError) throw err;
    throw new OpenRouterError(
      err instanceof Error ? err.message : 'OpenRouter API çağrısı başarısız.',
      err
    );
  }

  // JSON parse + Zod validate
  // Anthropic/Gemini bazen response_format flag'ini ignore edip markdown fence
  // (```json ... ```) ile sarar, ya da prose ile prefix/suffix ekler. Bu yüzden
  // gevşek extraction: ilk { ile son } arasını al, fence'leri strip et.
  const extractJson = (raw: string): string => {
    let s = raw.trim();
    // Markdown fence: ```json\n{...}\n``` veya ```\n{...}\n```
    const fenceMatch = s.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch) s = fenceMatch[1].trim();
    // İlk { ile eşleşen son } arasını al (prose intro/outro varsa kırp)
    const firstBrace = s.indexOf('{');
    const lastBrace = s.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      s = s.slice(firstBrace, lastBrace + 1);
    }
    return s;
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(rawResponse));
  } catch {
    logger.error('openrouter', 'response is not valid JSON', {
      model: opts.model,
      rawResponse: rawResponse.slice(0, 1000),
    });
    throw new OpenRouterError('Model geçerli JSON döndürmedi. Farklı bir model deneyin.');
  }

  const result = generationResponseSchema.safeParse(parsed);
  if (!result.success) {
    // Bazı sorular invalid olabilir; tüm cevap çöp ise hata, yoksa filter
    const arr = (parsed as { questions?: unknown[] })?.questions;
    if (!Array.isArray(arr)) {
      logger.error('openrouter', 'response missing questions array', {
        keys: Object.keys(parsed as object),
      });
      throw new OpenRouterError('Model beklenen formatta cevap vermedi.');
    }
    const validOnly = arr
      .map((q) => generatedQuestionSchema.safeParse(q))
      .filter((r): r is z.ZodSafeParseSuccess<GeneratedQuestion> => r.success)
      .map((r) => r.data);
    if (validOnly.length === 0) {
      throw new OpenRouterError('Model tüm soruları geçersiz formatta döndürdü.');
    }
    logger.warn('openrouter', 'some questions invalid, filtered', {
      total: arr.length,
      valid: validOnly.length,
    });
    return validOnly;
  }

  return result.data.questions;
}
