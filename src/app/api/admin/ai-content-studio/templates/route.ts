import { getAuthUser, requireRole, jsonResponse } from '@/lib/api-helpers'

/** Statik prompt şablonları — AI içerik üretimi için önerilen başlangıç talimatları */
const PROMPT_TEMPLATES = [
  {
    id: 'training-podcast',
    label: 'Eğitim Podcast',
    description: 'Hemşire ve sağlık personeli için interaktif podcast',
    template: 'Bu belgedeki bilgileri hemşire ve sağlık personeline yönelik eğitici bir podcast olarak hazırla. Konuyu adım adım açıkla, örnekler ver ve dinleyicinin dikkatini çekecek sorular sor.',
    suggestedFormats: ['audio'],
    category: 'Eğitim',
  },
  {
    id: 'infection-control-summary',
    label: 'Enfeksiyon Kontrol Özeti',
    description: 'El hijyeni ve sterilizasyon kuralları özet dokümanı',
    template: 'Bu belgedeki enfeksiyon kontrol prosedürlerini, el hijyeni kurallarını ve sterilizasyon adımlarını özet bir doküman olarak hazırla. Maddeler halinde, net ve uygulanabilir talimatlar ver.',
    suggestedFormats: ['report', 'infographic'],
    category: 'Klinik',
  },
  {
    id: 'drug-safety-visual',
    label: 'İlaç Güvenliği Görseli',
    description: 'İlaç yönetimi kurallarının görsel özeti',
    template: 'Bu belgedeki ilaç güvenliği protokollerini ve ilaç yönetimi kurallarını görsel olarak özetlenebilecek şekilde düzenle. Kritik uyarıları, dozaj kurallarını ve kontrol adımlarını vurgula.',
    suggestedFormats: ['infographic', 'slide_deck'],
    category: 'Klinik',
  },
  {
    id: 'exam-prep-quiz',
    label: 'Sınav Hazırlık Soruları',
    description: '15-20 çoktan seçmeli sınav sorusu',
    template: 'Bu belgedeki konulardan 15-20 adet çoktan seçmeli sınav sorusu oluştur. Her soru için 4 seçenek ver, doğru cevabı belirt ve kısa açıklama ekle. Zorluk seviyesi orta olsun.',
    suggestedFormats: ['quiz', 'flashcards'],
    category: 'Değerlendirme',
  },
  {
    id: 'emergency-procedures-video',
    label: 'Acil Prosedür Videosu',
    description: 'Adım adım acil durum prosedürleri videosu',
    template: 'Bu belgedeki acil durum prosedürlerini adım adım anlatan bir video senaryosu hazırla. Her adımı net açıkla, kritik zamanlama bilgilerini vurgula ve güvenlik uyarılarını belirt.',
    suggestedFormats: ['video', 'slide_deck'],
    category: 'Güvenlik',
  },
  {
    id: 'patient-rights-flashcards',
    label: 'Hasta Hakları Kartları',
    description: 'Hasta hakları konusunda hafıza kartları',
    template: 'Bu belgedeki hasta hakları bilgilerini öğrenmeyi kolaylaştıracak hafıza kartları oluştur. Her kartın ön yüzünde soru veya kavram, arka yüzünde detaylı açıklama olsun.',
    suggestedFormats: ['flashcards', 'quiz'],
    category: 'Uyum',
  },
]

/**
 * GET /api/admin/ai-content-studio/templates
 *
 * AI içerik üretimi için kullanılabilecek prompt şablonlarını döndürür.
 */
export async function GET() {
  const { dbUser, error } = await getAuthUser()
  if (error) return error

  const roleError = requireRole(dbUser!.role, ['admin'])
  if (roleError) return roleError

  return jsonResponse({ templates: PROMPT_TEMPLATES })
}
