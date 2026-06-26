import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { certificateVerifyUrl } from '@/lib/certificate-url'
import { logger } from '@/lib/logger'
import { drawCertificatePage, type CertDrawData } from '@/lib/pdf/cert-design'
import { applyTurkishFont } from '@/lib/pdf/helpers/font'
import { resolveOrgLogoDataUrl } from '@/lib/pdf/cert-logo'

/**
 * Sertifika PDF'i için gereken alanlar — Prisma şeklinden bağımsız sade kontrat.
 * Hem authed (`/api/certificates/[id]/pdf`) hem public (`/api/certificates/verify/[code]/pdf`)
 * route'ları bu tek üreticiyi çağırır; QR + logo + font + layout tek yerde toplanır.
 */
export interface CertificatePdfData {
  firstName: string
  lastName: string
  trainingTitle: string
  organizationName: string | null
  organizationLogoUrl: string | null
  issuedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  certificateCode: string
  score: number | null
}

function formatDateTR(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Doğrulama QR'ı (PNG data URL) üretir. Başarısız olursa null döner ve loglar —
 * QR üretimi PDF üretimini (gerçek müşteri akışı) ASLA bozmamalı.
 */
async function buildVerifyQrDataUrl(verifyUrl: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(verifyUrl, { width: 256, margin: 1, errorCorrectionLevel: 'M' })
  } catch (err) {
    logger.error('Certificate PDF', 'QR kod üretilemedi', err)
    return null
  }
}

/**
 * Tek sertifika için A4 yatay PDF üretir (QR doğrulama rozeti dahil) ve byte'larını döner.
 * Çağıran route auth/scope kontrolünü kendisi yapar; bu fonksiyon yalnız render eder.
 * Dönüş `Uint8Array` — `new Response(...)` ve `.length` ile doğrudan uyumlu.
 */
export async function buildCertificatePdfBuffer(d: CertificatePdfData): Promise<Uint8Array<ArrayBuffer>> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  await applyTurkishFont(doc)

  const logoDataUrl = await resolveOrgLogoDataUrl(d.organizationLogoUrl)
  const verifyUrl = certificateVerifyUrl(d.certificateCode)
  const qrCodeDataUrl = await buildVerifyQrDataUrl(verifyUrl)

  const data: CertDrawData = {
    fullName: `${d.firstName} ${d.lastName}`,
    trainingTitle: d.trainingTitle,
    organizationName: d.organizationName ?? '',
    organizationLogoDataUrl: logoDataUrl,
    issuedAtText: formatDateTR(d.issuedAt),
    expiresAtText: d.expiresAt ? formatDateTR(d.expiresAt) : null,
    isExpired: !!d.expiresAt && d.expiresAt < new Date(),
    isRevoked: !!d.revokedAt,
    certificateCode: d.certificateCode,
    score: d.score,
    qrCodeDataUrl,
    verifyUrlText: verifyUrl.replace(/^https?:\/\//, ''),
  }

  drawCertificatePage(doc, data)
  return new Uint8Array(doc.output('arraybuffer'))
}
