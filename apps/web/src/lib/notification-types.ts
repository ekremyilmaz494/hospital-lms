/**
 * Bildirim tipi → görsel meta (label, ikon, ink rengi) merkezi haritası.
 * Bell, staff bildirim sayfası, admin bildirim sayfası ve EdNotificationList
 * bu tek kaynaktan beslenir; aksi halde aynı tipin iki yerde farklı görünmesi
 * gibi marka tutarsızlıkları kolayca üretilebilir.
 *
 * Yeni tip eklemek için: enum'da olmaması nedeniyle (Notification.type free-string)
 * burada bir map girişi ekle. Bilinmeyen tipler `info` fallback'i alır.
 */

import {
  AlertTriangle,
  Award,
  BookOpen,
  CheckCircle,
  Clock3,
  Info,
  type LucideIcon,
  Megaphone,
  MessageSquare,
  PlayCircle,
  Sparkles,
  Zap,
  XCircle,
} from 'lucide-react'

export interface NotificationTypeMeta {
  /** Kicker label — uppercase, kısa (max ~12 karakter). */
  label: string
  /** Lucide ikon component'i. */
  icon: LucideIcon
  /** Border / dot / kicker rengi (Editorial palet ile uyumlu hex). */
  ink: string
}

const TYPE_META: Record<string, NotificationTypeMeta> = {
  // Manuel admin tipleri
  info:    { label: 'BİLGİ',  icon: Info,          ink: '#2c55b8' },
  warning: { label: 'UYARI',  icon: AlertTriangle, ink: '#b4820b' },
  error:   { label: 'ACİL',   icon: Zap,           ink: '#b3261e' },
  success: { label: 'BAŞARI', icon: CheckCircle,   ink: '#0a7a47' },

  announcement:        { label: 'DUYURU',     icon: Megaphone,     ink: '#0b1e3f' },
  reminder:            { label: 'HATIRLATMA', icon: Clock3,        ink: '#b4820b' },
  assignment:          { label: 'EĞİTİM',     icon: BookOpen,      ink: '#1a3a28' },
  competency_evaluation: { label: 'YETKİNLİK', icon: MessageSquare, ink: '#2c55b8' },
  subscription_expiry: { label: 'ABONELİK',   icon: Sparkles,      ink: '#8a5a11' },

  // Sistem tarafından otomatik üretilen tipler (Mayıs 2026 öncesinde
  // staff API'sinde gizleniyordu; artık görünür ve doğru label alırlar).
  training_assigned: { label: 'EĞİTİM',      icon: BookOpen,    ink: '#1a3a28' },
  exam_started:      { label: 'SINAV',       icon: PlayCircle,  ink: '#2c55b8' },
  exam_passed:       { label: 'SINAV GEÇTİ', icon: Award,       ink: '#0a7a47' },
  exam_failed:       { label: 'SINAV KALDI', icon: XCircle,     ink: '#b3261e' },
}

export function getNotificationTypeMeta(type: string): NotificationTypeMeta {
  return TYPE_META[type] ?? TYPE_META.info
}

/** Filtre dropdown'larında listelenecek tipler (UI sıralamasıyla). */
export const FILTER_TYPES: readonly string[] = [
  'training_assigned',
  'exam_passed',
  'exam_failed',
  'assignment',
  'reminder',
  'announcement',
  'competency_evaluation',
  'warning',
  'info',
  'success',
  'error',
] as const
