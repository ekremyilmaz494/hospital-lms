/**
 * Standart-spesifik profiller — terminoloji + aksan rengi + kapak rozeti.
 *
 * JCI "Measurable Element", ISO "Madde", SKS "Boyut" gibi farklı
 * terminoloji kullanır — denetçiye doğru dilde sunum kritik.
 */

import { COLORS } from './theme'

export interface StandardProfile {
  bodyLabel: string
  accentColor: [number, number, number]
  coverBadge: string
  terminology: {
    standardWord: string   // "Standart" | "Madde" | "Boyut"
    findingWord: string    // "Bulgu" | "Tespit"
    complianceWord: string // "Uyum" | "Uygunluk"
  }
}

export const STANDARD_PROFILES: Record<string, StandardProfile> = {
  JCI: {
    bodyLabel: 'Joint Commission International',
    accentColor: COLORS.primary,
    coverBadge: 'JCI 7. Edisyon',
    terminology: {
      standardWord: 'Standart',
      findingWord: 'Bulgu',
      complianceWord: 'Uyum',
    },
  },
  ISO_9001: {
    bodyLabel: 'ISO 9001 Kalite Yonetim Sistemi',
    accentColor: [37, 99, 235],
    coverBadge: 'ISO 9001:2015',
    terminology: {
      standardWord: 'Madde',
      findingWord: 'Tespit',
      complianceWord: 'Uygunluk',
    },
  },
  ISO_15189: {
    bodyLabel: 'ISO 15189 Tibbi Laboratuvar Standardi',
    accentColor: [124, 58, 237],
    coverBadge: 'ISO 15189:2022',
    terminology: {
      standardWord: 'Madde',
      findingWord: 'Tespit',
      complianceWord: 'Uygunluk',
    },
  },
  TJC: {
    bodyLabel: 'The Joint Commission',
    accentColor: COLORS.primaryDark,
    coverBadge: 'TJC Accreditation',
    terminology: {
      standardWord: 'Standart',
      findingWord: 'Bulgu',
      complianceWord: 'Uyum',
    },
  },
  OSHA: {
    bodyLabel: 'OSHA Is Sagligi ve Guvenligi',
    accentColor: [220, 38, 38],
    coverBadge: 'OSHA Compliance',
    terminology: {
      standardWord: 'Standart',
      findingWord: 'Bulgu',
      complianceWord: 'Uyum',
    },
  },
}

export function getProfile(standardBody: string): StandardProfile {
  return STANDARD_PROFILES[standardBody] ?? STANDARD_PROFILES['JCI']
}
