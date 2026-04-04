import type { PromptTemplate } from '../types'

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'training-podcast',
    label: 'Eğitim Podcast',
    description: 'Hemşire ve sağlık personeli için interaktif sesli eğitim içeriği',
    template:
      'Bu belgedeki bilgileri hemşire ve sağlık personeline yönelik, kolay anlaşılır bir dilde, örneklerle zenginleştirerek sesli eğitim formatında özetle. Önemli noktaları vurgula, pratik ipuçları ekle.',
    suggestedFormats: ['audio'],
    category: 'Eğitim',
  },
  {
    id: 'infection-control-summary',
    label: 'Enfeksiyon Kontrol Özeti',
    description: 'El hijyeni ve sterilizasyon kurallarının kapsamlı özeti',
    template:
      'Bu belgedeki enfeksiyon kontrol prosedürlerini, el hijyeni kurallarını ve sterilizasyon protokollerini maddeler halinde, anlaşılır bir dilde özetle. WHO ve Sağlık Bakanlığı standartlarına atıfta bulun.',
    suggestedFormats: ['report', 'infographic'],
    category: 'Klinik',
  },
  {
    id: 'drug-safety-visual',
    label: 'İlaç Güvenliği Görseli',
    description: 'İlaç yönetimi ve güvenlik kurallarının görsel özeti',
    template:
      'Bu belgedeki ilaç güvenliği protokollerini, ilaç etkileşimlerini ve dozaj kurallarını görsel olarak özetleyen, kolay hatırlanacak bir format oluştur. Risk gruplarını ve acil durum protokollerini vurgula.',
    suggestedFormats: ['infographic', 'slide_deck'],
    category: 'Klinik',
  },
  {
    id: 'exam-prep-quiz',
    label: 'Sınav Hazırlık Soruları',
    description: 'Kapsamlı çoktan seçmeli sınav soruları seti',
    template:
      'Bu belgedeki konulardan 15-20 adet çoktan seçmeli soru hazırla. Her sorunun 4 seçeneği olsun, doğru cevabı ve kısa açıklamasını ekle. Farklı zorluk seviyelerinde sorular oluştur.',
    suggestedFormats: ['quiz', 'flashcards'],
    category: 'Değerlendirme',
  },
  {
    id: 'emergency-procedures-video',
    label: 'Acil Prosedür Videosu',
    description: 'Adım adım acil durum prosedürleri eğitim videosu',
    template:
      'Bu belgedeki acil durum prosedürlerini adım adım anlatan, görsel olarak zengin bir eğitim videosu oluştur. Her adımı net ve anlaşılır şekilde açıkla, kritik noktaları vurgula.',
    suggestedFormats: ['video', 'slide_deck'],
    category: 'Güvenlik',
  },
  {
    id: 'patient-rights-flashcards',
    label: 'Hasta Hakları Kartları',
    description: 'Hasta hakları konusunda hızlı öğrenme kartları',
    template:
      'Bu belgedeki hasta hakları bilgilerini, yasal düzenlemeleri ve personel sorumluluklarını hafıza kartları formatında özetle. Her kartın ön yüzünde soru/terim, arka yüzünde açıklama olsun.',
    suggestedFormats: ['flashcards', 'quiz'],
    category: 'Uyum',
  },
  {
    id: 'kvkk-compliance-guide',
    label: 'KVKK Uyum Kılavuzu',
    description: 'Kişisel verilerin korunması eğitim dokümanı',
    template:
      'Bu belgedeki KVKK düzenlemelerini, kişisel veri işleme kurallarını ve sağlık verisi koruma prosedürlerini anlaşılır bir kılavuz formatında özetle. Pratik örnekler ve dikkat edilmesi gereken noktaları ekle.',
    suggestedFormats: ['report', 'slide_deck'],
    category: 'Uyum',
  },
  {
    id: 'fire-safety-training',
    label: 'Yangın Güvenliği Eğitimi',
    description: 'Yangın önleme ve müdahale eğitim materyali',
    template:
      'Bu belgedeki yangın güvenliği prosedürlerini, tahliye planlarını ve yangın söndürme ekipmanı kullanımını adım adım anlatan bir eğitim materyali oluştur. Acil durum iletişim bilgilerini ekle.',
    suggestedFormats: ['video', 'infographic', 'slide_deck'],
    category: 'Güvenlik',
  },
]
