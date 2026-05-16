/**
 * Hospital LMS — Production Load Test (k6)
 *
 * Çalıştır: k6 run scripts/load-test-prod.js
 * Auth token otomatik kullanılır — cookie yerine Bearer header ile.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const dashboardDuration = new Trend('dashboard_duration');
const apiDuration = new Trend('api_duration');

const BASE_URL = __ENV.BASE_URL || 'https://hospital-lms-eta.vercel.app';
const TOKEN = __ENV.TOKEN || '';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${TOKEN}`,
};

export const options = {
  scenarios: {
    // A) 50 VU — API okuma karışık (2dk)
    api_read_mix: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'apiReadMix',
      tags: { scenario: 'api_read' },
    },
    // B) 200 VU — Dashboard yoğun okuma (3dk)
    dashboard_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '2m', target: 200 },
        { duration: '30s', target: 0 },
      ],
      startTime: '2m',
      exec: 'dashboardHeavy',
      tags: { scenario: 'dashboard' },
    },
    // C) 20 VU — Personel paneli (2dk)
    staff_panel: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      startTime: '5m',
      exec: 'staffPanel',
      tags: { scenario: 'staff' },
    },
  },

  thresholds: {
    http_req_duration: ['p(95)<3000'],
    errors: ['rate<0.05'],
    http_reqs: ['rate>50'],
    dashboard_duration: ['p(95)<3000'],
  },
};

// ── A) API Okuma Karışık ──
export function apiReadMix() {
  group('API Read Mix', () => {
    // Dashboard
    const dash = http.get(`${BASE_URL}/api/admin/dashboard/combined`, { headers });
    dashboardDuration.add(dash.timings.duration);
    const ok1 = check(dash, { 'dashboard ok': (r) => r.status === 200 });
    errorRate.add(!ok1);
    sleep(0.5);

    // Staff list
    const staff = http.get(`${BASE_URL}/api/admin/staff?page=1&limit=20`, { headers });
    apiDuration.add(staff.timings.duration);
    check(staff, { 'staff ok': (r) => r.status === 200 });
    sleep(0.5);

    // Trainings
    const train = http.get(`${BASE_URL}/api/admin/trainings?page=1&limit=20`, { headers });
    apiDuration.add(train.timings.duration);
    check(train, { 'trainings ok': (r) => r.status === 200 });
    sleep(0.5);

    // Certificates
    const certs = http.get(`${BASE_URL}/api/admin/certificates`, { headers });
    apiDuration.add(certs.timings.duration);
    check(certs, { 'certificates ok': (r) => r.status === 200 });
    sleep(1);
  });
}

// ── B) Dashboard Yoğun ──
export function dashboardHeavy() {
  const res = http.get(`${BASE_URL}/api/admin/dashboard/combined`, { headers });
  dashboardDuration.add(res.timings.duration);
  const ok = check(res, { 'dashboard ok': (r) => r.status === 200 });
  errorRate.add(!ok);
  sleep(Math.random() * 2 + 0.5);
}

// ── C) Personel Paneli ──
export function staffPanel() {
  group('Staff Panel', () => {
    const dash = http.get(`${BASE_URL}/api/staff/dashboard`, { headers });
    apiDuration.add(dash.timings.duration);
    check(dash, { 'staff dashboard ok': (r) => r.status === 200 });
    sleep(0.5);

    const trains = http.get(`${BASE_URL}/api/staff/my-trainings`, { headers });
    apiDuration.add(trains.timings.duration);
    check(trains, { 'my-trainings ok': (r) => r.status === 200 });
    sleep(0.5);

    const notif = http.get(`${BASE_URL}/api/staff/notifications`, { headers });
    apiDuration.add(notif.timings.duration);
    check(notif, { 'notifications ok': (r) => r.status === 200 });
    sleep(1);
  });
}

// ── Özet ──
export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values?.['p(95)'] || 0;
  const errRate = data.metrics.errors?.values?.rate || 0;
  const reqs = data.metrics.http_reqs?.values?.rate || 0;
  const totalReqs = data.metrics.http_reqs?.values?.count || 0;
  const dashP95 = data.metrics.dashboard_duration?.values?.['p(95)'] || 0;

  const passed = p95 < 3000 && errRate < 0.05 && reqs > 50;

  return {
    stdout: `
╔══════════════════════════════════════════════════════╗
║     HOSPITAL LMS — CANLI PRODUCTION LOAD TEST        ║
╠══════════════════════════════════════════════════════╣
║  Toplam İstek:       ${String(totalReqs).padStart(8)}                       ║
║  p95 Response Time:  ${p95.toFixed(0).padStart(6)}ms  (hedef: <3000ms) ${p95 < 3000 ? '✅' : '❌'}  ║
║  Dashboard p95:      ${dashP95.toFixed(0).padStart(6)}ms                      ║
║  Error Rate:         ${(errRate * 100).toFixed(2).padStart(6)}%   (hedef: <%5)    ${errRate < 0.05 ? '✅' : '❌'}  ║
║  Throughput:         ${reqs.toFixed(1).padStart(6)} r/s (hedef: >50)    ${reqs > 50 ? '✅' : '❌'}  ║
╠══════════════════════════════════════════════════════╣
║  SONUÇ: ${passed ? '✅ BAŞARILI — sistem yükü kaldırıyor' : '❌ BAŞARISIZ — optimizasyon gerekli    '}    ║
╚══════════════════════════════════════════════════════╝
`,
  };
}
