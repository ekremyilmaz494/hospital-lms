import { describe, it, expect } from 'vitest'
import { normalizeRecords } from '../normalize'

// Geçerli test TC'si (Mod10/Mod11 checksum tutar): 10000000146
const VALID_TC = '10000000146'
const INVALID_TC = '10000000147' // son hane bozuk → checksum tutmaz

describe('normalizeRecords', () => {
  it('mapping yokken kimliksel eşleme yapar (bilinen alanlar aynen geçer)', () => {
    const { records, rowErrors } = normalizeRecords([
      {
        externalId: 'P-001',
        firstName: 'Ayşe',
        lastName: 'Yılmaz',
        email: 'AYSE@Hastane.com',
        phone: '0555 111 22 33',
        title: 'Hemşire',
        departmentName: 'Acil Servis',
        bilinmeyenAlan: 'çöp', // zod strip etmeli
      },
    ])

    expect(rowErrors).toHaveLength(0)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      externalId: 'P-001',
      firstName: 'Ayşe',
      lastName: 'Yılmaz',
      email: 'ayse@hastane.com', // lowercase normalize
      title: 'Hemşire',
      departmentName: 'Acil Servis',
    })
    expect('bilinmeyenAlan' in records[0]).toBe(false)
  })

  it('fieldMapping HAM satıra uygulanır ve kimliksel eşlemenin üstüne yazar', () => {
    const { records, rowErrors } = normalizeRecords(
      [
        {
          SICIL_NO: 'H-42',
          AD: 'Mehmet',
          SOYAD: 'Demir',
          BIRIM: 'Kardiyoloji',
          // Kimliksel alan da mevcut — mapping kazanmalı
          firstName: 'YanlisAd',
        },
      ],
      { SICIL_NO: 'externalId', AD: 'firstName', SOYAD: 'lastName', BIRIM: 'departmentName' },
    )

    expect(rowErrors).toHaveLength(0)
    expect(records[0]).toMatchObject({
      externalId: 'H-42',
      firstName: 'Mehmet',
      lastName: 'Demir',
      departmentName: 'Kardiyoloji',
    })
  })

  it('mapping StaffRecord dışı hedef alanları yok sayar', () => {
    const { records, rowErrors } = normalizeRecords(
      [{ AD: 'Ali', SOYAD: 'Kaya', ROL: 'admin' }],
      { AD: 'firstName', SOYAD: 'lastName', ROL: 'role' }, // 'role' hedefi geçersiz
    )

    expect(rowErrors).toHaveLength(0)
    expect('role' in records[0]).toBe(false)
  })

  it('defaults yalnız boş alanlara dolar — feed değeri kazanır', () => {
    const { records } = normalizeRecords(
      [
        { firstName: 'Ali', lastName: 'Kaya', title: '' }, // title boş → default dolar
        { firstName: 'Veli', lastName: 'Can', title: 'Doktor' }, // feed değeri kazanır
      ],
      null,
      { title: 'Personel', departmentName: 'Genel' },
    )

    expect(records[0].title).toBe('Personel')
    expect(records[0].departmentName).toBe('Genel')
    expect(records[1].title).toBe('Doktor')
  })

  it('geçerli TC normalize edilir (boşluklar atılır), geçersiz TC satır hatası üretir', () => {
    const { records, rowErrors } = normalizeRecords([
      { firstName: 'Ali', lastName: 'Kaya', tcKimlik: '10000 00014 6' },
      { firstName: 'Veli', lastName: 'Can', tcKimlik: INVALID_TC },
    ])

    expect(records).toHaveLength(1)
    expect(records[0].tcKimlik).toBe(VALID_TC)
    expect(rowErrors).toHaveLength(1)
    expect(rowErrors[0].rowIndex).toBe(1)
    expect(rowErrors[0].message).toContain('Geçersiz TC Kimlik No')
  })

  it('hatalı satır koşuyu durdurmaz — diğer satırlar işlenir (tolerans)', () => {
    const { records, rowErrors } = normalizeRecords([
      { firstName: 'Ali', lastName: 'Kaya' },
      { lastName: 'Adsız' }, // firstName eksik → hata
      { firstName: 'Veli', lastName: 'Can' },
    ])

    expect(records).toHaveLength(2)
    expect(rowErrors).toHaveLength(1)
    expect(rowErrors[0].rowIndex).toBe(1)
    expect(rowErrors[0].message).toContain('Ad zorunludur')
  })

  it('geçersiz e-posta satır hatası üretir (Türkçe mesaj)', () => {
    const { records, rowErrors } = normalizeRecords([
      { firstName: 'Ali', lastName: 'Kaya', email: 'gecersiz-eposta' },
    ])

    expect(records).toHaveLength(0)
    expect(rowErrors[0].message).toContain('Geçersiz e-posta formatı')
  })

  it("HBYS tarzı string/sayı boolean'ları coerce eder", () => {
    const { records } = normalizeRecords([
      { firstName: 'A', lastName: 'B', active: 'Pasif' },
      { firstName: 'C', lastName: 'D', active: '1' },
      { firstName: 'E', lastName: 'F', active: false },
      { firstName: 'G', lastName: 'H', active: 'bilinmeyen-deger' },
    ])

    expect(records[0].active).toBe(false)
    expect(records[1].active).toBe(true)
    expect(records[2].active).toBe(false)
    expect(records[3].active).toBeUndefined()
  })

  it('sayısal değerleri string alanlara çevirir, boş string alanları düşürür', () => {
    const { records, rowErrors } = normalizeRecords([
      { externalId: 12345, firstName: 'Ali', lastName: 'Kaya', email: '', phone: '   ' },
    ])

    expect(rowErrors).toHaveLength(0)
    expect(records[0].externalId).toBe('12345')
    expect(records[0].email).toBeUndefined()
    expect(records[0].phone).toBeUndefined()
  })

  it('geçersiz işe giriş tarihi satır hatası üretir, geçerli tarih korunur', () => {
    const { records, rowErrors } = normalizeRecords([
      { firstName: 'Ali', lastName: 'Kaya', hireDate: '2024-03-15' },
      { firstName: 'Veli', lastName: 'Can', hireDate: 'dün' },
    ])

    expect(records).toHaveLength(1)
    expect(records[0].hireDate).toBe('2024-03-15')
    expect(rowErrors).toHaveLength(1)
    expect(rowErrors[0].message).toContain('Geçersiz işe giriş tarihi')
  })
})
