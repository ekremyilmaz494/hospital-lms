/**
 * Test data helpers for E2E tests.
 * Provides consistent test data and unique identifiers to avoid collisions.
 */

/** Generate a unique suffix for test data (timestamp-based) */
export function uniqueId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

/** Test training data */
export function testTraining() {
  const id = uniqueId()
  return {
    title: `E2E Test Egitimi ${id}`,
    description: `Bu bir E2E test egitimi acilamasi icin olusturulmustur. ID: ${id}`,
    category: 'Enfeksiyon',
    passingScore: 70,
    maxAttempts: 3,
    examDuration: 30,
  }
}

/** Test staff data */
export function testStaff() {
  const id = uniqueId()
  return {
    firstName: 'Test',
    lastName: `Personel ${id}`,
    email: `test.personel.${id}@demo.com`,
    tcNo: `1000000${id.slice(0, 4)}`.padEnd(11, '0').slice(0, 11),
    department: 'Acil Servis',
    title: 'Hemşire',
  }
}

/** Test hospital settings */
export function testHospitalSettings() {
  return {
    name: 'E2E Test Hastanesi',
    email: 'test@hastane.com',
    phone: '0212 555 00 00',
    address: 'Test Mah. Test Cad. No:1 Istanbul',
  }
}
