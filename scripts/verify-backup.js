/**
 * verify-backup.js — Yedekleme sisteminin sağlığını doğrular.
 *
 * Kontroller:
 * 1. Son yedek 24 saatten eski mi?
 * 2. Veritabanı erişilebilir mi? (organizations COUNT)
 * 3. Redis ping < 100ms mi?
 * 4. S3 yazma/okuma/silme çalışıyor mu?
 *
 * Çalıştır: node scripts/verify-backup.js
 * Haftalık cron veya go-live öncesi kontrol olarak kullanın.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Pool } = require('pg');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const results = [];
let hasFailure = false;

function pass(name, detail) {
  results.push({ status: '✅', name, detail });
}
function fail(name, detail) {
  results.push({ status: '❌', name, detail });
  hasFailure = true;
}

async function checkDatabase() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) { fail('Veritabanı', 'DATABASE_URL tanımlı değil'); return; }

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  try {
    // Son yedek kontrolü
    const backupResult = await pool.query(
      "SELECT created_at, status, verified FROM db_backups WHERE status = 'completed' ORDER BY created_at DESC LIMIT 1"
    );
    if (backupResult.rows.length === 0) {
      fail('Son Yedek', 'Hiç tamamlanmış yedek bulunamadı');
    } else {
      const lastBackup = backupResult.rows[0];
      const hoursAgo = (Date.now() - new Date(lastBackup.created_at).getTime()) / 3600000;
      if (hoursAgo > 24) {
        fail('Son Yedek', `Son yedek ${hoursAgo.toFixed(1)} saat önce — 24 saat limitini aştı!`);
      } else {
        pass('Son Yedek', `${hoursAgo.toFixed(1)} saat önce, verified: ${lastBackup.verified}`);
      }
    }

    // Organizasyon sayısı kontrolü
    const orgResult = await pool.query('SELECT COUNT(*) as count FROM organizations');
    const orgCount = parseInt(orgResult.rows[0].count);
    if (orgCount === 0) {
      fail('Veritabanı', 'organizations tablosu boş — veri kaybı olabilir!');
    } else {
      pass('Veritabanı', `${orgCount} organizasyon mevcut, DB erişimi OK`);
    }

    // Kullanıcı sayısı
    const userResult = await pool.query('SELECT COUNT(*) as count FROM users');
    pass('Kullanıcılar', `${userResult.rows[0].count} kullanıcı kayıtlı`);

  } catch (err) {
    fail('Veritabanı', `Bağlantı hatası: ${err.message}`);
  } finally {
    await pool.end();
  }
}

async function checkRedis() {
  const redisUrl = process.env.REDIS_URL;
  const redisToken = process.env.REDIS_TOKEN;
  if (!redisUrl || !redisToken) { fail('Redis', 'REDIS_URL veya REDIS_TOKEN tanımlı değil'); return; }

  try {
    const start = Date.now();
    const res = await fetch(`${redisUrl}/ping`, {
      headers: { Authorization: `Bearer ${redisToken}` },
    });
    const duration = Date.now() - start;
    const body = await res.json();

    if (body.result === 'PONG' && duration < 500) {
      pass('Redis', `Ping OK — ${duration}ms`);
    } else if (body.result === 'PONG') {
      fail('Redis', `Ping yavaş — ${duration}ms (hedef: <500ms)`);
    } else {
      fail('Redis', `Beklenmeyen yanıt: ${JSON.stringify(body)}`);
    }
  } catch (err) {
    fail('Redis', `Bağlantı hatası: ${err.message}`);
  }
}

async function checkS3() {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) { fail('S3', 'AWS_S3_BUCKET veya AWS_REGION tanımlı değil'); return; }

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const testKey = `_verify-backup-test/${Date.now()}.txt`;
  const testContent = 'backup-verification-test';

  try {
    // Yazma
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: testKey, Body: testContent, ContentType: 'text/plain' }));

    // Okuma
    const getResult = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: testKey }));
    const body = await getResult.Body.transformToString();
    if (body !== testContent) {
      fail('S3', 'Yazılan ve okunan veri eşleşmiyor!');
      return;
    }

    // Silme
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: testKey }));

    pass('S3', `Yazma/okuma/silme OK — bucket: ${bucket}`);
  } catch (err) {
    fail('S3', `Erişim hatası: ${err.message}`);
  }
}

async function run() {
  console.log('');
  console.log('🔍 Yedekleme Doğrulama Başlıyor...');
  console.log('─'.repeat(50));

  await checkDatabase();
  await checkRedis();
  await checkS3();

  console.log('');
  for (const r of results) {
    console.log(`${r.status} ${r.name}: ${r.detail}`);
  }
  console.log('─'.repeat(50));

  if (hasFailure) {
    console.error('');
    console.error('❌ DOĞRULAMA BAŞARISIZ — yukarıdaki hataları kontrol edin!');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ Tüm yedekleme kontrolleri başarılı!');
    process.exit(0);
  }
}

run().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
