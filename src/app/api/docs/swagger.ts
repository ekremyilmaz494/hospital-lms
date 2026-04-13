/**
 * OpenAPI 3.0.3 Specification for Devakent Hastanesi API
 *
 * Hastane Personel Egitim ve Sinav Yonetim Sistemi API dokumantasyonu.
 * Tum aciklamalar Turkce olarak yazilmistir.
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Devakent Hastanesi API',
    version: '1.0.0',
    description:
      'Hastane Personel Egitim ve Sinav Yonetim Sistemi (LMS) REST API dokumantasyonu.\n\n' +
      '## Kimlik Dogrulama\n' +
      'API, Supabase JWT token ile Bearer Authentication kullanir.\n' +
      'Giris yaptiktan sonra donen `access_token` degerini `Authorization: Bearer <token>` header\'i ile gonderin.\n\n' +
      '## Roller\n' +
      '- **super_admin** — Platform yonetimi (tum hastaneler)\n' +
      '- **admin** — Hastane yonetimi (kendi organizasyonu)\n' +
      '- **staff** — Personel (kendi egitim ve sinavlari)\n\n' +
      '## Multi-Tenant\n' +
      'Tum veriler `organizationId` ile izole edilmistir. Her kullanici sadece kendi organizasyonunun verilerine erisebilir.',
    contact: {
      name: 'Devakent Hastanesi Destek',
    },
  },
  servers: [{ url: '/api', description: 'API Base URL' }],

  // ────────────────────────────────────────────────────────────────────────────
  // TAGS
  // ────────────────────────────────────────────────────────────────────────────
  tags: [
    { name: 'Auth', description: 'Kimlik dogrulama, kayit ve MFA islemleri' },
    { name: 'Admin', description: 'Hastane admin paneli genel islemleri' },
    { name: 'Admin: Personel', description: 'Personel CRUD ve toplu import islemleri' },
    { name: 'Admin: Egitim', description: 'Egitim olusturma, guncelleme ve atama islemleri' },
    { name: 'Admin: Departman', description: 'Departman yonetimi' },
    { name: 'Admin: Rapor', description: 'Raporlama, Excel/PDF export islemleri' },
    { name: 'Admin: Sertifika', description: 'Sertifika yonetimi' },
    { name: 'Admin: Bildirim', description: 'Bildirim olusturma ve listeleme' },
    { name: 'Admin: Yedekleme', description: 'Veritabani yedekleme islemleri' },
    { name: 'Admin: Ayarlar', description: 'Organizasyon ve platform ayarlari' },
    { name: 'Admin: Denetim', description: 'Denetim kayitlari, uyum raporu ve yetkinlik matrisi' },
    { name: 'Personel', description: 'Personel paneli — egitimler, sertifikalar, profil' },
    { name: 'Sinav', description: 'Sinav baslat, cevap kaydet, sinavi bitir' },
    { name: 'Super Admin', description: 'Platform yonetimi — hastaneler, abonelikler, raporlar' },
    { name: 'Sistem', description: 'Saglik kontrolu ve cron islemleri' },
  ],

  // ────────────────────────────────────────────────────────────────────────────
  // PATHS
  // ────────────────────────────────────────────────────────────────────────────
  paths: {
    // ── Auth ──────────────────────────────────────────────────────────────────
    '/auth/login': {
      post: {
        summary: 'Giris yap',
        description: 'E-posta ve sifre ile giris yapar. Basarili giris sonucunda JWT token ve kullanici bilgileri doner. Rate limiting uygulanir: IP basina 20, e-posta basina 5 deneme / 15 dakika.',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Basarili giris',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginResponse' },
              },
            },
          },
          400: {
            description: 'Eksik veya hatali parametreler',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          401: {
            description: 'Hatali e-posta veya sifre',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          429: {
            description: 'Rate limit asildi — 15 dakika bekleyin',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/auth/register': {
      post: {
        summary: 'Yeni hastane kaydi (self-registration)',
        description: 'Yeni bir hastane organizasyonu ve admin kullanici olusturur. 30 gunluk ucretsiz deneme surumu baslatilir. Rate limiting: IP basina 3/saat, e-posta basina 1/24 saat.',
        tags: ['Auth'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Basarili kayit — e-posta dogrulama gerekli',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Kayit basarili. Lutfen e-postanizi dogrulayin.' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validasyon hatasi veya mevcut kayit',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          429: {
            description: 'Rate limit asildi',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/auth/logout': {
      post: {
        summary: 'Cikis yap',
        description: 'Mevcut oturumu sonlandirir ve JWT token\'i gecersiz kilar.',
        tags: ['Auth'],
        security: [{ bearer: [] }],
        responses: {
          200: { description: 'Basarili cikis' },
        },
      },
    },

    '/auth/me': {
      get: {
        summary: 'Mevcut kullanici bilgisi',
        description: 'Oturum acmis kullanicinin profil ve rol bilgilerini dondurur. Cache-Control: private, max-age=30.',
        tags: ['Auth'],
        security: [{ bearer: [] }],
        responses: {
          200: {
            description: 'Kullanici profil bilgileri',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserProfile' },
              },
            },
          },
          401: {
            description: 'Oturum gecersiz',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
        },
      },
    },

    '/auth/mfa/enroll': {
      post: {
        summary: '2FA TOTP kurulumu baslat',
        description: 'TOTP tabanli iki faktorlu kimlik dogrulama kurulumunu baslatir. QR kodu ve secret key doner.',
        tags: ['Auth'],
        security: [{ bearer: [] }],
        responses: {
          200: {
            description: 'TOTP kurulum bilgileri (QR kodu ve secret)',
          },
        },
      },
    },

    '/auth/mfa/verify': {
      post: {
        summary: '2FA TOTP kodu dogrula',
        description: 'Kullanicinin girdigi TOTP kodunu dogrular.',
        tags: ['Auth'],
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['code'],
                properties: {
                  code: { type: 'string', description: '6 haneli TOTP kodu', example: '123456' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Kod dogrulandi' },
          400: { description: 'Gecersiz kod' },
        },
      },
    },

    '/auth/mfa/unenroll': {
      post: {
        summary: '2FA devre disi birak',
        description: 'Iki faktorlu kimlik dogrulamayi devre disi birakir.',
        tags: ['Auth'],
        security: [{ bearer: [] }],
        responses: {
          200: { description: '2FA devre disi birakildi' },
        },
      },
    },

    // ── Admin: Dashboard ─────────────────────────────────────────────────────
    '/admin/dashboard': {
      get: {
        summary: 'Dashboard verileri',
        description: 'Admin paneli ana sayfa icin ozet istatistikleri dondurur.',
        tags: ['Admin'],
        security: [{ bearer: [] }],
        responses: {
          200: { description: 'Dashboard verileri' },
          401: { description: 'Yetkisiz erisim' },
          403: { description: 'Admin rolu gerekli' },
        },
      },
    },

    '/admin/dashboard/stats': {
      get: {
        summary: 'Ozet istatistikler',
        description: 'Personel, egitim ve sinav istatistiklerini dondurur.',
        tags: ['Admin'],
        security: [{ bearer: [] }],
        responses: {
          200: { description: 'Istatistik verileri' },
        },
      },
    },

    '/admin/dashboard/combined': {
      get: {
        summary: 'Birlestirilmis dashboard verileri',
        description: 'Tek istekte tum dashboard verilerini dondurur: istatistikler, grafikler, uyum uyarilari, son aktiviteler. Redis cache (5 dk TTL) kullanir. Bu endpoint, sayfa yuklenme hizini optimize etmek icin olusturulmustur.',
        tags: ['Admin'],
        security: [{ bearer: [] }],
        responses: {
          200: {
            description: 'Birlestirilmis dashboard verisi',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CombinedDashboardResponse' },
              },
            },
          },
          401: { description: 'Yetkisiz erisim' },
          403: { description: 'Admin rolu gerekli' },
        },
      },
    },

    // ── Admin: Staff ─────────────────────────────────────────────────────────
    '/admin/staff': {
      get: {
        summary: 'Personel listesi (sayfalamali)',
        description: 'Organizasyona ait personel listesini sayfalamali olarak dondurur. Arama, filtreleme ve siralama destekler.',
        tags: ['Admin: Personel'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Sayfa numarasi' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 }, description: 'Sayfa basina kayit sayisi (maks 100)' },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Ad, soyad veya e-posta ile arama' },
          { name: 'department', in: 'query', schema: { type: 'string' }, description: 'Departman ID\'sine gore filtre' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] }, description: 'Durum filtresi' },
        ],
        responses: {
          200: {
            description: 'Personel listesi',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedStaffResponse' },
              },
            },
          },
        },
      },
      post: {
        summary: 'Yeni personel olustur',
        description: 'Organizasyona yeni personel ekler. Supabase Auth kullanicisi olusturulur ve DB profili kaydedilir.',
        tags: ['Admin: Personel'],
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateStaffRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Personel olusturuldu',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StaffMember' },
              },
            },
          },
          400: { description: 'Validasyon hatasi', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          409: { description: 'E-posta zaten kayitli' },
        },
      },
    },

    '/admin/staff/{id}': {
      get: {
        summary: 'Personel detay',
        description: 'Belirtilen personelin detayli bilgilerini, egitim gecmisini ve sertifikalarini dondurur.',
        tags: ['Admin: Personel'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Personel UUID' },
        ],
        responses: {
          200: { description: 'Personel detay bilgisi' },
          404: { description: 'Personel bulunamadi' },
        },
      },
      patch: {
        summary: 'Personel guncelle',
        description: 'Personel bilgilerini gunceller.',
        tags: ['Admin: Personel'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Personel guncellendi' },
          404: { description: 'Personel bulunamadi' },
        },
      },
      delete: {
        summary: 'Personel deaktive et (soft delete)',
        description: 'Personeli pasif duruma getirir. Veriler silinmez, sadece isActive=false yapilir.',
        tags: ['Admin: Personel'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Personel deaktive edildi' },
          404: { description: 'Personel bulunamadi' },
        },
      },
    },

    '/admin/bulk-import': {
      post: {
        summary: 'Excel ile toplu personel import',
        description: 'Excel dosyasi yukleyerek toplu personel kaydı olusturur. Dosya server-side islenir.',
        tags: ['Admin: Personel'],
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary', description: 'Excel dosyasi (.xlsx)' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Import sonucu',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    imported: { type: 'integer', description: 'Basarili import sayisi' },
                    errors: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          row: { type: 'integer' },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    // ── Admin: Trainings ─────────────────────────────────────────────────────
    '/admin/trainings': {
      get: {
        summary: 'Egitim listesi',
        description: 'Organizasyona ait tum egitimleri listeler. Filtreleme ve sayfalama destekler.',
        tags: ['Admin: Egitim'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Egitim adi ile arama' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive', 'draft'] } },
        ],
        responses: {
          200: {
            description: 'Egitim listesi',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PaginatedTrainingsResponse' },
              },
            },
          },
        },
      },
      post: {
        summary: 'Yeni egitim olustur',
        description: 'Yeni bir egitim kaydı olusturur. 4 adimli sihirbaz ile videolar, sorular ve atamalar eklenebilir.',
        tags: ['Admin: Egitim'],
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTrainingRequest' },
            },
          },
        },
        responses: {
          201: {
            description: 'Egitim olusturuldu',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Training' },
              },
            },
          },
          400: { description: 'Validasyon hatasi' },
        },
      },
    },

    '/admin/trainings/{id}': {
      get: {
        summary: 'Egitim detay',
        description: 'Belirtilen egitimin tum detaylarini, videolarini, sorularini ve atamalarini dondurur.',
        tags: ['Admin: Egitim'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Egitim detay bilgisi' },
          404: { description: 'Egitim bulunamadi' },
        },
      },
      patch: {
        summary: 'Egitim guncelle',
        description: 'Egitim bilgilerini gunceller.',
        tags: ['Admin: Egitim'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Egitim guncellendi' },
          404: { description: 'Egitim bulunamadi' },
        },
      },
      delete: {
        summary: 'Egitim sil',
        description: 'Egitimi siler. Aktif atamalari olan egitimler silinemez.',
        tags: ['Admin: Egitim'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: { description: 'Egitim silindi' },
          400: { description: 'Aktif atamalari olan egitim silinemez' },
          404: { description: 'Egitim bulunamadi' },
        },
      },
    },

    // ── Admin: Departments ───────────────────────────────────────────────────
    '/admin/departments': {
      get: {
        summary: 'Departman listesi',
        description: 'Organizasyona ait tum departmanlari listeler.',
        tags: ['Admin: Departman'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Departman listesi' } },
      },
      post: {
        summary: 'Yeni departman olustur',
        description: 'Organizasyona yeni departman ekler.',
        tags: ['Admin: Departman'],
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string', description: 'Departman adi', example: 'Kardiyoloji' },
                  description: { type: 'string', description: 'Aciklama' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Departman olusturuldu' },
          400: { description: 'Validasyon hatasi' },
        },
      },
    },

    '/admin/departments/{id}': {
      patch: {
        summary: 'Departman guncelle',
        tags: ['Admin: Departman'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Departman guncellendi' } },
      },
      delete: {
        summary: 'Departman sil',
        tags: ['Admin: Departman'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Departman silindi' } },
      },
    },

    // ── Admin: Reports & Export ──────────────────────────────────────────────
    '/admin/reports': {
      get: {
        summary: 'Raporlar',
        description: 'Egitim tamamlama, personel performans ve uyum raporlarini dondurur.',
        tags: ['Admin: Rapor'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Rapor verileri' } },
      },
    },

    '/admin/export': {
      get: {
        summary: 'Excel export',
        description: 'Secilen verileri Excel (.xlsx) dosyasi olarak indirir.',
        tags: ['Admin: Rapor'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['staff', 'trainings', 'assignments', 'certificates'] }, description: 'Export tipi' },
        ],
        responses: {
          200: {
            description: 'Excel dosyasi',
            content: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {} },
          },
        },
      },
    },

    '/admin/export/pdf': {
      get: {
        summary: 'PDF export',
        description: 'Secilen verileri PDF dosyasi olarak indirir. Turkce karakter destegi mevcuttur.',
        tags: ['Admin: Rapor'],
        security: [{ bearer: [] }],
        responses: {
          200: {
            description: 'PDF dosyasi',
            content: { 'application/pdf': {} },
          },
        },
      },
    },

    // ── Admin: Certificates ──────────────────────────────────────────────────
    '/admin/certificates': {
      get: {
        summary: 'Sertifika listesi',
        description: 'Organizasyona ait tum sertifikalari listeler.',
        tags: ['Admin: Sertifika'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Sertifika listesi' } },
      },
    },

    // ── Admin: Notifications ─────────────────────────────────────────────────
    '/admin/notifications': {
      get: {
        summary: 'Bildirim listesi',
        description: 'Admin bildirimlerini listeler.',
        tags: ['Admin: Bildirim'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Bildirim listesi' } },
      },
      post: {
        summary: 'Bildirim olustur',
        description: 'Personele bildirim gonderir. Supabase Realtime ile anlik iletilir.',
        tags: ['Admin: Bildirim'],
        security: [{ bearer: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'message'],
                properties: {
                  title: { type: 'string', description: 'Bildirim basligi' },
                  message: { type: 'string', description: 'Bildirim mesaji' },
                  userId: { type: 'string', format: 'uuid', description: 'Hedef kullanici (bos ise tum personele)' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Bildirim olusturuldu' },
        },
      },
    },

    // ── Admin: Backups ───────────────────────────────────────────────────────
    '/admin/backups': {
      get: {
        summary: 'Yedek listesi',
        description: 'Organizasyona ait veritabani yedeklerini listeler.',
        tags: ['Admin: Yedekleme'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Yedek listesi' } },
      },
      post: {
        summary: 'Manuel yedek al',
        description: 'Veritabaninin manuel yedegini olusturur.',
        tags: ['Admin: Yedekleme'],
        security: [{ bearer: [] }],
        responses: { 201: { description: 'Yedekleme baslatildi' } },
      },
    },

    '/admin/backups/{id}/download': {
      get: {
        summary: 'Yedek indir',
        tags: ['Admin: Yedekleme'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Yedek dosyasi' } },
      },
    },

    // ── Admin: Settings ──────────────────────────────────────────────────────
    '/admin/settings': {
      get: {
        summary: 'Ayarlari getir',
        description: 'Organizasyon ayarlarini dondurur (oturum suresi, bildirim tercihleri, vb.).',
        tags: ['Admin: Ayarlar'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Ayar bilgileri' } },
      },
      put: {
        summary: 'Ayarlari guncelle',
        description: 'Organizasyon ayarlarini gunceller.',
        tags: ['Admin: Ayarlar'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Ayarlar guncellendi' } },
      },
    },

    // ── Admin: Audit & Compliance ────────────────────────────────────────────
    '/admin/audit-logs': {
      get: {
        summary: 'Denetim kayitlari',
        description: 'Organizasyondaki tum kullanici islemlerinin denetim kayitlarini listeler.',
        tags: ['Admin: Denetim'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'action', in: 'query', schema: { type: 'string' }, description: 'Islem tipine gore filtre' },
          { name: 'userId', in: 'query', schema: { type: 'string', format: 'uuid' }, description: 'Kullanici ID\'sine gore filtre' },
        ],
        responses: { 200: { description: 'Denetim kayitlari listesi' } },
      },
    },

    '/admin/compliance': {
      get: {
        summary: 'Uyum raporu',
        description: 'Zorunlu egitimlerin tamamlanma durumunu ve uyum oranlarini raporlar.',
        tags: ['Admin: Denetim'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Uyum raporu verileri' } },
      },
    },

    '/admin/effectiveness': {
      get: {
        summary: 'Egitim etkinlik raporu',
        description: 'Egitimlerin etkinligini olcer: tamamlanma orani, sinav skorlari, tekrar deneme sayilari.',
        tags: ['Admin: Denetim'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Etkinlik raporu verileri' } },
      },
    },

    '/admin/competency-matrix': {
      get: {
        summary: 'Yetkinlik matrisi',
        description: 'Personelin egitim tamamlama durumunu matris formatinda gosterir.',
        tags: ['Admin: Denetim'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Yetkinlik matrisi verileri' } },
      },
    },

    // ── Staff ────────────────────────────────────────────────────────────────
    '/staff/dashboard': {
      get: {
        summary: 'Personel dashboard',
        description: 'Personelin ozet bilgilerini dondurur: atanmis egitimler, tamamlama durumu, yaklasan sinavlar.',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Personel dashboard verileri' } },
      },
    },

    '/staff/my-trainings': {
      get: {
        summary: 'Atanmis egitimler',
        description: 'Personele atanmis tum egitimleri durumlarıyla birlikte listeler.',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        responses: {
          200: {
            description: 'Egitim listesi',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/StaffTrainingAssignment' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/staff/my-trainings/{id}': {
      get: {
        summary: 'Egitim detay',
        description: 'Atanmis egitimin detay bilgileri ve ilerleme durumunu dondurur.',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Egitim detay bilgisi' }, 404: { description: 'Egitim bulunamadi' } },
      },
    },

    '/staff/certificates': {
      get: {
        summary: 'Sertifikalarim',
        description: 'Personelin kazandigi tum sertifikalari listeler.',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Sertifika listesi' } },
      },
    },

    '/staff/calendar': {
      get: {
        summary: 'Egitim takvimi',
        description: 'Personelin egitim takvimini dondurur.',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Takvim verileri' } },
      },
    },

    '/staff/profile': {
      get: {
        summary: 'Profil bilgileri',
        description: 'Personelin profil bilgilerini dondurur.',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        responses: {
          200: {
            description: 'Profil bilgileri',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/UserProfile' } } },
          },
        },
      },
      patch: {
        summary: 'Profil guncelle',
        description: 'Personelin profil bilgilerini gunceller (ad, soyad, telefon, avatar).',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Profil guncellendi' } },
      },
    },

    '/staff/notifications': {
      get: {
        summary: 'Bildirimler',
        description: 'Personelin bildirimlerini listeler. Supabase Realtime ile anlik guncellenir.',
        tags: ['Personel'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Bildirim listesi' } },
      },
    },

    // ── Exam ─────────────────────────────────────────────────────────────────
    '/exam/{id}/start': {
      post: {
        summary: 'Sinav baslat',
        description: 'Yeni bir sinav denemesi baslatir veya mevcut aktif denemeyi devam ettirir. Rate limit: kullanici basina 10 baslangic / 1 saat. Egitim tarih araligi ve maksimum deneme sayisi kontrol edilir.',
        tags: ['Sinav'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Training assignment UUID' },
        ],
        responses: {
          200: {
            description: 'Sinav denemesi baslatildi veya mevcut deneme donduruldu',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExamAttemptResponse' },
              },
            },
          },
          403: {
            description: 'Egitim henuz baslanmamis, suresi dolmus veya kilitlenmis',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
          },
          404: { description: 'Atama bulunamadi' },
          429: { description: 'Rate limit asildi — 60 dakika bekleyin' },
        },
      },
    },

    '/exam/{id}/questions': {
      get: {
        summary: 'Sinav sorulari',
        description: 'Aktif sinav denemesinin sorularini dondurur.',
        tags: ['Sinav'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          200: {
            description: 'Soru listesi',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    questions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ExamQuestion' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/exam/{id}/save-answer': {
      post: {
        summary: 'Cevap kaydet',
        description: 'Tek bir sorunun cevabini kaydeder. Sinav bitene kadar cevaplar degistirilebilir.',
        tags: ['Sinav'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['questionId', 'selectedOption'],
                properties: {
                  questionId: { type: 'string', format: 'uuid', description: 'Soru UUID' },
                  selectedOption: { type: 'integer', description: 'Secilen secenek indeksi (0-3)' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Cevap kaydedildi' },
        },
      },
    },

    '/exam/{id}/submit': {
      post: {
        summary: 'Sinavi bitir ve degerlendirmeye gonder',
        description: 'Sinav denemesini tamamlar ve otomatik degerlendirme yapar. Basarili ise sertifika olusturulur. Rate limit: kullanici basina 20 gonderim / 1 saat.',
        tags: ['Sinav'],
        security: [{ bearer: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'Exam attempt UUID veya assignment UUID' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ExamSubmitRequest' },
            },
          },
        },
        responses: {
          200: {
            description: 'Sinav degerlendirme sonucu',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExamSubmitResponse' },
              },
            },
          },
          400: { description: 'Gecersiz veri' },
          404: { description: 'Sinav denemesi bulunamadi' },
          429: { description: 'Rate limit asildi' },
        },
      },
    },

    '/exam/{id}/timer': {
      get: {
        summary: 'Sinav zamanlayici',
        description: 'Sinav icin kalan sureyi Redis\'ten dondurur.',
        tags: ['Sinav'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: {
            description: 'Kalan sure',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    remainingSeconds: { type: 'integer', description: 'Kalan sure (saniye)' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/exam/{id}/videos': {
      get: {
        summary: 'Egitim videolari',
        description: 'Egitim videolarinin signed URL\'lerini dondurur. CloudFront uzerinden sunulur.',
        tags: ['Sinav'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Video listesi ve signed URL\'ler' },
        },
      },
    },

    // ── Super Admin ──────────────────────────────────────────────────────────
    '/super-admin/dashboard': {
      get: {
        summary: 'Platform dashboard',
        description: 'Tum platformun ozet istatistiklerini dondurur: toplam hastane, kullanici, egitim, gelir bilgileri.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Platform istatistikleri' } },
      },
    },

    '/super-admin/hospitals': {
      get: {
        summary: 'Hastane listesi',
        description: 'Platformdaki tum hastaneleri (organizasyonlari) listeler.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Hastane listesi' } },
      },
      post: {
        summary: 'Yeni hastane olustur',
        description: 'Platforma yeni bir hastane organizasyonu ekler.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        responses: { 201: { description: 'Hastane olusturuldu' } },
      },
    },

    '/super-admin/hospitals/{id}': {
      get: {
        summary: 'Hastane detay',
        description: 'Belirtilen hastanenin detayli bilgilerini dondurur.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Hastane detay bilgisi' }, 404: { description: 'Hastane bulunamadi' } },
      },
      patch: {
        summary: 'Hastane guncelle',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Hastane guncellendi' } },
      },
    },

    '/super-admin/subscriptions': {
      get: {
        summary: 'Abonelik planlari',
        description: 'Mevcut abonelik planlarini ve fiyatlandirma bilgilerini listeler.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Abonelik plan listesi' } },
      },
    },

    '/super-admin/reports': {
      get: {
        summary: 'Platform raporlari',
        description: 'Platform genelindeki raporlari dondurur.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Platform rapor verileri' } },
      },
    },

    '/super-admin/audit-logs': {
      get: {
        summary: 'Platform denetim kayitlari',
        description: 'Tum platformdaki denetim kayitlarini listeler.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        responses: { 200: { description: 'Platform denetim kayitlari' } },
      },
    },

    '/super-admin/system-health': {
      get: {
        summary: 'Sistem saglik kontrolu (detayli)',
        description: 'Tum servislerin saglik durumunu kontrol eder: PostgreSQL, Redis, Supabase Auth, AWS S3, SMTP. Her servis icin durum (up/down/degraded) ve yanit suresi doner. Sadece super_admin erisebilir.',
        tags: ['Super Admin'],
        security: [{ bearer: [] }],
        responses: {
          200: {
            description: 'Sistem saglik durumu',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SystemHealthResponse' },
              },
            },
          },
          401: { description: 'Yetkisiz erisim' },
          403: { description: 'super_admin rolu gerekli' },
        },
      },
    },

    // ── System ───────────────────────────────────────────────────────────────
    '/health': {
      get: {
        summary: 'Sistem saglik kontrolu (basit)',
        description: 'DB, Redis, Auth, S3, SMTP durumunu dondurur. Public erisim.',
        tags: ['Sistem'],
        responses: {
          200: { description: 'Tum servisler calisiyor' },
          503: { description: 'Bir veya birden fazla servis calismıyor' },
        },
      },
    },

    '/cron/cleanup': {
      get: {
        summary: 'Gunluk temizlik (03:00 UTC)',
        description: 'Eskimis sinav denemeleri, eski bildirimler ve denetim kayitlarini temizler. Vercel Cron ile tetiklenir.',
        tags: ['Sistem'],
        responses: { 200: { description: 'Temizlik tamamlandi' } },
      },
    },

    '/cron/backup': {
      get: {
        summary: 'Gunluk yedekleme (03:15 UTC)',
        description: 'Otomatik veritabani yedeklemesi olusturur. Vercel Cron ile tetiklenir.',
        tags: ['Sistem'],
        responses: { 200: { description: 'Yedekleme tamamlandi' } },
      },
    },
  },

  // ────────────────────────────────────────────────────────────────────────────
  // COMPONENTS
  // ────────────────────────────────────────────────────────────────────────────
  components: {
    securitySchemes: {
      bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase JWT token. Giris yaptiktan sonra donen access_token degerini gonderin.',
      },
    },

    schemas: {
      // ── Error ──
      ErrorResponse: {
        type: 'object',
        properties: {
          error: { type: 'string', description: 'Hata mesaji (Turkce)', example: 'Gecersiz istek verisi' },
        },
      },

      // ── Auth ──
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'E-posta adresi', example: 'kullanici@firma.com' },
          password: { type: 'string', format: 'password', description: 'Sifre (min 8 karakter)' },
        },
      },

      LoginResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              email: { type: 'string', format: 'email' },
              role: { type: 'string', enum: ['super_admin', 'admin', 'staff'] },
            },
          },
          redirectTo: { type: 'string', description: 'Yonlendirilecek sayfa URL\'i', example: '/admin/dashboard' },
          mfaRequired: { type: 'boolean', description: '2FA dogrulamasi gerekiyorsa true' },
        },
      },

      RegisterRequest: {
        type: 'object',
        required: ['hospitalName', 'hospitalCode', 'firstName', 'lastName', 'email', 'password'],
        properties: {
          hospitalName: { type: 'string', description: 'Hastane adi', example: 'Ornek Devlet Hastanesi' },
          hospitalCode: { type: 'string', description: 'Benzersiz hastane kodu', example: 'ODH-001' },
          address: { type: 'string', description: 'Adres (opsiyonel)' },
          phone: { type: 'string', description: 'Telefon (opsiyonel)' },
          firstName: { type: 'string', description: 'Yonetici adi', example: 'Ahmet' },
          lastName: { type: 'string', description: 'Yonetici soyadi', example: 'Yilmaz' },
          email: { type: 'string', format: 'email', description: 'Yonetici e-postasi' },
          password: { type: 'string', format: 'password', description: 'Sifre (min 8 karakter)' },
        },
      },

      UserProfile: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', enum: ['super_admin', 'admin', 'staff'] },
          organizationId: { type: 'string', format: 'uuid' },
          departmentId: { type: 'string', format: 'uuid', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // ── Staff ──
      CreateStaffRequest: {
        type: 'object',
        required: ['email', 'firstName', 'lastName', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: 'Personel e-postasi' },
          firstName: { type: 'string', description: 'Ad' },
          lastName: { type: 'string', description: 'Soyad' },
          password: { type: 'string', format: 'password', description: 'Gecici sifre' },
          departmentId: { type: 'string', format: 'uuid', description: 'Departman ID (opsiyonel)' },
          title: { type: 'string', description: 'Unvan (opsiyonel)', example: 'Hemsire' },
        },
      },

      StaffMember: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: { type: 'string', example: 'staff' },
          departmentId: { type: 'string', format: 'uuid', nullable: true },
          isActive: { type: 'boolean' },
          title: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      PaginatedStaffResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/StaffMember' },
          },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },

      // ── Training ──
      CreateTrainingRequest: {
        type: 'object',
        required: ['title', 'startDate', 'endDate'],
        properties: {
          title: { type: 'string', description: 'Egitim basligi', example: 'Enfeksiyon Kontrol Egitimi' },
          description: { type: 'string', description: 'Egitim aciklamasi' },
          startDate: { type: 'string', format: 'date-time', description: 'Baslangic tarihi' },
          endDate: { type: 'string', format: 'date-time', description: 'Bitis tarihi' },
          isCompulsory: { type: 'boolean', description: 'Zorunlu egitim mi?', default: false },
          passingScore: { type: 'integer', description: 'Gecme notu (0-100)', default: 70 },
          maxAttempts: { type: 'integer', description: 'Maksimum deneme sayisi', default: 3 },
          timeLimitMinutes: { type: 'integer', description: 'Sinav suresi (dakika)', example: 30 },
        },
      },

      Training: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          isActive: { type: 'boolean' },
          isCompulsory: { type: 'boolean' },
          passingScore: { type: 'integer' },
          maxAttempts: { type: 'integer' },
          timeLimitMinutes: { type: 'integer', nullable: true },
          organizationId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      PaginatedTrainingsResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Training' },
          },
          pagination: { $ref: '#/components/schemas/Pagination' },
        },
      },

      // ── Staff Training Assignment ──
      StaffTrainingAssignment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          trainingId: { type: 'string', format: 'uuid' },
          trainingTitle: { type: 'string' },
          status: { type: 'string', enum: ['assigned', 'in_progress', 'passed', 'failed', 'locked'] },
          currentAttempt: { type: 'integer' },
          maxAttempts: { type: 'integer' },
          score: { type: 'integer', nullable: true },
          assignedAt: { type: 'string', format: 'date-time' },
          completedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },

      // ── Exam ──
      ExamAttemptResponse: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid', description: 'Sinav denemesi UUID' },
          assignmentId: { type: 'string', format: 'uuid' },
          attemptNumber: { type: 'integer' },
          phase: { type: 'string', enum: ['pre_exam', 'video', 'post_exam'], description: 'Mevcut asama' },
          startedAt: { type: 'string', format: 'date-time' },
          videoProgress: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                videoId: { type: 'string', format: 'uuid' },
                completed: { type: 'boolean' },
              },
            },
          },
        },
      },

      ExamQuestion: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          text: { type: 'string', description: 'Soru metni' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Secenekler (4 adet)',
          },
          selectedOption: { type: 'integer', nullable: true, description: 'Daha once kaydedilmis cevap' },
        },
      },

      ExamSubmitRequest: {
        type: 'object',
        required: ['answers', 'phase'],
        properties: {
          phase: { type: 'string', enum: ['pre_exam', 'post_exam'], description: 'Sinav asamasi' },
          answers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['questionId', 'selectedOption'],
              properties: {
                questionId: { type: 'string', format: 'uuid' },
                selectedOption: { type: 'integer' },
              },
            },
          },
        },
      },

      ExamSubmitResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          score: { type: 'integer', description: 'Alinan puan (0-100)' },
          passed: { type: 'boolean', description: 'Gecti mi?' },
          correctAnswers: { type: 'integer', description: 'Dogru cevap sayisi' },
          totalQuestions: { type: 'integer', description: 'Toplam soru sayisi' },
          certificateId: { type: 'string', format: 'uuid', nullable: true, description: 'Basarili ise olusturulan sertifika ID' },
        },
      },

      // ── Dashboard ──
      CombinedDashboardResponse: {
        type: 'object',
        properties: {
          stats: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string', example: 'Toplam Personel' },
                value: { type: 'integer' },
                trend: { type: 'number', description: 'Son 30 gundeki degisim yuzdesi' },
              },
            },
          },
          statusDistribution: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Tamamlanan' },
                value: { type: 'integer' },
                color: { type: 'string' },
              },
            },
          },
          complianceAlerts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                training: { type: 'string' },
                regulatoryBody: { type: 'string' },
                daysLeft: { type: 'integer' },
                complianceRate: { type: 'integer' },
                status: { type: 'string', enum: ['ok', 'warning', 'critical'] },
              },
            },
          },
          recentActivity: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                user: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
      },

      // ── System Health ──
      SystemHealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'PostgreSQL' },
                status: { type: 'string', enum: ['up', 'down', 'degraded'] },
                responseTimeMs: { type: 'integer', description: 'Yanit suresi (ms)' },
                lastChecked: { type: 'string', format: 'date-time' },
                message: { type: 'string', nullable: true },
              },
            },
          },
          uptime: { type: 'string', description: 'Platform calisma suresi' },
        },
      },

      // ── Shared ──
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer', description: 'Mevcut sayfa' },
          limit: { type: 'integer', description: 'Sayfa basina kayit sayisi' },
          total: { type: 'integer', description: 'Toplam kayit sayisi' },
          totalPages: { type: 'integer', description: 'Toplam sayfa sayisi' },
        },
      },
    },
  },
}
