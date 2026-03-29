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
      post: { summary: 'Giriş yap', tags: ['Auth'], requestBody: { content: { 'application/json': { schema: { properties: { email: { type: 'string' }, password: { type: 'string' } } } } } }, responses: { 200: { description: 'Başarılı giriş' }, 401: { description: 'Hatalı kimlik' }, 429: { description: 'Rate limit' } } },
    },
    '/auth/logout': { post: { summary: 'Çıkış yap', tags: ['Auth'] } },
    '/auth/me': { get: { summary: 'Mevcut kullanıcı bilgisi', tags: ['Auth'], security: [{ bearer: [] }] } },
    '/auth/mfa/enroll': { post: { summary: '2FA TOTP kurulumu başlat', tags: ['Auth', 'MFA'], security: [{ bearer: [] }] } },
    '/auth/mfa/verify': { post: { summary: '2FA TOTP kodu doğrula', tags: ['Auth', 'MFA'], security: [{ bearer: [] }] } },
    '/auth/mfa/unenroll': { post: { summary: '2FA devre dışı bırak', tags: ['Auth', 'MFA'], security: [{ bearer: [] }] } },

    // ── Admin: Dashboard ──
    '/admin/dashboard': { get: { summary: 'Dashboard verileri', tags: ['Admin'], security: [{ bearer: [] }] } },
    '/admin/dashboard/stats': { get: { summary: 'Özet istatistikler', tags: ['Admin'], security: [{ bearer: [] }] } },

    // ── Admin: Staff ──
    '/admin/staff': {
      get: { summary: 'Personel listesi (sayfalmalı)', tags: ['Admin: Personel'], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'search', in: 'query', schema: { type: 'string' } }], security: [{ bearer: [] }] },
      post: { summary: 'Yeni personel oluştur', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
    },
    '/admin/staff/{id}': {
      get: { summary: 'Personel detay', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
      patch: { summary: 'Personel güncelle', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
      delete: { summary: 'Personel deaktive et (soft delete)', tags: ['Admin: Personel'], security: [{ bearer: [] }] },
    },
    '/admin/bulk-import': { post: { summary: 'Excel ile toplu personel import', tags: ['Admin: Personel'], requestBody: { content: { 'multipart/form-data': { schema: { properties: { file: { type: 'string', format: 'binary' } } } } } }, security: [{ bearer: [] }] } },

    // ── Admin: Trainings ──
    '/admin/trainings': {
      get: { summary: 'Eğitim listesi', tags: ['Admin: Eğitim'], security: [{ bearer: [] }] },
      post: { summary: 'Yeni eğitim oluştur', tags: ['Admin: Eğitim'], security: [{ bearer: [] }] },
    },
    '/admin/trainings/{id}': {
      get: { summary: 'Eğitim detay', tags: ['Admin: Eğitim'], security: [{ bearer: [] }] },
      patch: { summary: 'Eğitim güncelle', tags: ['Admin: Eğitim'], security: [{ bearer: [] }] },
      delete: { summary: 'Eğitim sil', tags: ['Admin: Eğitim'], security: [{ bearer: [] }] },
    },

    // ── Admin: Departments ──
    '/admin/departments': {
      get: { summary: 'Departman listesi', tags: ['Admin: Departman'], security: [{ bearer: [] }] },
      post: { summary: 'Yeni departman', tags: ['Admin: Departman'], security: [{ bearer: [] }] },
    },
    '/admin/departments/{id}': {
      patch: { summary: 'Departman güncelle', tags: ['Admin: Departman'], security: [{ bearer: [] }] },
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
      post: { summary: 'Bildirim oluştur', tags: ['Admin: Bildirim'], security: [{ bearer: [] }] },
    },

    // ── Admin: Backups ──
    '/admin/backups': {
      get: { summary: 'Yedek listesi', tags: ['Admin: Yedekleme'], security: [{ bearer: [] }] },
      post: { summary: 'Manuel yedek al', tags: ['Admin: Yedekleme'], security: [{ bearer: [] }] },
    },
    '/admin/backups/{id}/download': { get: { summary: 'Yedek indir', tags: ['Admin: Yedekleme'], security: [{ bearer: [] }] } },

    // ── Admin: Settings ──
    '/admin/settings': {
      get: { summary: 'Ayarları getir', tags: ['Admin: Ayarlar'], security: [{ bearer: [] }] },
      put: { summary: 'Ayarları güncelle', tags: ['Admin: Ayarlar'], security: [{ bearer: [] }] },
    },

    // ── Admin: Audit & Compliance ──
    '/admin/audit-logs': { get: { summary: 'Denetim kayıtları', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },
    '/admin/compliance': { get: { summary: 'Uyum raporu', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },
    '/admin/effectiveness': { get: { summary: 'Eğitim etkinlik raporu', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },
    '/admin/competency-matrix': { get: { summary: 'Yetkinlik matrisi', tags: ['Admin: Denetim'], security: [{ bearer: [] }] } },

    // ── Staff ──
    '/staff/dashboard': { get: { summary: 'Personel dashboard', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/my-trainings': { get: { summary: 'Atanmış eğitimler', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/my-trainings/{id}': { get: { summary: 'Eğitim detay', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/certificates': { get: { summary: 'Sertifikalarım', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/calendar': { get: { summary: 'Eğitim takvimi', tags: ['Personel'], security: [{ bearer: [] }] } },
    '/staff/profile': {
      get: { summary: 'Profil bilgileri', tags: ['Personel'], security: [{ bearer: [] }] },
      patch: { summary: 'Profil güncelle', tags: ['Personel'], security: [{ bearer: [] }] },
    },
    '/staff/notifications': { get: { summary: 'Bildirimler', tags: ['Personel'], security: [{ bearer: [] }] } },

    // ── Exam ──
    '/exam/{id}/start': { post: { summary: 'Sınav başlat', tags: ['Sınav'], security: [{ bearer: [] }] } },
    '/exam/{id}/questions': { get: { summary: 'Sınav soruları', tags: ['Sınav'], security: [{ bearer: [] }] } },
    '/exam/{id}/save-answer': { post: { summary: 'Cevap kaydet', tags: ['Sınav'], security: [{ bearer: [] }] } },
    '/exam/{id}/submit': { post: { summary: 'Sınavı bitir', tags: ['Sınav'], security: [{ bearer: [] }] } },
    '/exam/{id}/timer': { get: { summary: 'Sınav zamanlayıcı', tags: ['Sınav'], security: [{ bearer: [] }] } },
    '/exam/{id}/videos': { get: { summary: 'Eğitim videoları', tags: ['Sınav'], security: [{ bearer: [] }] } },

    // ── Super Admin ──
    '/super-admin/dashboard': { get: { summary: 'Platform dashboard', tags: ['Super Admin'], security: [{ bearer: [] }] } },
    '/super-admin/hospitals': {
      get: { summary: 'Hastane listesi', tags: ['Super Admin'], security: [{ bearer: [] }] },
      post: { summary: 'Yeni hastane', tags: ['Super Admin'], security: [{ bearer: [] }] },
    },
    '/super-admin/hospitals/{id}': {
      get: { summary: 'Hastane detay', tags: ['Super Admin'], security: [{ bearer: [] }] },
      patch: { summary: 'Hastane güncelle', tags: ['Super Admin'], security: [{ bearer: [] }] },
    },
    '/super-admin/subscriptions': { get: { summary: 'Abonelik planları', tags: ['Super Admin'], security: [{ bearer: [] }] } },
    '/super-admin/reports': { get: { summary: 'Platform raporları', tags: ['Super Admin'], security: [{ bearer: [] }] } },
    '/super-admin/audit-logs': { get: { summary: 'Platform denetim kayıtları', tags: ['Super Admin'], security: [{ bearer: [] }] } },

    // ── System ──
    '/health': { get: { summary: 'Sistem sağlık kontrolü', tags: ['Sistem'], description: 'DB, Redis, Auth, S3, SMTP durumunu döndürür' } },
    '/cron/cleanup': { get: { summary: 'Günlük temizlik (03:00 UTC)', tags: ['Sistem'] } },
    '/cron/backup': { get: { summary: 'Gunluk yedekleme (03:15 UTC)', tags: ['Sistem'] } },
  },
  components: {
    securitySchemes: {
      bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Supabase JWT token' },
    },
  },
  tags: [
    { name: 'Auth', description: 'Kimlik doğrulama ve MFA' },
    { name: 'Admin', description: 'Hastane admin paneli' },
    { name: 'Admin: Personel', description: 'Personel yönetimi' },
    { name: 'Admin: Eğitim', description: 'Eğitim yönetimi' },
    { name: 'Admin: Departman', description: 'Departman yönetimi' },
    { name: 'Admin: Rapor', description: 'Raporlama ve export' },
    { name: 'Admin: Sertifika', description: 'Sertifika yönetimi' },
    { name: 'Admin: Bildirim', description: 'Bildirim yönetimi' },
    { name: 'Admin: Yedekleme', description: 'Veritabanı yedekleme' },
    { name: 'Admin: Ayarlar', description: 'Platform ayarları' },
    { name: 'Admin: Denetim', description: 'Denetim ve uyum' },
    { name: 'Personel', description: 'Personel paneli' },
    { name: 'Sınav', description: 'Sınav modülü' },
    { name: 'Super Admin', description: 'Platform yönetimi' },
    { name: 'Sistem', description: 'Sistem servisleri' },
  ],
}

export async function GET() {
  return NextResponse.json(API_DOCS, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  })
}
