import { NextResponse } from 'next/server'

const API_DOCS = {
  openapi: '3.0.3',
  info: {
    title: 'Hospital LMS API',
    version: '0.1.0',
    description: 'Hastane Personel Egitim ve Sinav Yonetim Sistemi API dokumantasyonu',
  },
  servers: [{ url: '/api', description: 'API Base URL' }],
  paths: {
    // ── Auth ──
    '/auth/login': {
      post: { summary: 'Giris yap', tags: ['Auth'], requestBody: { content: { 'application/json': { schema: { properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 200: { description: 'Basarili giris' }, 401: { description: 'Hatali kimlik' }, 429: { description: 'Rate limit' } } },
    },
    '/auth/logout': { post: { summary: 'Cikis yap', tags: ['Auth'] } },
    '/auth/me': { get: { summary: 'Mevcut kullanici bilgisi', tags: ['Auth'], security: [{ bearer: [] }] } },
    '/auth/mfa/enroll': { post: { summary: '2FA TOTP kurulumu baslat', tags: ['Auth', 'MFA'], security: [{ bearer: [] }] } },
    '/auth/mfa/verify': { post: { summary: '2FA TOTP kodu dogrula', tags: ['Auth', 'MFA'], security: [{ bearer: [] }] } },
    '/auth/mfa/unenroll': { post: { summary: '2FA devre disi birak', tags: ['Auth', 'MFA'], security: [{ bearer: [] }] } },

    // ── Admin: Dashboard ──
    '/admin/dashboard': { get: { summary: 'Dashboard verileri', tags: ['Admin'], security: [{ bearer: [] }] } },
    '/admin/dashboard/stats': { get: { summary: 'Ozet istatistikler', tags: ['Admin'], security: [{ bearer: [] }] } },

    // ── Admin: Staff ──
    '/admin/staff': {
      get: { summary: 'Personel listesi (sayfalamali)', tags: ['Admin: Personel'], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'search', in: 'query', schema: { type: 'string' } }], security: [{ bearer: [] }] },
      post: { summary: 'Yeni personel olustur', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
    },
    '/admin/staff/{id}': {
      get: { summary: 'Personel detay', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
      patch: { summary: 'Personel guncelle', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
      delete: { summary: 'Personel deaktive et (soft delete)', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
    },
    '/admin/bulk-import': { post: { summary: 'Excel ile toplu personel import', tags: ['Admin: Personel'], requestBody: { content: { 'multipart/form-data': { schema: { properties: { file: { type: 'string', format: 'binary' } } } } } }, security: [{ bearer: [] }] } },

    // ── Admin: Trainings ──
    '/admin/trainings': {
      get: { summary: 'Egitim listesi', tags: ['Admin: Egitim'], security: [{ bearer: [] }] },
      post: { summary: 'Yeni egitim olustur', tags: ['Admin: Egitim'], security: [{ bearer: [] }] },
    },
    '/admin/trainings/{id}': {
      get: { summary: 'Egitim detay', tags: ['Admin: Egitim'], security: [{ bearer: [] }] },
      patch: { summary: 'Egitim guncelle', tags: ['Admin: Egitim'], security: [{ bearer: [] }] },
      delete: { summary: 'Egitim sil', tags: ['Admin: Egitim'], security: [{ bearer: [] }] },
    },

    // ── Admin: Departments ──
    '/admin/departments': {
      get: { summary: 'Departman listesi', tags: ['Admin: Departman'], security: [{ bearer: [] }] },
      post: { summary: 'Yeni departman', tags: ['Admin: Departman'], security: [{ bearer: [] }] },
    },
    '/admin/departments/{id}': {
      patch: { summary: 'Departman guncelle', tags: ['Admin: Departman'], security: [{ bearer: [] }] },
      delete: { summary: 'Departman sil', tags: ['Admin: Departman'], security: [{ bearer: [] }] },
    },

    // ── Admin: Reports & Export ──
    '/admin/reports': { get: { summary: 'Raporlar', tags: ['Admin: Rapor'], security: [{ bearer: [] }] } },
    '/admin/export': { get: { summary: 'Excel export', tags: ['Admin: Rapor'], security: [{ bearer: [] }] } },
    '/admin/export/pdf': { get: { summary: 'PDF export', tags: ['Admin: Rapor'], security: [{ bearer: [] }] } },

    // ── Admin: Certificates ──
    '/admin/certificates': { get: { summary: 'Sertifika listesi', tags: ['Admin: Sertifika'], security: [{ bearer: [] }] } },

    // ── Admin: Notifications ──
    '/admin/notifications': {
      get: { summary: 'Bildirim listesi', tags: ['Admin: Bildirim'], security: [{ bearer: [] }] },
      post: { summary: 'Bildirim olustur', tags: ['Admin: Bildirim'], security: [{ bearer: [] }] },
    },

    // ── Admin: Backups ──
    '/admin/backups': {
      get: { summary: 'Yedek listesi', tags: ['Admin: Yedekleme'], security: [{ bearer: [] }] },
      post: { summary: 'Manuel yedek al', tags: ['Admin: Yedekleme'], security: [{ bearer: [] }] },
    },
    '/admin/backups/{id}/download': { get: { summary: 'Yedek indir', tags: ['Admin: Yedekleme'], security: [{ bearer: [] }] } },

    // ── Admin: Settings ──
    '/admin/settings': {
      get: { summary: 'Ayarlari getir', tags: ['Admin: Ayarlar'], security: [{ bearer: [] }] },
      put: { summary: 'Ayarlari guncelle', tags: ['Admin: Ayarlar'], security: [{ bearer: [] }] },
    },

    // ── Admin: Audit & Compliance ──
    '/admin/audit-logs': { get: { summary: 'Denetim kayitlari', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },
    '/admin/compliance': { get: { summary: 'Uyum raporu', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },
    '/admin/effectiveness': { get: { summary: 'Egitim etkinlik raporu', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },
    '/admin/competency-matrix': { get: { summary: 'Yetkinlik matrisi', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },

    // ── Staff ──
    '/staff/dashboard': { get: { summary: 'Personel dashboard', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/my-trainings': { get: { summary: 'Atanmis egitimler', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/my-trainings/{id}': { get: { summary: 'Egitim detay', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/certificates': { get: { summary: 'Sertifikalarim', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/calendar': { get: { summary: 'Egitim takvimi', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/profile': {
      get: { summary: 'Profil bilgileri', tags: ['Personel'], security: [{ bearer: [] }] },
      patch: { summary: 'Profil guncelle', tags: ['Personel'], security: [{ bearer: [] }] },
    },
    '/staff/notifications': { get: { summary: 'Bildirimler', tags: ['Personel'], security: [{ bearer: [] }] } },

    // ── Exam ──
    '/exam/{id}/start': { post: { summary: 'Sinav basalt', tags: ['Sinav'], security: [{ bearer: [] }] } },
    '/exam/{id}/questions': { get: { summary: 'Sinav sorulari', tags: ['Sinav'], security: [{ bearer: [] }] } },
    '/exam/{id}/save-answer': { post: { summary: 'Cevap kaydet', tags: ['Sinav'], security: [{ bearer: [] }] } },
    '/exam/{id}/submit': { post: { summary: 'Sinavi bitir', tags: ['Sinav'], security: [{ bearer: [] }] } },
    '/exam/{id}/timer': { get: { summary: 'Sinav zamanlayici', tags: ['Sinav'], security: [{ bearer: [] }] } },
    '/exam/{id}/videos': { get: { summary: 'Egitim videolari', tags: ['Sinav'], security: [{ bearer: [] }] } },

    // ── Super Admin ──
    '/super-admin/dashboard': { get: { summary: 'Platform dashboard', tags: ['Super Admin'], security: [{ bearer: [] }] } },
    '/super-admin/hospitals': {
      get: { summary: 'Hastane listesi', tags: ['Super Admin'], security: [{ bearer: [] }] },
      post: { summary: 'Yeni hastane', tags: ['Super Admin'], security: [{ bearer: [] }] },
    },
    '/super-admin/hospitals/{id}': {
      get: { summary: 'Hastane detay', tags: ['Super Admin'], security: [{ bearer: [] }] },
      patch: { summary: 'Hastane guncelle', tags: ['Super Admin'], security: [{ bearer: [] }] },
    },
    '/super-admin/subscriptions': { get: { summary: 'Abonelik planlari', tags: ['Super Admin'], security: [{ bearer: [] }] } },
    '/super-admin/reports': { get: { summary: 'Platform raporlari', tags: ['Super Admin'], security: [{ bearer: [] }] } },
    '/super-admin/audit-logs': { get: { summary: 'Platform denetim kayitlari', tags: ['Super Admin'], security: [{ bearer: [] }] } },

    // ── System ──
    '/health': { get: { summary: 'Sistem saglık kontrolu', tags: ['Sistem'], description: 'DB, Redis, Auth, S3, SMTP durumunu dondurur' } },
    '/cron/cleanup': { get: { summary: 'Gunluk temizlik (03:00 UTC)', tags: ['Sistem'] } },
    '/cron/backup': { get: { summary: 'Gunluk yedekleme (03:15 UTC)', tags: ['Sistem'] } },
  },
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Supabase JWT token' },
    },
  },
  tags: [
    { name: 'Auth', description: 'Kimlik dogrulama ve MFA' },
    { name: 'Admin', description: 'Hastane admin paneli' },
    { name: 'Admin: Personel', description: 'Personel yonetimi' },
    { name: 'Admin: Egitim', description: 'Egitim yonetimi' },
    { name: 'Admin: Departman', description: 'Departman yonetimi' },
    { name: 'Admin: Rapor', description: 'Raporlama ve export' },
    { name: 'Admin: Sertifika', description: 'Sertifika yonetimi' },
    { name: 'Admin: Bildirim', description: 'Bildirim yonetimi' },
    { name: 'Admin: Yedekleme', description: 'Veritabani yedekleme' },
    { name: 'Admin: Ayarlar', description: 'Platform ayarlari' },
    { name: 'Admin: Denetim', description: 'Denetim ve uyum' },
    { name: 'Personel', description: 'Personel paneli' },
    { name: 'Sinav', description: 'Sinav modulu' },
    { name: 'Super Admin', description: 'Platform yonetimi' },
    { name: 'Sistem', description: 'Sistem servisleri' },
  ],
}

export async function GET() {
  return NextResponse.json(API_DOCS, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
}
