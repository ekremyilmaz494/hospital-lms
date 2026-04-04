import type { FormatConfig, CommonSetting, ArtifactType } from '../types'

export const FORMAT_CONFIGS: FormatConfig[] = [
  {
    id: 'audio',
    icon: '🎙️',
    label: 'Ses İçeriği',
    description: 'Podcast veya sesli anlatım oluşturun',
    estimatedMinutes: 10,
    resultType: 'audio',
    outputExtension: 'mp3',
    options: [
      {
        key: 'format',
        label: 'Ses Formatı',
        values: [
          { value: 'deep-dive', label: 'Derinlemesine Analiz' },
          { value: 'brief', label: 'Kısa Özet' },
          { value: 'critique', label: 'Eleştirel İnceleme' },
          { value: 'debate', label: 'Tartışma / Diyalog' },
        ],
        default: 'deep-dive',
      },
      {
        key: 'length',
        label: 'Uzunluk',
        values: [
          { value: 'short', label: 'Kısa (~5 dk)' },
          { value: 'default', label: 'Normal (~10 dk)' },
          { value: 'long', label: 'Uzun (~20 dk)' },
        ],
        default: 'default',
      },
    ],
  },
  {
    id: 'video',
    icon: '🎬',
    label: 'Video İçeriği',
    description: 'Eğitim videosu veya sunum videosu',
    estimatedMinutes: 15,
    resultType: 'video',
    outputExtension: 'mp4',
    options: [
      {
        key: 'format',
        label: 'Video Tipi',
        values: [
          { value: 'explainer', label: 'Açıklayıcı' },
          { value: 'brief', label: 'Kısa Özet' },
          { value: 'cinematic', label: 'Sinematik' },
        ],
        default: 'explainer',
      },
      {
        key: 'style',
        label: 'Görsel Stil',
        values: [
          { value: 'auto', label: 'Otomatik' },
          { value: 'classic', label: 'Klasik' },
          { value: 'whiteboard', label: 'Beyaz Tahta' },
          { value: 'kawaii', label: 'Kawaii' },
          { value: 'anime', label: 'Anime' },
          { value: 'watercolor', label: 'Suluboya' },
          { value: 'retro-print', label: 'Retro' },
          { value: 'heritage', label: 'Heritage' },
          { value: 'paper-craft', label: 'Kağıt Sanatı' },
        ],
        default: 'auto',
      },
    ],
  },
  {
    id: 'slide_deck',
    icon: '📊',
    label: 'Slayt Sunumu',
    description: 'PDF veya PowerPoint sunum dosyası',
    estimatedMinutes: 8,
    resultType: 'presentation',
    outputExtension: 'pdf',
    options: [
      {
        key: 'format',
        label: 'Sunum Tipi',
        values: [
          { value: 'detailed', label: 'Detaylı' },
          { value: 'presenter', label: 'Sunum Notlu' },
        ],
        default: 'detailed',
      },
      {
        key: 'length',
        label: 'Uzunluk',
        values: [
          { value: 'short', label: 'Kısa (~10 slayt)' },
          { value: 'default', label: 'Normal (~20 slayt)' },
        ],
        default: 'default',
      },
      {
        key: 'output_format',
        label: 'Dosya Formatı',
        values: [
          { value: 'pdf', label: 'PDF' },
          { value: 'pptx', label: 'PowerPoint (PPTX)' },
        ],
        default: 'pdf',
      },
    ],
  },
  {
    id: 'quiz',
    icon: '❓',
    label: 'Quiz / Sınav',
    description: 'Çoktan seçmeli sorular oluşturun',
    estimatedMinutes: 5,
    resultType: 'json',
    outputExtension: 'json',
    options: [
      {
        key: 'quantity',
        label: 'Soru Sayısı',
        values: [
          { value: 'fewer', label: 'Az (~5-10)' },
          { value: 'standard', label: 'Normal (~15-20)' },
          { value: 'more', label: 'Çok (~25-30)' },
        ],
        default: 'standard',
      },
      {
        key: 'difficulty',
        label: 'Zorluk',
        values: [
          { value: 'easy', label: 'Kolay' },
          { value: 'medium', label: 'Orta' },
          { value: 'hard', label: 'Zor' },
        ],
        default: 'medium',
      },
    ],
  },
  {
    id: 'flashcards',
    icon: '🃏',
    label: 'Hafıza Kartları',
    description: 'Çevrilebilir öğrenme kartları',
    estimatedMinutes: 5,
    resultType: 'json',
    outputExtension: 'json',
    options: [
      {
        key: 'quantity',
        label: 'Kart Sayısı',
        values: [
          { value: 'fewer', label: 'Az (~10-15)' },
          { value: 'standard', label: 'Normal (~20-30)' },
          { value: 'more', label: 'Çok (~40-50)' },
        ],
        default: 'standard',
      },
      {
        key: 'difficulty',
        label: 'Zorluk',
        values: [
          { value: 'easy', label: 'Kolay' },
          { value: 'medium', label: 'Orta' },
          { value: 'hard', label: 'Zor' },
        ],
        default: 'medium',
      },
    ],
  },
  {
    id: 'report',
    icon: '📝',
    label: 'Rapor / Doküman',
    description: 'Özet rapor, çalışma kılavuzu veya blog yazısı',
    estimatedMinutes: 5,
    resultType: 'document',
    outputExtension: 'md',
    options: [
      {
        key: 'format',
        label: 'Rapor Tipi',
        values: [
          { value: 'briefing-doc', label: 'Brifing Dokümanı' },
          { value: 'study-guide', label: 'Çalışma Kılavuzu' },
          { value: 'blog-post', label: 'Blog Yazısı' },
          { value: 'custom', label: 'Özel Format' },
        ],
        default: 'study-guide',
      },
    ],
  },
  {
    id: 'infographic',
    icon: '🎨',
    label: 'İnfografik',
    description: 'Görsel bilgi özeti (PNG)',
    estimatedMinutes: 8,
    resultType: 'image',
    outputExtension: 'png',
    options: [
      {
        key: 'orientation',
        label: 'Yönlendirme',
        values: [
          { value: 'portrait', label: 'Dikey' },
          { value: 'landscape', label: 'Yatay' },
          { value: 'square', label: 'Kare' },
        ],
        default: 'portrait',
      },
      {
        key: 'detail',
        label: 'Detay Seviyesi',
        values: [
          { value: 'low', label: 'Düşük' },
          { value: 'medium', label: 'Orta' },
          { value: 'high', label: 'Yüksek' },
        ],
        default: 'medium',
      },
      {
        key: 'style',
        label: 'Görsel Stil',
        values: [
          { value: 'auto', label: 'Otomatik' },
          { value: 'classic', label: 'Klasik' },
          { value: 'whiteboard', label: 'Beyaz Tahta' },
          { value: 'watercolor', label: 'Suluboya' },
        ],
        default: 'auto',
      },
    ],
  },
  {
    id: 'data_table',
    icon: '📋',
    label: 'Veri Tablosu',
    description: 'Yapılandırılmış veri tablosu (CSV)',
    estimatedMinutes: 3,
    resultType: 'data',
    outputExtension: 'csv',
    options: [],
  },
  {
    id: 'mind_map',
    icon: '🧠',
    label: 'Zihin Haritası',
    description: 'Konu ilişkilerini gösteren ağaç yapısı',
    estimatedMinutes: 2,
    resultType: 'json',
    outputExtension: 'json',
    options: [],
  },
]

// ── Ortak Ayarlar ──

export const COMMON_SETTINGS: CommonSetting[] = [
  {
    key: 'language',
    label: 'Dil',
    icon: '🌍',
    values: [
      { value: 'tr', label: 'Türkçe' },
      { value: 'en', label: 'İngilizce' },
      { value: 'ar', label: 'Arapça' },
      { value: 'de', label: 'Almanca' },
      { value: 'fr', label: 'Fransızca' },
    ],
    default: 'tr',
  },
  {
    key: 'tone',
    label: 'Ton',
    icon: '🎭',
    values: [
      { value: 'formal', label: 'Resmi' },
      { value: 'friendly', label: 'Samimi' },
      { value: 'concise', label: 'Kısa ve Öz' },
    ],
    default: 'formal',
  },
  {
    key: 'audience',
    label: 'Hedef Kitle',
    icon: '👥',
    values: [
      { value: 'all_staff', label: 'Tüm Personel' },
      { value: 'nurse', label: 'Hemşire' },
      { value: 'doctor', label: 'Doktor' },
      { value: 'technician', label: 'Teknisyen' },
      { value: 'new_hire', label: 'Yeni Başlayan' },
      { value: 'manager', label: 'Yönetici' },
    ],
    default: 'all_staff',
  },
]

// ── Varsayılan Ortak Ayar Değerleri ──

export const DEFAULT_COMMON_SETTINGS: Record<string, string> = {
  language: 'tr',
  tone: 'formal',
  audience: 'all_staff',
}

// ── Yardımcı ──

export function getFormatConfig(artifactType: string): FormatConfig {
  const config = FORMAT_CONFIGS.find((f) => f.id === artifactType)
  if (!config) {
    return {
      id: artifactType as ArtifactType,
      icon: '📄',
      label: artifactType,
      description: '',
      estimatedMinutes: 5,
      resultType: 'document',
      outputExtension: 'bin',
      options: [],
    }
  }
  return config
}
