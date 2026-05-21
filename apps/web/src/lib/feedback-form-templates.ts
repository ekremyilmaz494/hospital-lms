/**
 * Sistem-seviyesi feedback form şablonları.
 *
 * Admin "+ Yeni Form" akışında bir şablon seçtiğinde, backend buradaki içeriği
 * yeni bir TrainingFeedbackForm + kategoriler + item'lar olarak kopyalar.
 * Kopya daima `isActive=false` (taslak) olarak başlar.
 *
 * EY.FR.40 içeriği eski admin sayfasındaki DEFAULT_TEMPLATE'ten birebir korunmuştur.
 * Yeni şablonlar buraya eklenebilir; key benzersiz olmalı.
 */

export type FeedbackQuestionType = 'likert_5' | 'yes_partial_no' | 'text'

export type TemplateItem = {
  text: string
  questionType: FeedbackQuestionType
  isRequired: boolean
  order: number
}

export type TemplateCategory = {
  name: string
  order: number
  items: TemplateItem[]
}

export type FeedbackFormTemplate = {
  key: string
  label: string
  description: string
  defaultTitle: string
  defaultDescription: string | null
  documentCode: string | null
  /** PDF üst tablo metadata — template kopyalandığında forma seed edilir */
  publishedAt?: Date | null
  revisionNumber?: number
  revisionDate?: Date | null
  categories: TemplateCategory[]
}

export const FEEDBACK_FORM_TEMPLATES: FeedbackFormTemplate[] = [
  {
    key: 'ey-fr-03-lms',
    label: 'EY.FR.03 — Online Eğitim Değerlendirme (Önerilen)',
    description: 'LMS / online eğitim odaklı 15 soruluk değerlendirme — sistem kullanımı, teknik kalite, eğitmen, eğitim içeriği, genel deneyim.',
    defaultTitle: 'Eğitim Değerlendirme Anket Formu',
    defaultDescription: 'Online eğitim sonrası personelin doldurduğu standart değerlendirme.',
    documentCode: 'EY.FR.03',
    publishedAt: new Date('2026-01-07'),
    revisionNumber: 0,
    revisionDate: null,
    categories: [
      {
        name: 'SİSTEM & KULLANILABİLİRLİK',
        order: 0,
        items: [
          { text: 'Sisteme giriş işlemleri kolaydı', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Programın kullanımı anlaşılırdı', questionType: 'likert_5', isRequired: true, order: 1 },
          { text: 'Eğitim platformu kullanıcı dostuydu', questionType: 'likert_5', isRequired: true, order: 2 },
          { text: 'Mobil cihaz / bilgisayar uyumluluğu yeterliydi', questionType: 'likert_5', isRequired: true, order: 3 },
        ],
      },
      {
        name: 'TEKNİK KALİTE',
        order: 1,
        items: [
          { text: 'Eğitim sırasında teknik sorun yaşamadım', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Ses ve görüntü kalitesi yeterliydi', questionType: 'likert_5', isRequired: true, order: 1 },
        ],
      },
      {
        name: 'EĞİTMEN',
        order: 2,
        items: [
          { text: 'Verdiği eğitim konusundaki bilgi ve tecrübesi', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Anlatımı', questionType: 'likert_5', isRequired: true, order: 1 },
          { text: 'İletişim konusundaki başarısı', questionType: 'likert_5', isRequired: true, order: 2 },
        ],
      },
      {
        name: 'EĞİTİM İÇERİĞİ',
        order: 3,
        items: [
          { text: 'Programda ele alınan konuların işimle ilgisi', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Eğitim notları', questionType: 'likert_5', isRequired: true, order: 1 },
          { text: 'Eğitim süresi', questionType: 'likert_5', isRequired: true, order: 2 },
          { text: 'Eğitimin içeriği', questionType: 'likert_5', isRequired: true, order: 3 },
        ],
      },
      {
        name: 'GENEL DEĞERLENDİRME',
        order: 4,
        items: [
          { text: 'Sanal eğitim sistemi zaman açısından kolaylık sağladı', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Gelecekte bu yöntemle eğitim almaya devam etmek isterim', questionType: 'likert_5', isRequired: true, order: 1 },
        ],
      },
    ],
  },
  {
    key: 'ey-fr-40',
    label: 'EY.FR.40 — Eğitim Değerlendirme',
    description: 'ISO/JCI uyumlu standart eğitim değerlendirme anketi (4 kategori, 17 soru).',
    defaultTitle: 'Eğitim Değerlendirme Anket Formu',
    defaultDescription: null,
    documentCode: 'EY.FR.40',
    categories: [
      {
        name: 'EĞİTİM PROGRAMI',
        order: 0,
        items: [
          { text: 'Programda ele alınan konuların işimle ilgisi', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Görsel ve işitsel araçlar', questionType: 'likert_5', isRequired: true, order: 1 },
          { text: 'Eğitim notları', questionType: 'likert_5', isRequired: true, order: 2 },
          { text: 'Eğitim süresi', questionType: 'likert_5', isRequired: true, order: 3 },
          { text: 'Eğitimin içeriği', questionType: 'likert_5', isRequired: true, order: 4 },
        ],
      },
      {
        name: 'ORGANİZASYON',
        order: 1,
        items: [
          { text: 'Eğitim duyurusu zamanlaması', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Eğitim salonunun dizaynı', questionType: 'likert_5', isRequired: true, order: 1 },
          { text: 'Eğitim salonunun havalandırması', questionType: 'likert_5', isRequired: true, order: 2 },
          { text: 'Eğitim salonunun ışıklandırması', questionType: 'likert_5', isRequired: true, order: 3 },
          { text: 'Eğitim salonunun ses düzeni', questionType: 'likert_5', isRequired: true, order: 4 },
          { text: 'Eğitim süresince sağlanan yiyecek ve içecek', questionType: 'likert_5', isRequired: false, order: 5 },
        ],
      },
      {
        name: 'EĞİTMEN',
        order: 2,
        items: [
          { text: 'Eğitmenin, verilen program ile ilgili ön hazırlığı', questionType: 'likert_5', isRequired: true, order: 0 },
          { text: 'Verdiği eğitim konusundaki bilgi ve tecrübesi', questionType: 'likert_5', isRequired: true, order: 1 },
          { text: 'Anlatımı', questionType: 'likert_5', isRequired: true, order: 2 },
          { text: 'Programın teorik ve uygulaması arasında kurduğu denge', questionType: 'likert_5', isRequired: true, order: 3 },
          { text: 'İletişim konusundaki başarısı', questionType: 'likert_5', isRequired: true, order: 4 },
        ],
      },
      {
        name: 'GENEL DEĞERLENDİRME',
        order: 3,
        items: [
          { text: 'Bu eğitimi diğer çalışanlara da öneririm', questionType: 'yes_partial_no', isRequired: true, order: 0 },
        ],
      },
    ],
  },
  {
    key: 'blank',
    label: 'Boş Form',
    description: 'Sıfırdan kategori ve sorular ekleyerek özelleştirin.',
    defaultTitle: 'Yeni Geri Bildirim Formu',
    defaultDescription: null,
    documentCode: null,
    categories: [],
  },
]

export function getFeedbackFormTemplate(key: string): FeedbackFormTemplate | null {
  return FEEDBACK_FORM_TEMPLATES.find(t => t.key === key) ?? null
}
