import { describe, it, expect } from 'vitest'
import { buildTranscriptPdf } from '../staff-transcript'

const pdfMagic = (buf: Buffer) => buf.subarray(0, 5).toString()

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('buildTranscriptPdf', () => {
  it('logolu + Türkçe kayıtlarla geçerli PDF üretir', async () => {
    const pdf = await buildTranscriptPdf({
      fullName: 'Ayşe Yılmaz',
      organizationName: 'Özel Devakent Hastanesi',
      generatedAt: '01 Temmuz 2026',
      logoDataUrl: TINY_PNG,
      entries: [
        { trainingTitle: 'El Hijyeni ve Enfeksiyon Kontrolü', category: 'Enfeksiyon', issuedAt: '14 May 2026', score: 92, certificateCode: 'KV-2026-0184' },
        { trainingTitle: 'Yangın Güvenliği', category: 'İş Güvenliği', issuedAt: '20 May 2026', score: 88, certificateCode: 'KV-2026-0185' },
      ],
    })
    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdfMagic(pdf)).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(1000)
  })

  it('logosuz (null) ve boş kayıtla patlamaz', async () => {
    const pdf = await buildTranscriptPdf({
      fullName: 'Boş Personel',
      organizationName: 'Test Hastanesi',
      generatedAt: '01 Temmuz 2026',
      logoDataUrl: null,
      entries: [],
    })
    expect(pdfMagic(pdf)).toBe('%PDF-')
  })
})
