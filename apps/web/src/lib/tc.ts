/**
 * TC Kimlik No — saf doğrulama ve görüntüleme yardımcıları (client+server safe).
 *
 * Bu dosyada Node.js'e özgü modül yok — tarayıcıda da güvenle import edilebilir.
 * Şifreleme/HMAC fonksiyonları için `@/lib/tc-crypto` (server-only) kullanın.
 *
 * Resmi NVİ algoritması:
 *   - 11 hane, ilk hane ≠ 0
 *   - 10. hane: ((odd_sum * 7) - even_sum) mod 10
 *   - 11. hane: (ilk 10 hanenin toplamı) mod 10
 */

/**
 * TC numarasını normalize et — boşluk, tire ve harfleri at, sadece rakam bırak.
 * "12345 67890 1" gibi formatlı girişleri de tolere eder.
 */
export function normalizeTcKimlik(input: string | null | undefined): string {
  if (!input) return ''
  return input.replace(/\D/g, '')
}

/**
 * Resmi NVİ algoritmasıyla TC Kimlik No doğrulaması.
 * `12345678901` gibi haneli ama sahte numaraları reddeder.
 */
export function isValidTcKimlik(value: string | null | undefined): boolean {
  const tc = normalizeTcKimlik(value)
  if (tc.length !== 11) return false
  if (tc[0] === '0') return false

  const d = tc.split('').map(Number)
  if (d.some(n => Number.isNaN(n))) return false

  const oddSum = d[0] + d[2] + d[4] + d[6] + d[8]
  const evenSum = d[1] + d[3] + d[5] + d[7]
  const tenthExpected = ((oddSum * 7) - evenSum) % 10
  // mod sonucu negatif olabilir; pozitife çevir
  if (((tenthExpected + 10) % 10) !== d[9]) return false

  const firstTen = d.slice(0, 10).reduce((a, b) => a + b, 0)
  if ((firstTen % 10) !== d[10]) return false

  return true
}

/**
 * Görüntüleme için maskelenmiş TC: "12345*****1" formatı.
 * Listeleme/önizleme ekranlarında tam TC'yi göstermemek için.
 */
export function maskTcKimlik(tc: string | null | undefined): string {
  const normalized = normalizeTcKimlik(tc)
  if (normalized.length !== 11) return '***********'
  return `${normalized.slice(0, 5)}*****${normalized.slice(-1)}`
}

/**
 * Test/demo amaçlı geçerli TC Kimlik No üretir.
 * Gerçek kişiye ait olmaması için rastgele 9 hane üretip resmi kontrol hanelerini hesaplar.
 */
export function generateTestTc(): string {
  const digits = Array.from({ length: 9 }, (_, i) => {
    if (i === 0) return Math.floor(Math.random() * 9) + 1
    return Math.floor(Math.random() * 10)
  })

  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]
  const tenth = (((oddSum * 7) - evenSum) % 10 + 10) % 10
  const eleventh = ([...digits, tenth].reduce((sum, d) => sum + d, 0)) % 10

  return [...digits, tenth, eleventh].join('')
}

export function generateUniqueTcs(count: number): string[] {
  const values = new Set<string>()
  while (values.size < count) {
    values.add(generateTestTc())
  }
  return [...values]
}
