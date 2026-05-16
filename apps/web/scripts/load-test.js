/**
 * Hospital LMS — Load Test (k6)
 *
 * Kurulum: brew install k6
 * Çalıştır: k6 run scripts/load-test.js
 * Hedef:    BASE_URL env ile ayarlanabilir (varsayılan: http://localhost:3000)
 *
 * 3 Senaryo:
 *   A) 50 VU  — Login → Dashboard → Logout (2 dk)
 *   B) 200 VU — Authenticated dashboard okuma (read-heavy, 5 dk)
 *   C) 20 VU  — Authenticated sınav/personel API smoke (3 dk)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Özel Metrikler ──
const errorRate = new Rate('errors');
const loginDuration = new Trend('login_duration');
const dashboardDuration = new Trend('dashboard_duration');
const examDuration = new Trend('exam_duration');

// ── Ayarlar ──
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const DEMO_EMAIL = __ENV.DEMO_EMAIL;
const DEMO_PASS = __ENV.DEMO_PASS;
const DEMO_USERS = parseDemoUsers(__ENV.DEMO_USERS_JSON);
if (DEMO_USERS.length === 0 && (!DEMO_EMAIL || !DEMO_PASS)) {
  throw new Error('DEMO_EMAIL/DEMO_PASS veya DEMO_USERS_JSON env değişkenleri gerekli');
}

let vuLoggedIn = false;

function parseDemoUsers(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((u) => u && typeof u.email === 'string' && typeof u.password === 'string')
      .map((u) => ({ email: u.email, password: u.password }));
  } catch {
    throw new Error('DEMO_USERS_JSON geçerli JSON array olmalı: [{"email":"...","password":"..."}]');
  }
}

function getCredentials() {
  if (DEMO_USERS.length > 0) {
    return DEMO_USERS[(__VU - 1) % DEMO_USERS.length];
  }
  return { email: DEMO_EMAIL, password: DEMO_PASS };
}

// ── Senaryolar ──
export const options = {
  scenarios: {
    // A) Login akışı — 50 eş zamanlı kullanıcı, 2 dakika
    login_flow: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'loginFlow',
      tags: { scenario: 'login' },
    },
    // B) Dashboard okuma — 200 eş zamanlı kullanıcı, 5 dakika
    dashboard_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // 30s'de 100'e çık
        { duration: '3m', target: 200 },   // 3dk boyunca 200'de tut
        { duration: '1m', target: 0 },     // 1dk'da kapat
      ],
      startTime: '2m', // Senaryo A bittikten sonra başla
      exec: 'dashboardRead',
      tags: { scenario: 'dashboard' },
    },
    // C) Sınav akışı — 20 eş zamanlı kullanıcı, 3 dakika
    exam_flow: {
      executor: 'constant-vus',
      vus: 20,
      duration: '3m',
      startTime: '7m', // Senaryo B bittikten sonra başla
      exec: 'examFlow',
      tags: { scenario: 'exam' },
    },
  },

  // ── Başarı Kriterleri ──
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // p95 < 2 saniye
    errors: ['rate<0.01'],               // Hata oranı < %1
    http_reqs: ['rate>100'],             // Throughput > 100 req/s
    login_duration: ['p(95)<3000'],      // Login p95 < 3s
    dashboard_duration: ['p(95)<2000'],  // Dashboard p95 < 2s
    exam_duration: ['p(95)<2000'],       // Exam p95 < 2s
  },
};

// ── Yardımcı: Login yapıp cookie döndür ──
function login(email, password) {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: email,
    password: password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  loginDuration.add(res.timings.duration);

  const success = check(res, {
    'login 200': (r) => r.status === 200,
    'login has user': (r) => {
      try { return JSON.parse(r.body).user !== undefined; } catch { return false; }
    },
  });

  errorRate.add(!success);
  return res;
}

function ensureLoggedIn() {
  if (vuLoggedIn) return true;
  const creds = getCredentials();
  const loginRes = login(creds.email, creds.password);
  vuLoggedIn = loginRes.status === 200;
  return vuLoggedIn;
}

// ══════════════════════════════════════════════════════════════
// SENARYO A: Login → Dashboard → Logout
// ══════════════════════════════════════════════════════════════
export function loginFlow() {
  group('Login Flow', () => {
    // 1. Login
    const creds = getCredentials();
    const loginRes = login(creds.email, creds.password);
    if (loginRes.status !== 200) { sleep(1); return; }

    sleep(0.5);

    // 2. Dashboard API
    const dashRes = http.get(`${BASE_URL}/api/admin/dashboard/combined`);
    dashboardDuration.add(dashRes.timings.duration);
    check(dashRes, { 'dashboard 200': (r) => r.status === 200 });

    sleep(1);

    // 3. Staff listesi
    const staffRes = http.get(`${BASE_URL}/api/admin/staff?page=1&limit=20`);
    check(staffRes, { 'staff 200': (r) => r.status === 200 });

    sleep(0.5);

    // 4. Eğitimler listesi
    const trainingsRes = http.get(`${BASE_URL}/api/admin/trainings?page=1&limit=20`);
    check(trainingsRes, { 'trainings 200': (r) => r.status === 200 });

    sleep(1);
  });
}

// ══════════════════════════════════════════════════════════════
// SENARYO B: Dashboard Read-Heavy
// ══════════════════════════════════════════════════════════════
export function dashboardRead() {
  group('Dashboard Read', () => {
    if (!ensureLoggedIn()) { sleep(1); return; }

    // Dashboard combined API
    const res = http.get(`${BASE_URL}/api/admin/dashboard/combined`);
    dashboardDuration.add(res.timings.duration);

    const success = check(res, {
      'dashboard 200': (r) => r.status === 200,
    });
    errorRate.add(!success);

    sleep(Math.random() * 2 + 1); // 1-3 saniye arası rastgele bekleme
  });
}

// ══════════════════════════════════════════════════════════════
// SENARYO C: Sınav Akışı
// ══════════════════════════════════════════════════════════════
export function examFlow() {
  group('Exam Flow', () => {
    if (!ensureLoggedIn()) { sleep(1); return; }

    sleep(0.5);

    // 2. Sınav listesi
    const examsRes = http.get(`${BASE_URL}/api/admin/standalone-exams?limit=10`);
    examDuration.add(examsRes.timings.duration);

    check(examsRes, { 'exams list 200': (r) => r.status === 200 });

    sleep(1);

    // 3. Eğitim atama listesi (personel dashboard simülasyonu)
    const myTrainings = http.get(`${BASE_URL}/api/staff/my-trainings`);
    check(myTrainings, { 'my-trainings ok': (r) => r.status === 200 || r.status === 307 });

    sleep(0.5);

    // 4. Bildirimler
    const notifRes = http.get(`${BASE_URL}/api/staff/notifications`);
    check(notifRes, { 'notifications ok': (r) => r.status === 200 || r.status === 307 });

    sleep(1);
  });
}

// ── Özet Rapor ──
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const errRate = data.metrics.errors?.values?.rate || 0;
  const reqs = data.metrics.http_reqs?.values?.rate || 0;

  const passed = p95 < 2000 && errRate < 0.01 && reqs > 100;

  return {
    stdout: `
╔══════════════════════════════════════════════╗
║         HOSPITAL LMS — LOAD TEST SONUCU      ║
╠══════════════════════════════════════════════╣
║  p95 Response Time:  ${p95.toFixed(0).padStart(6)}ms  (hedef: <2000ms) ${p95 < 2000 ? '✅' : '❌'}
║  Error Rate:         ${(errRate * 100).toFixed(2).padStart(6)}%   (hedef: <%1)    ${errRate < 0.01 ? '✅' : '❌'}
║  Throughput:         ${reqs.toFixed(1).padStart(6)} r/s (hedef: >100)   ${reqs > 100 ? '✅' : '❌'}
╠══════════════════════════════════════════════╣
║  SONUÇ: ${passed ? '✅ BAŞARILI — 200 kullanıcı destekleniyor' : '❌ BAŞARISIZ — optimizasyon gerekli'}
╚══════════════════════════════════════════════╝
`,
  };
}
