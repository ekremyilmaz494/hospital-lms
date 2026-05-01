/**
 * OpenRouter — kürate edilmiş model listesi.
 *
 * Admin'e bunaltıcı 100+ model göstermek yerine 5 sağlam seçenek sunuyoruz.
 * Yeni model çıktıkça buraya elle ekleriz; tier rozetleri UI'da renklenir.
 *
 * supportsPdf: true → modele PDF dosyasını "document" content block olarak
 *  doğrudan gönderebiliyoruz. false → sadece görsel/metin destekler, PDF
 *  içeren kaynak için bu modeli seçince UI uyarı verir.
 */
export type ModelTier = 'premium' | 'dengeli' | 'hızlı' | 'uzun-context' | 'açık-kaynak';

export interface CuratedModel {
  id: string;
  label: string;
  tier: ModelTier;
  /** PDF dosyalarını native olarak destekliyor mu (Anthropic + Gemini = evet). */
  supportsPdf: boolean;
  /** UI'da gösterilen kısa açıklama. */
  description: string;
}

export const CURATED_MODELS: readonly CuratedModel[] = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    tier: 'premium',
    supportsPdf: true,
    description: 'En kaliteli sorular, PDF\'i en iyi anlayan model. Önerilen varsayılan.',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    tier: 'hızlı',
    supportsPdf: true,
    description: 'Hızlı ve ekonomik. Basit/orta zorlukta sorular için yeterli.',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    tier: 'dengeli',
    supportsPdf: false,
    description: 'OpenAI\'nin amiral modeli. PDF için sayfa görüntüsüne dönüştürme gerekir (v1\'de desteklenmiyor).',
  },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    tier: 'uzun-context',
    supportsPdf: true,
    description: 'Çok uzun PDF\'leri (>50 sayfa) tek seferde işler. Sağlık alanında güçlü.',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    tier: 'açık-kaynak',
    supportsPdf: false,
    description: 'Açık kaynak alternatif. Ekonomik. Sadece metin/görsel kaynaklarla çalışır.',
  },
] as const;

export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4.5';

export function getModel(id: string): CuratedModel | undefined {
  return CURATED_MODELS.find((m) => m.id === id);
}

export function isValidModelId(id: string): boolean {
  return CURATED_MODELS.some((m) => m.id === id);
}
