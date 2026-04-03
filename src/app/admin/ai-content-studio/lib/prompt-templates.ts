import type { PromptTemplate } from '../types'

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'training-podcast',
    label: 'Eğitim Podcast\'i',
    description: 'Personel eğitimi için dinleyerek öğrenme',
    category: 'Ses',
    suggestedFormats: ['AUDIO_OVERVIEW'],
    template:
      'Bu belgedeki bilgileri hemşireler ve sağlık personeli için eğitici bir podcast formatına dönüştür. Kritik noktaları vurgula, pratik örnekler ver ve uygulama adımlarını açıkla.',
  },
  {
    id: 'infection-control',
    label: 'Enfeksiyon Kontrol Özeti',
    description: 'El hijyeni ve sterilizasyon prosedürleri',
    category: 'Özet',
    suggestedFormats: ['STUDY_GUIDE', 'INFOGRAPHIC'],
    template:
      'Bu enfeksiyon kontrol protokolünden personel için kısa ve anlaşılır bir çalışma rehberi oluştur. Adım adım prosedürler, kritik hatırlatmalar ve sık yapılan hatalar bölümleri olsun.',
  },
  {
    id: 'drug-safety',
    label: 'İlaç Güvenliği İnfografik',
    description: 'İlaç uygulama kuralları görsel özet',
    category: 'Görsel',
    suggestedFormats: ['INFOGRAPHIC'],
    template:
      'Bu ilaç güvenliği belgesinden görsel bir özet oluştur. Kritik doz bilgileri, kontrendikasyonlar, acil durum prosedürleri ve önemli uyarıları vurgula.',
  },
  {
    id: 'exam-prep',
    label: 'Sınav Hazırlık Soruları',
    description: 'Eğitim sınavına hazırlık için sorular',
    category: 'Sınav',
    suggestedFormats: ['QUIZ', 'AUDIO_QUIZ'],
    template:
      'Bu belgeden 15-20 çoktan seçmeli sınav sorusu oluştur. Sorular kritik bilgileri ölçmeli, her sorunun 4 şıkkı ve açıklamalı doğru cevabı olmalı.',
  },
  {
    id: 'emergency-procedures',
    label: 'Acil Prosedür Videosu',
    description: 'Acil durum müdahale adımları',
    category: 'Video',
    suggestedFormats: ['VIDEO_OVERVIEW'],
    template:
      'Bu acil prosedür belgesinden adım adım anlatımlı bir eğitim videosu oluştur. Her adımı net açıkla, kritik karar noktalarını vurgula ve yaygın hataları belirt.',
  },
  {
    id: 'patient-rights',
    label: 'Hasta Hakları Flashcard',
    description: 'Hızlı tekrar kartları',
    category: 'Tekrar',
    suggestedFormats: ['AUDIO_QUIZ'],
    template:
      'Bu hasta hakları metninden personelin ezberlemesi gereken önemli noktaları flashcard formatında hazırla. Her kart kısa ve anlaşılır olmalı.',
  },
]

export const TEMPLATE_CATEGORIES = [...new Set(PROMPT_TEMPLATES.map((t) => t.category))]
