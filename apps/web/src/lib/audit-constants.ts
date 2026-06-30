/**
 * Audit (İşlem Geçmişi) etiket sözlüğü — TEK doğruluk kaynağı.
 *
 * Admin (`/admin/audit-logs`) ve Super-admin (`/super-admin/audit-logs`) audit
 * sayfaları buradan okur. Ham `action` / `entityType` kodlarını (ör. `exam.passed`,
 * `training_feedback_response`) kullanıcıya uygun Türkçe metne çevirir.
 *
 * Yeni bir audit action/entityType eklendiğinde buraya da Türkçe karşılığını ekle —
 * aksi halde UI'da humanize edilmiş (ama İngilizce kalabilen) ham kod görünür.
 *
 * Kod envanteri repodaki tüm `audit({ action, entityType })` / `createAuditLog`
 * çağrılarından çıkarıldı (Haziran 2026).
 */

export type AuditBadgeVariant =
  | 'k-badge-info'
  | 'k-badge-success'
  | 'k-badge-warning'
  | 'k-badge-error'
  | 'k-badge-muted';

/** action kodu → Türkçe etiket. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  // Genel CRUD (hem küçük hem BÜYÜK harfli kullanımlar mevcut)
  create: 'Oluşturma',
  CREATE: 'Oluşturma',
  update: 'Güncelleme',
  UPDATE: 'Güncelleme',
  delete: 'Silme',
  DELETE: 'Silme',
  add: 'Ekleme',
  upload: 'Yükleme',
  duplicate: 'Kopyalama',
  restore: 'Geri Yükleme',
  suspend: 'Askıya Alma',
  unsuspend: 'Askıyı Kaldırma',
  deactivate: 'Pasifleştirme',
  revoke: 'İptal Etme',
  approve: 'Onaylama',
  approved: 'Onaylandı',
  reject: 'Reddetme',
  rejected: 'Reddedildi',
  sign: 'İmzalama',
  assign: 'Atama',
  unassign: 'Atama Kaldırma',
  noop: 'İşlem Yok',

  // Kimlik / oturum
  login: 'Giriş',
  logout: 'Çıkış',
  self_register: 'Kendi Kaydını Oluşturma',
  impersonate: 'Kullanıcı Kimliğine Bürünme',
  impersonate_login: 'Kimliğe Bürünerek Giriş',
  'password.changed': 'Şifre Değiştirildi',
  password_change: 'Şifre Değişikliği',
  'email.update': 'E-posta Güncelleme',
  'sso.update': 'SSO Güncelleme',
  'profile.updated': 'Profil Güncellendi',
  profile_update: 'Profil Güncelleme',
  'user.password.reset_by_admin': 'Şifre Sıfırlama (Admin)',
  'user.password.reset_by_super_admin': 'Şifre Sıfırlama (Süper Admin)',
  'staff.bulk_password_reset_by_super_admin': 'Personel Toplu Şifre Sıfırlama (Süper Admin)',

  // KVKK / kişisel veri
  KVKK_DATA_DELETION: 'KVKK Veri Silme',
  KVKK_NOTICE_ACKNOWLEDGED: 'KVKK Aydınlatma Onayı',
  TC_DECRYPTED_FOR_REPORT: 'TC Kimlik Rapor İçin Çözüldü',

  // Eğitim
  'training.create.full': 'Eğitim Oluşturma',
  'training.draft.create': 'Eğitim Taslağı Oluşturma',
  'training.publish': 'Eğitim Yayınlama',
  'training.update': 'Eğitim Güncelleme',
  'training.delete': 'Eğitim Silme',
  course_view: 'Eğitim Görüntüleme',
  'training_category.create': 'Eğitim Kategorisi Oluşturma',
  'training_category.update': 'Eğitim Kategorisi Güncelleme',
  'training_category.delete': 'Eğitim Kategorisi Silme',
  'training_period.create': 'Eğitim Dönemi Oluşturma',
  'training_period.update': 'Eğitim Dönemi Güncelleme',
  'training_period.close': 'Eğitim Dönemi Kapatma',
  'training_period.delete': 'Eğitim Dönemi Silme',

  // Atama
  assign_training: 'Eğitim Atama',
  auto_assign: 'Otomatik Atama',
  bulk_assign: 'Toplu Atama',
  reassign_round: 'Yeniden Atama (Yeni Tur)',
  reopen_assignment: 'Atamayı Yeniden Açma',
  send_reminder: 'Hatırlatma Gönderme',

  // Sınav (exam) + oyunlaştırma
  'exam.started': 'Sınav Başlatıldı',
  exam_start: 'Sınav Başlatma',
  'exam.passed': 'Sınav Geçildi',
  'exam.failed': 'Sınav Kaldı',
  exam_pass: 'Sınav Geçildi',
  reset_attempt: 'Sınav Hakkı Sıfırlama',
  training_complete: 'Eğitim Tamamlandı',
  'score.earned': 'Puan Kazanıldı',
  score_earned: 'Puan Kazanıldı',
  event: 'Etkinlik',

  // Bağımsız sınav
  'standalone_exam.create': 'Bağımsız Sınav Oluşturma',
  'standalone_exam.update': 'Bağımsız Sınav Güncelleme',
  'standalone_exam.delete': 'Bağımsız Sınav Silme',
  'standalone_exam.export': 'Bağımsız Sınav Dışa Aktarımı',

  // Soru bankası
  'question_bank.create': 'Soru Bankası Oluşturma',
  'question_bank.update': 'Soru Bankası Güncelleme',
  'question_bank.delete': 'Soru Bankası Silme',
  'question_bank.import': 'Soru Bankası İçe Aktarma',
  'ai.generate-questions': 'AI Soru Üretimi',

  // SCORM
  scorm_upload: 'SCORM Yükleme',
  'scorm.assignment_passed': 'SCORM Eğitimi Geçildi',
  scorm_certificate_created: 'SCORM Sertifikası Oluşturuldu',

  // Sertifika
  'certificate.create': 'Sertifika Oluşturma',
  'certificate.created_manual': 'Sertifika (Manuel) Oluşturma',
  'certificate.restored': 'Sertifika Geri Yükleme',
  'certificate.revoked': 'Sertifika İptali',
  certificate_download: 'Sertifika İndirme',

  // Geri bildirim
  'feedback.submitted': 'Geri Bildirim Gönderildi',
  feedback_submit: 'Geri Bildirim Gönderildi',
  'feedback.export': 'Geri Bildirim Dışa Aktarımı',
  'feedback_form.created': 'Geri Bildirim Formu Oluşturuldu',
  'feedback_form.updated': 'Geri Bildirim Formu Güncellendi',
  'feedback_form.activated': 'Geri Bildirim Formu Aktifleştirildi',
  'feedback_form.archived': 'Geri Bildirim Formu Arşivlendi',
  'feedback_form.deleted': 'Geri Bildirim Formu Silindi',
  'feedback_form.duplicated': 'Geri Bildirim Formu Kopyalandı',
  'feedback_form.restored': 'Geri Bildirim Formu Geri Yüklendi',
  feedback_response_download: 'Geri Bildirim Yanıtı İndirme',
  feedback_response_bulk_download: 'Geri Bildirim Yanıtları Toplu İndirme',

  // Departman
  'department.create': 'Departman Oluşturma',
  'department.update': 'Departman Güncelleme',
  'department.delete': 'Departman Silme',
  'department.add_member': 'Departmana Üye Ekleme',
  'department.remove_member': 'Departmandan Üye Çıkarma',
  'department.members.add': 'Departmana Üye Ekleme',
  'department.members.remove': 'Departmandan Üye Çıkarma',
  'department.training_rule.create': 'Departman Eğitim Kuralı Oluşturma',
  'department.training_rule.delete': 'Departman Eğitim Kuralı Silme',

  // Davet
  'invitation.create': 'Davet Oluşturma',
  'invitation.accept': 'Davet Kabul',
  'invitation.revoke': 'Davet İptali',

  // Yetkinlik (competency)
  EVALUATION_COMPLETED: 'Değerlendirme Tamamlandı',

  // Medya kütüphanesi
  'media_asset.create': 'Medya Kütüphanesi Yükleme',
  'media_asset.delete': 'Medya Kütüphanesi Silme',

  // Akreditasyon
  accreditation_action_plan_created: 'Akreditasyon Aksiyon Planı Oluşturuldu',
  accreditation_report_generated: 'Akreditasyon Raporu Üretildi',
  'accreditation_standard.create': 'Akreditasyon Standardı Oluşturma',
  'accreditation_standard.update': 'Akreditasyon Standardı Güncelleme',
  'accreditation_standard.delete': 'Akreditasyon Standardı Silme',

  // Personel / kullanıcı dışa aktarım
  STAFF_EXPORT: 'Personel Dışa Aktarımı',
  STAFF_CREDENTIALS_PDF_GENERATED: 'Personel Giriş Bilgileri PDF Üretildi',

  // Toplu işlemler / yedek / geri yükleme
  bulk_import: 'Toplu İçe Aktarma',
  bulk_rollback: 'Toplu Geri Alma',
  restore_preview: 'Geri Yükleme Önizleme',
  restore_executed: 'Geri Yükleme Uygulandı',

  // Bildirim
  'notification.bulk_send': 'Toplu Bildirim Gönderme',

  // Ödeme / abonelik
  'payment.checkout.start': 'Ödeme Başlatıldı',
  'invoice.sent': 'Fatura Gönderildi',
  'org.ownership_transfer': 'Sahiplik Devri',

  // Rapor / dışa aktarım
  'data.export': 'Dışa Aktarım',
  'report.export': 'Rapor Dışa Aktarımı',

  // Ayarlar
  'settings.update': 'Ayar Güncelleme',
};

/** entityType kodu → { badge varyantı, Türkçe etiket }. */
export const AUDIT_ENTITY_BADGE: Record<string, { variant: AuditBadgeVariant; label: string }> = {
  // Eğitim
  training: { variant: 'k-badge-info', label: 'Eğitim' },
  training_category: { variant: 'k-badge-info', label: 'Eğitim Kategorisi' },
  training_period: { variant: 'k-badge-info', label: 'Eğitim Dönemi' },
  training_video: { variant: 'k-badge-info', label: 'Eğitim Videosu' },
  video: { variant: 'k-badge-info', label: 'Video' },
  media_asset: { variant: 'k-badge-info', label: 'Medya Kütüphanesi' },

  // Atama / sınav
  assignment: { variant: 'k-badge-info', label: 'Atama' },
  training_assignment: { variant: 'k-badge-info', label: 'Eğitim Ataması' },
  exam_attempt: { variant: 'k-badge-warning', label: 'Sınav' },
  exam_attempt_request: { variant: 'k-badge-warning', label: 'Sınav Hakkı Talebi' },
  question: { variant: 'k-badge-info', label: 'Soru' },
  question_bank: { variant: 'k-badge-info', label: 'Soru Bankası' },

  // Kişi
  user: { variant: 'k-badge-info', label: 'Kullanıcı' },
  User: { variant: 'k-badge-info', label: 'Kullanıcı' },
  staff: { variant: 'k-badge-info', label: 'Personel' },
  invitation: { variant: 'k-badge-info', label: 'Davet' },
  department: { variant: 'k-badge-info', label: 'Departman' },
  department_training_rule: { variant: 'k-badge-info', label: 'Departman Eğitim Kuralı' },

  // Sertifika / geri bildirim
  certificate: { variant: 'k-badge-success', label: 'Sertifika' },
  training_feedback_form: { variant: 'k-badge-info', label: 'Eğitim Geri Bildirim Formu' },
  training_feedback_response: { variant: 'k-badge-info', label: 'Eğitim Geri Bildirimi' },

  // SMG (Sürekli Mesleki Gelişim)
  SmgPeriod: { variant: 'k-badge-info', label: 'SMG Dönemi' },
  SmgTarget: { variant: 'k-badge-info', label: 'SMG Hedefi' },
  SmgActivity: { variant: 'k-badge-info', label: 'SMG Etkinliği' },
  SmgCategory: { variant: 'k-badge-info', label: 'SMG Kategorisi' },

  // Akreditasyon
  accreditation_report: { variant: 'k-badge-muted', label: 'Akreditasyon Raporu' },
  accreditation_standard: { variant: 'k-badge-info', label: 'Akreditasyon Standardı' },

  // Platform / abonelik
  organization: { variant: 'k-badge-info', label: 'Hastane' },
  subscription: { variant: 'k-badge-info', label: 'Abonelik' },
  subscription_plan: { variant: 'k-badge-muted', label: 'Abonelik Planı' },
  invoice: { variant: 'k-badge-warning', label: 'Fatura' },
  payment: { variant: 'k-badge-success', label: 'Ödeme' },

  // Sistem
  export: { variant: 'k-badge-info', label: 'Dışa Aktarım' },
  backup: { variant: 'k-badge-muted', label: 'Yedek' },
  DbBackup: { variant: 'k-badge-muted', label: 'Veritabanı Yedeği' },
  settings: { variant: 'k-badge-muted', label: 'Ayarlar' },
  notification: { variant: 'k-badge-info', label: 'Bildirim' },
  pdf: { variant: 'k-badge-muted', label: 'PDF' },
  event: { variant: 'k-badge-success', label: 'Etkinlik' },
};

/**
 * Bilinmeyen kodları `snake_case`/`dot.case` → "Boşluklu Başlık" formatına getirir.
 * Ham kodun (ör. `training_feedback_response`) doğrudan UI'a sızmasını engeller.
 */
function humanize(code: string): string {
  return code.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** action kodunu Türkçe etikete çevirir (eşleşme yoksa humanize). */
export function getActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? humanize(action);
}

/** entityType kodunu Türkçe etikete çevirir (eşleşme yoksa humanize). */
export function getEntityLabel(entityType: string): string {
  return AUDIT_ENTITY_BADGE[entityType]?.label ?? humanize(entityType);
}

/** entityType için badge varyantı + Türkçe etiket (eşleşme yoksa nötr + humanize). */
export function getEntityBadge(entityType: string): { variant: AuditBadgeVariant; label: string } {
  return AUDIT_ENTITY_BADGE[entityType] ?? { variant: 'k-badge-muted', label: humanize(entityType) };
}

/** action'ın anlamına göre semantik badge rengi (oluştur=yeşil, sil=kırmızı, vb.). */
export function getActionBadgeVariant(action: string): AuditBadgeVariant {
  const a = action.toLowerCase();
  if (/(delete|remove|revoke|reject|suspend|deactivate|fail|unassign)/.test(a)) return 'k-badge-error';
  if (/(create|assign|add|accept|approve|pass|publish|sign|upload|earn|complete)/.test(a)) return 'k-badge-success';
  if (/(update|reset|reopen|restore|change|reassign|unsuspend)/.test(a)) return 'k-badge-warning';
  if (/(export|download|read|view|login|logout|start|generate|send|preview)/.test(a)) return 'k-badge-info';
  return 'k-badge-muted';
}
