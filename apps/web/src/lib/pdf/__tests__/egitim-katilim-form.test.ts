import { describe, it, expect } from 'vitest'
import { buildEgitimKatilimFormPdf } from '../egitim-katilim-form'

const pdfMagic = (buf: Buffer) => buf.subarray(0, 5).toString()

// 1x1 saydam PNG (imza görseli yerine geçer — addImage patlamamalı)
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('buildEgitimKatilimFormPdf', () => {
  it('Türkçe + karışık imza durumlu katılımcılarla geçerli PDF üretir', async () => {
    const pdf = await buildEgitimKatilimFormPdf({
      trainingTitle: 'El Hijyeni ve Enfeksiyon Kontrolü',
      category: 'Enfeksiyon',
      startDate: new Date('2026-05-12'),
      endDate: new Date('2026-05-14'),
      organizationName: 'Özel Devakent Hastanesi',
      logoDataUrl: TINY_PNG, // logo-gömme yolunu (drawAuditFormHeader + addImage) kilitler
      docRef: 'A1B2C3D4',
      participants: [
        { fullName: 'Ayşe Yılmaz', roleDept: 'Hemşire / Yoğun Bakım', status: 'passed', completedAt: new Date('2026-05-14'), score: 92, signedAt: new Date('2026-05-14'), signatureMethod: 'canvas' },
        { fullName: 'Mehmet Şahin', roleDept: 'Doktor / Acil', status: 'passed', completedAt: new Date('2026-05-13'), score: 74, signedAt: new Date('2026-05-13'), signatureMethod: 'acknowledge' },
        { fullName: 'Zeynep Öztürk', roleDept: 'Teknisyen / Laboratuvar', status: 'in_progress', completedAt: null, score: null, signedAt: null, signatureMethod: null },
      ],
      signatures: [
        { fullName: 'Ayşe Yılmaz', roleDept: 'Hemşire / Yoğun Bakım', signedAt: new Date('2026-05-14'), data: TINY_PNG },
      ],
    })
    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdfMagic(pdf)).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(1000)
  })

  it('katılımcısı olmayan (boş liste) ve imzasız eğitimde patlamaz', async () => {
    const pdf = await buildEgitimKatilimFormPdf({
      trainingTitle: 'Boş Eğitim',
      category: null,
      startDate: null,
      endDate: null,
      organizationName: 'Test Hastanesi',
      logoDataUrl: null,
      docRef: 'ZZZ',
      participants: [],
      signatures: [],
    })
    expect(pdfMagic(pdf)).toBe('%PDF-')
  })
})
