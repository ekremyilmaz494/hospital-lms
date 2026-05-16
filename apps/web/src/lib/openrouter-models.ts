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
    id: 'anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    tier: 'premium',
    supportsPdf: true,
    description: 'En kaliteli sorular, PDF\'i en iyi anlayan en yeni Anthropic model. Önerilen varsayılan.',
  },
  {
    id: 'anthropic/claude-sonnet-4.5',
    label: 'Claude Sonnet 4.5',
    tier: 'premium',
    supportsPdf: true,
    description: 'Önceki nesil premium model. Hâlâ çok güçlü, dengeli fiyat-performans.',
  },
  {
    id: 'anthropic/claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    tier: 'hızlı',
    supportsPdf: true,
    description: 'Hızlı ve ekonomik. Basit/orta zorlukta sorular için yeterli.',
  },
  {
    id: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    tier: 'uzun-context',
    supportsPdf: true,
    description: 'Çok uzun PDF\'leri (>50 sayfa) tek seferde işler. Sağlık alanında güçlü.',
  },
  {
    id: 'openai/gpt-4o',
    label: 'GPT-4o',
    tier: 'dengeli',
    supportsPdf: false,
    description: 'OpenAI\'nin amiral modeli. PDF dosyalarını desteklemiyor (sadece görsel).',
  },
] as const;

export const DEFAULT_MODEL_ID = 'anthropic/claude-sonnet-4.6';

export function getModel(id: string): CuratedModel | undefined {
  return CURATED_MODELS.find((m) => m.id === id);
}

export function isValidModelId(id: string): boolean {
  return CURATED_MODELS.some((m) => m.id === id);
}
