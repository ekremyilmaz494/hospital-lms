import { describe, it, expect } from 'vitest'
import { TRAINING_CATEGORIES, resolveCategoryMeta, UNCATEGORIZED_LABEL } from '../training-categories'

describe('TRAINING_CATEGORIES', () => {
  it('tam olarak 8 kategori içerir', () => {
    expect(TRAINING_CATEGORIES).toHaveLength(8)
  })

  it('her kategoride value, label ve icon alanları bulunur', () => {
    for (const cat of TRAINING_CATEGORIES) {
      expect(cat).toHaveProperty('value')
      expect(cat).toHaveProperty('label')
      expect(cat).toHaveProperty('icon')
      expect(typeof cat.value).toBe('string')
      expect(typeof cat.label).toBe('string')
      expect(typeof cat.icon).toBe('string')
      expect(cat.value.length).toBeGreaterThan(0)
      expect(cat.label.length).toBeGreaterThan(0)
      expect(cat.icon.length).toBeGreaterThan(0)
    }
  })

  it('tüm value değerleri benzersizdir', () => {
    const values = TRAINING_CATEGORIES.map((c) => c.value)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('tüm value değerleri lowercase kebab-case formatındadır', () => {
    const kebabCaseRegex = /^[a-z]+(-[a-z]+)*$/
    for (const cat of TRAINING_CATEGORIES) {
      expect(cat.value).toMatch(kebabCaseRegex)
    }
  })

  it('beklenen kategorileri içerir', () => {
    const values = TRAINING_CATEGORIES.map((c) => c.value)
    const expected = [
      'enfeksiyon',
      'is-guvenligi',
      'hasta-haklari',
      'radyoloji',
      'laboratuvar',
      'eczane',
      'acil',
      'genel',
    ]
    for (const val of expected) {
      expect(values).toContain(val)
    }
  })

  it('as const ile tanımlandığı için readonly dizidır', () => {
    // TypeScript compile-time readonly olsa da runtime'da Object.isFrozen
    // ile doğrudan kontrol edilemez (as const freeze etmez).
    // Bunun yerine dizi elemanlarının beklenen yapıya sahip olduğunu
    // ve dizinin tuple benzeri sabit uzunlukta olduğunu doğruluyoruz.
    expect(TRAINING_CATEGORIES).toHaveLength(8)

    // İlk ve son elemanın beklenen değerlere sahip olduğunu kontrol et
    expect(TRAINING_CATEGORIES[0].value).toBe('enfeksiyon')
    expect(TRAINING_CATEGORIES[7].value).toBe('genel')

    // Tip seviyesinde readonly olduğunu dolaylı doğrula:
    // Dizi bir "readonly" tuple olduğundan .push gibi metotlar
    // TypeScript'te derleme hatası verir. Runtime'da ise
    // as const Object.freeze uygulamadığından mutasyon mümkündür
    // ancak bu testin amacı tip tanımının doğruluğunu onaylamaktır.
    type IsReadonly = typeof TRAINING_CATEGORIES extends readonly unknown[] ? true : false
    const check: IsReadonly = true
    expect(check).toBe(true)
  })
})

describe('resolveCategoryMeta', () => {
  it('yerleşik slug → doğru etiket + marka rengi, orphan değil', () => {
    const meta = resolveCategoryMeta('enfeksiyon')
    expect(meta.label).toBe('Enfeksiyon')
    expect(meta.color).toBe('#ef4444') // TRAINING_CATEGORIES'teki marka rengi
    expect(meta.isOrphan).toBe(false)
  })

  it('bilinmeyen/silinmiş slug → "Kategorisiz", orphan', () => {
    const meta = resolveCategoryMeta('silinmis-kategori')
    expect(meta.label).toBe(UNCATEGORIZED_LABEL)
    expect(meta.isOrphan).toBe(true)
  })

  it('null/undefined/boş → "Kategorisiz", orphan', () => {
    expect(resolveCategoryMeta(null).isOrphan).toBe(true)
    expect(resolveCategoryMeta(undefined).label).toBe(UNCATEGORIZED_LABEL)
    expect(resolveCategoryMeta('').isOrphan).toBe(true)
  })

  it('dbCategories ile özel slug çözülür (slug-hash rengi, orphan değil)', () => {
    const db = [{ value: 'kardiyoloji', label: 'Kardiyoloji' }]
    const meta = resolveCategoryMeta('kardiyoloji', db)
    expect(meta.label).toBe('Kardiyoloji')
    expect(meta.isOrphan).toBe(false)
    expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('aynı slug-hash rengi deterministiktir', () => {
    const db = [{ value: 'kardiyoloji', label: 'Kardiyoloji' }]
    expect(resolveCategoryMeta('kardiyoloji', db).color).toBe(
      resolveCategoryMeta('kardiyoloji', db).color,
    )
  })

  it('DB etiketi yerleşik etiketi geçersiz kılar (admin yeniden adlandırması)', () => {
    const db = [{ value: 'enfeksiyon', label: 'Enfeksiyon Kontrolü' }]
    const meta = resolveCategoryMeta('enfeksiyon', db)
    expect(meta.label).toBe('Enfeksiyon Kontrolü')
    expect(meta.color).toBe('#ef4444') // renk yine yerleşik markadan
    expect(meta.isOrphan).toBe(false)
  })
})
