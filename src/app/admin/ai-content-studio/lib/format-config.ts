import type { OutputFormat } from '../types'

export interface FormatConfig {
  id: OutputFormat
  label: string
  description: string
  icon: string
  estimatedMinutes: string
  resultType: 'audio' | 'video' | 'text' | 'json' | 'image'
  outputFileType: string
  options?: {
    key: string
    label: string
    values: { value: string; label: string }[]
    default: string
  }[]
}

export const FORMAT_CONFIGS: FormatConfig[] = [
  {
    id: 'AUDIO_OVERVIEW',
    label: 'Podcast / Sesli Anlatım',
    description: 'Diyalog veya tek kişi anlatım',
    icon: '🎙️',
    estimatedMinutes: '5-30 dk',
    resultType: 'audio',
    outputFileType: '.mp3',
    options: [
      {
        key: 'audio_format',
        label: 'Anlatım Stili',
        values: [
          { value: 'DEEP_DIVE', label: 'Derinlemesine İnceleme' },
          { value: 'DIALOGUE', label: 'İki Kişi Diyalog' },
          { value: 'BRIEF', label: 'Kısa Özet' },
          { value: 'CRITIQUE', label: 'Eleştirel Analiz' },
        ],
        default: 'DEEP_DIVE',
      },
    ],
  },
  {
    id: 'VIDEO_OVERVIEW',
    label: 'Video Senaryosu + Ses',
    description: 'Ses + metin tabanlı slide',
    icon: '🎬',
    estimatedMinutes: '3-15 dk',
    resultType: 'video',
    outputFileType: '.mp4',
    options: [
      {
        key: 'video_style',
        label: 'Video Stili',
        values: [
          { value: 'EXPLAINER', label: 'Açıklayıcı' },
          { value: 'BRIEF', label: 'Kısa' },
          { value: 'CINEMATIC', label: 'Sinematik' },
          { value: 'SLIDE', label: 'Slide Tabanlı' },
        ],
        default: 'EXPLAINER',
      },
    ],
  },
  {
    id: 'INFOGRAPHIC',
    label: 'İnfografik',
    description: 'Görsel özet, şema, diyagram',
    icon: '📊',
    estimatedMinutes: '2-5 dk',
    resultType: 'image',
    outputFileType: '.png / .svg',
  },
  {
    id: 'STUDY_GUIDE',
    label: 'Eğitim Özeti',
    description: 'Yapılandırılmış metin, kritik noktalar',
    icon: '📝',
    estimatedMinutes: '1-3 dk',
    resultType: 'text',
    outputFileType: '.pdf / .md',
  },
  {
    id: 'QUIZ',
    label: 'Sınav Soruları',
    description: 'Otomatik soru üretimi, çoktan seçmeli',
    icon: '📋',
    estimatedMinutes: '1-3 dk',
    resultType: 'json',
    outputFileType: 'JSON',
  },
  {
    id: 'AUDIO_QUIZ',
    label: 'Sesli Sınav Hazırlık',
    description: 'Soru-cevap formatında sesli hazırlık',
    icon: '🗣️',
    estimatedMinutes: '5-15 dk',
    resultType: 'audio',
    outputFileType: '.mp3',
    options: [
      {
        key: 'audio_format',
        label: 'Format',
        values: [
          { value: 'DEEP_DIVE', label: 'Derinlemesine' },
          { value: 'BRIEF', label: 'Kısa Özet' },
          { value: 'CRITIQUE', label: 'Eleştirel' },
        ],
        default: 'BRIEF',
      },
    ],
  },
]

/** Ek ayarlar — her format için ortak */
export interface CommonSettings {
  duration: string
  tone: string
  audience: string
  language: string
}

export const DURATION_OPTIONS = [
  { value: '5', label: '5 dk' },
  { value: '10', label: '10 dk' },
  { value: '15', label: '15 dk' },
  { value: '30', label: '30 dk' },
]

export const TONE_OPTIONS = [
  { value: 'formal', label: 'Formal / Akademik' },
  { value: 'friendly', label: 'Samimi / Günlük' },
  { value: 'concise', label: 'Kısa / Öz' },
]

export const AUDIENCE_OPTIONS = [
  { value: 'nurse', label: 'Hemşire' },
  { value: 'doctor', label: 'Doktor' },
  { value: 'technician', label: 'Teknisyen' },
  { value: 'all_staff', label: 'Tüm Personel' },
  { value: 'new_hire', label: 'Yeni Başlayan' },
  { value: 'manager', label: 'Yönetici' },
]

export const LANGUAGE_OPTIONS = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'İngilizce' },
  { value: 'ar', label: 'Arapça' },
]

export const DEFAULT_COMMON_SETTINGS: CommonSettings = {
  duration: '10',
  tone: 'formal',
  audience: 'all_staff',
  language: 'tr',
}

export function getFormatConfig(format: OutputFormat): FormatConfig {
  return FORMAT_CONFIGS.find((f) => f.id === format) ?? FORMAT_CONFIGS[0]
}
