import { describe, it, expect, vi } from 'vitest'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

// Gerçek Türkçe font yüklemesini atla — built-in 'helvetica' yeterli, test hızlı kalır.
vi.mock('../helpers/font', () => ({
  TURKISH_FONT_FAMILY: 'helvetica',
  applyTurkishFont: vi.fn(),
}))

import { drawCertificatePage, type CertDrawData } from '../cert-design'

const base: CertDrawData = {
  fullName: 'Personel Bir',
  trainingTitle: 'İSG Temel Eğitimi',
  organizationName: 'Devakent',
  organizationLogoDataUrl: null, // logo yok → addImage SADECE QR için çağrılır
  issuedAtText: '01 Ocak 2026',
  expiresAtText: null,
  isExpired: false,
  isRevoked: false,
  certificateCode: 'CERT-ABC123',
  score: 90,
}

function newDoc(): jsPDF {
  return new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
}

describe('drawCertificatePage — doğrulama QR rozeti', () => {
  it('qrCodeDataUrl verilince QR PNG olarak addImage ile çizilir', async () => {
    const qr = await QRCode.toDataURL('https://klinovax.com/certificates/verify/CERT-ABC123')
    const doc = newDoc()
    const spy = vi.spyOn(doc, 'addImage')

    drawCertificatePage(doc, {
      ...base,
      qrCodeDataUrl: qr,
      verifyUrlText: 'klinovax.com/certificates/verify/CERT-ABC123',
    })

    expect(spy).toHaveBeenCalledTimes(1)
    // jsPDF.addImage overload'lı → tuple index'i için cast gerekir.
    const args = spy.mock.calls[0] as unknown as unknown[]
    expect(args[0]).toBe(qr)
    expect(args[1]).toBe('PNG')
  })

  it('qrCodeDataUrl yokken QR çizilmez ve hata fırlatmaz (geriye dönük uyum)', () => {
    const doc = newDoc()
    const spy = vi.spyOn(doc, 'addImage')

    expect(() => drawCertificatePage(doc, base)).not.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('iptal edilmiş sertifikada da QR çizilir (durum doğrulama sayfasında görünür)', async () => {
    const qr = await QRCode.toDataURL('x')
    const doc = newDoc()
    const spy = vi.spyOn(doc, 'addImage')

    drawCertificatePage(doc, { ...base, isRevoked: true, qrCodeDataUrl: qr })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('bozuk qrCodeDataUrl sertifikayı bozmaz (try/catch yutar)', () => {
    const doc = newDoc()
    expect(() =>
      drawCertificatePage(doc, { ...base, qrCodeDataUrl: 'data:image/png;base64,GECERSIZ' }),
    ).not.toThrow()
  })
})
