import { describe, it, expect } from 'vitest'
import { buildEgitimSicilFormPdf } from '../egitim-sicil-form'

const pdfMagic = (buf: Buffer) => buf.subarray(0, 5).toString()

describe('buildEgitimSicilFormPdf', () => {
  it('Türkçe + karışık durumlu eğitimlerle geçerli PDF üretir', async () => {
    const pdf = await buildEgitimSicilFormPdf({
      staffName: 'Ayşe Yılmaz',
      staffTitle: 'Hemşire',
      department: 'Yoğun Bakım',
      organizationName: 'Özel Devakent Hastanesi',
      logoDataUrl: null,
      docRef: 'E5F6A7B8',
      entries: [
        { trainingTitle: 'El Hijyeni ve Enfeksiyon Kontrolü', category: 'Enfeksiyon', assignedAt: new Date('2026-05-12'), status: 'passed', score: 92, completedAt: new Date('2026-05-14'), certificateCode: 'KV-2026-0184' },
        { trainingTitle: 'Yangın Güvenliği', category: 'İş Güvenliği', assignedAt: new Date('2026-05-12'), status: 'in_progress', score: null, completedAt: null, certificateCode: null },
        { trainingTitle: 'Temel İlk Yardım', category: 'Acil', assignedAt: new Date('2026-04-02'), status: 'failed', score: 48, completedAt: new Date('2026-04-05'), certificateCode: null },
      ],
    })
    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdfMagic(pdf)).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(1000)
  })

  it('eğitimi olmayan personelde (boş liste) patlamaz', async () => {
    const pdf = await buildEgitimSicilFormPdf({
      staffName: 'Boş Personel',
      staffTitle: null,
      department: null,
      organizationName: 'Test Hastanesi',
      logoDataUrl: null,
      docRef: 'ZZZ',
      entries: [],
    })
    expect(pdfMagic(pdf)).toBe('%PDF-')
  })
})
