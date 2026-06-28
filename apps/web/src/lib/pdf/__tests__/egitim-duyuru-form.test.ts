import { describe, it, expect } from 'vitest'
import { buildEgitimDuyuruFormPdf } from '../egitim-duyuru-form'

const pdfMagic = (buf: Buffer) => buf.subarray(0, 5).toString()

describe('buildEgitimDuyuruFormPdf', () => {
  it('Türkçe + dolu personel listesiyle geçerli PDF üretir', async () => {
    const pdf = await buildEgitimDuyuruFormPdf({
      trainingTitle: 'El Hijyeni ve Enfeksiyon Kontrolü Eğitimi',
      category: 'Enfeksiyon Kontrolü',
      startDate: new Date('2026-05-12'),
      endDate: new Date('2026-05-26'),
      isCompulsory: true,
      organizationName: 'Özel Devakent Hastanesi',
      logoDataUrl: null,
      docRef: 'A1B2C3D4',
      announcementMessage: '"El Hijyeni" adlı eğitim sizlere atandı. Şğüöçİ.',
      firstAnnouncedAt: new Date('2026-05-12T09:30:00Z'),
      notifiedCount: 2,
      staff: [
        { fullName: 'Ayşe Yılmaz', department: 'Acil Servis', title: 'Hemşire', assignedAt: new Date('2026-05-12'), notified: true, status: 'passed' },
        { fullName: 'Ali Çelik', department: 'Cerrahi', title: 'Doktor', assignedAt: new Date('2026-05-12'), notified: false, status: 'assigned' },
      ],
    })
    expect(pdf).toBeInstanceOf(Buffer)
    expect(pdfMagic(pdf)).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(1000)
  })

  it('boş liste ve null alanlarla patlamaz', async () => {
    const pdf = await buildEgitimDuyuruFormPdf({
      trainingTitle: 'Test Eğitimi',
      category: null,
      startDate: null,
      endDate: null,
      isCompulsory: false,
      organizationName: 'Test Hastanesi',
      logoDataUrl: null,
      docRef: 'ZZZ',
      announcementMessage: null,
      firstAnnouncedAt: null,
      notifiedCount: 0,
      staff: [],
    })
    expect(pdfMagic(pdf)).toBe('%PDF-')
  })
})
