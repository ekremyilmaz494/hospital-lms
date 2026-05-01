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
import { getDownloadUrl } from '@/lib/s3';
import { getModel, isValidModelId } from '@/lib/openrouter-models';
import { QUESTION_GENERATION_SYSTEM_PROMPT, buildUserPrompt, type ExcludedQuestion } from '@/lib/openrouter-prompt';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const REQUEST_TIMEOUT_MS = 60_000; // PDF parsing modeller için 60s — küçük PDF'lerde 5-15s yeterli

/** OpenRouter'dan dönen tek soru. Zod ile validate ediliyor. */
const generatedQuestionSchema = z.object({
  questionText: z.string().min(5).max(500),
  options: z.array(z.string().min(1).max(300)).length(4),
  correctIndex: z.number().int().min(0).max(3),
});

const generationResponseSchema = z.object({
  questions: z.array(generatedQuestionSchema),
});

export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;

export interface GenerateOptions {
  /** OpenRouter model id (CURATED_MODELS'tan biri) */
  model: string;
  /** S3 key listesi — admin'in step 2'de yüklediği kaynaklar */
  sourceS3Keys: string[];
  /** Üretilecek soru sayısı */
  count: number;
  /** Tekrar etmemesi gereken mevcut sorular */
  excluded?: ExcludedQuestion[];
  /** Org-specific OpenRouter key (opsiyonel; yoksa platform key kullanılır) */
  customApiKey?: string | null;
}

export class OpenRouterError extends Error {
  constructor(message: string, public cause?: unknown) {
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
      'OpenRouter API key bulunamadı. OPENROUTER_API_KEY env değişkeni tanımlı değil veya organizasyonun özel key\'i eksik.',
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    defaultHeaders: {
      // OpenRouter rankings için opsiyonel ama önerilen
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://klinovax.com',
      'X-Title': 'Klinovax Hospital LMS',
    },
  });
}

/**
 * S3 key'i → OpenAI/Anthropic formatlı multimodal content block.
 *
 * PDF'ler `file_url` olarak gönderiliyor (Anthropic Claude native PDF support);
 * görseller `image_url` olarak. Diğer dosya tipleri (txt, docx) için v1'de
 * desteklenmiyor — frontend filtreliyor.
 */
async function buildContentBlock(s3Key: string): Promise<OpenAI.Chat.Completions.ChatCompletionContentPart> {
  const url = await getDownloadUrl(s3Key); // 1 saatlik signed URL
  const lower = s3Key.toLowerCase();
  const isPdf = lower.endsWith('.pdf');
  const isImage = /\.(png|jpe?g|webp|gif)$/.test(lower);

  if (isPdf) {
    // OpenRouter, PDF'i Anthropic-style "file" content block olarak alır.
    // OpenAI SDK tip tanımı bu type'ı bilmediği için cast ediyoruz.
    // OpenRouter PDF: Anthropic-style "file" content block. OpenAI SDK type'larında
    // bu type yok; cast ile geçiyoruz. Runtime'da OpenRouter doğru parse eder.
    return {
      type: 'file',
      file: { file_data: url, filename: s3Key.split('/').pop() ?? 'document.pdf' },
    } as unknown as OpenAI.Chat.Completions.ChatCompletionContentPart;
  }

  if (isImage) {
    return {
      type: 'image_url',
      image_url: { url },
    };
  }

  throw new OpenRouterError(
    `Desteklenmeyen kaynak türü: ${s3Key}. Sadece PDF ve görsel (png/jpg/webp) destekleniyor.`,
  );
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
  if (opts.sourceS3Keys.length === 0) {
    throw new OpenRouterError('En az bir kaynak (PDF/görsel) gerekli.');
  }

  const model = getModel(opts.model);
  if (model && !model.supportsPdf && opts.sourceS3Keys.some((k) => k.toLowerCase().endsWith('.pdf'))) {
    throw new OpenRouterError(
      `${model.label} modeli PDF dosyalarını desteklemiyor. Lütfen PDF destekli bir model seçin (Claude veya Gemini).`,
    );
  }

  const client = createClient(opts.customApiKey);

  // Kaynak content block'larını paralel hazırla (S3 signed URL'leri eş zamanlı al)
  const contentBlocks = await Promise.all(opts.sourceS3Keys.map(buildContentBlock));

  // User mesaj content'i: önce tüm kaynaklar, sonra prompt metni
  const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    ...contentBlocks,
    { type: 'text', text: buildUserPrompt(opts.count, opts.excluded) },
  ];

  let rawResponse: string | null = null;
  try {
    const completion = await client.chat.completions.create({
      model: opts.model,
      // JSON mode (destekleyen modellerde sıkı JSON çıktısı)
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: QUESTION_GENERATION_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.7, // bir miktar çeşitlilik, ama deterministik kalıba yakın
      max_tokens: 4000, // 15 soru ~ 2.5K token, marj koyduk
    });
    rawResponse = completion.choices[0]?.message?.content ?? null;
    if (!rawResponse) {
      throw new OpenRouterError('OpenRouter boş yanıt döndü.');
    }
  } catch (err) {
    logger.error('openrouter', 'chat completion failed', { model: opts.model, error: err instanceof Error ? err.message : String(err) });
    if (err instanceof OpenRouterError) throw err;
    throw new OpenRouterError(
      err instanceof Error ? err.message : 'OpenRouter API çağrısı başarısız.',
      err,
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
      logger.error('openrouter', 'response missing questions array', { keys: Object.keys(parsed as object) });
      throw new OpenRouterError('Model beklenen formatta cevap vermedi.');
    }
    const validOnly = arr
      .map((q) => generatedQuestionSchema.safeParse(q))
      .filter((r): r is z.ZodSafeParseSuccess<GeneratedQuestion> => r.success)
      .map((r) => r.data);
    if (validOnly.length === 0) {
      throw new OpenRouterError('Model tüm soruları geçersiz formatta döndürdü.');
    }
    logger.warn('openrouter', 'some questions invalid, filtered', { total: arr.length, valid: validOnly.length });
    return validOnly;
  }

  return result.data.questions;
}
