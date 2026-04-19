/**
 * restore-drill.js — Yedek dosyası restore edilebilirlik testi (DRY RUN).
 *
 * Prod veriye DOKUNMAZ. Seçilen yedeği S3'ten indirir, AES-256-GCM ile çözer,
 * JSON'u parse eder, yapısal geçerliliği ve kayıt sayılarını raporlar.
 *
 * "Backup alınıyor ama hiç restore denenmedi" riskini elimine etmek için
 * canlıya geçmeden en az bir kez, sonra aylık çalıştırılmalı.
 *
 * Kullanım:
 *   node scripts/restore-drill.js                     # en yeni verified=true yedek
 *   node scripts/restore-drill.js --backup-id=<uuid>  # belirli yedek
 *   node scripts/restore-drill.js --org-id=<uuid>     # belirli kurumun en yeni yedeği
 */
/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const { Pool } = require('pg');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');

// ── CLI args ──
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [k, v] = arg.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const REQUIRED_ARRAYS = [
  'users', 'departments', 'trainings', 'assignments',
  'attempts', 'examAnswers', 'videoProgress', 'notifications', 'certificates',
];

/** AES-256-GCM decrypt — lib/backup-crypto.ts ile birebir uyumlu format. */
function decryptBackup(data) {
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  const oldKey = process.env.BACKUP_ENCRYPTION_KEY_OLD;
  if (!key || key.length !== 64) return { text: data, usedOldKey: false, encrypted: false };

  const parts = data.split(':');
  if (parts.length !== 3 || parts[0].length !== 24 || parts[1].length !== 32) {
    return { text: data, usedOldKey: false, encrypted: false };
  }
  if (!/^[0-9a-f]+$/i.test(parts[0]) || !/^[0-9a-f]+$/i.test(parts[1]) || !/^[0-9a-f]+$/i.test(parts[2])) {
    return { text: data, usedOldKey: false, encrypted: false };
  }

  const tryKey = (hex) => {
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const ct = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(hex, 'hex'), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  };

  try {
    return { text: tryKey(key), usedOldKey: false, encrypted: true };
  } catch (err) {
    if (oldKey && oldKey.length === 64 && oldKey !== key) {
      try {
        return { text: tryKey(oldKey), usedOldKey: true, encrypted: true };
      } catch {
        throw err;
      }
    }
    throw err;
  }
}

async function pickBackup(pool) {
  if (args['backup-id']) {
    const r = await pool.query(
      "SELECT id, organization_id, file_url, file_size_mb, created_at FROM db_backups WHERE id = $1",
      [args['backup-id']]
    );
    if (r.rows.length === 0) throw new Error(`Backup bulunamadı: ${args['backup-id']}`);
    return r.rows[0];
  }

  if (args['org-id']) {
    const r = await pool.query(
      "SELECT id, organization_id, file_url, file_size_mb, created_at FROM db_backups WHERE organization_id = $1 AND status = 'completed' AND verified = true ORDER BY created_at DESC LIMIT 1",
      [args['org-id']]
    );
    if (r.rows.length === 0) throw new Error(`Kurum için verified yedek yok: ${args['org-id']}`);
    return r.rows[0];
  }

  const r = await pool.query(
    "SELECT id, organization_id, file_url, file_size_mb, created_at FROM db_backups WHERE status = 'completed' AND verified = true AND file_url != 'local' ORDER BY created_at DESC LIMIT 1"
  );
  if (r.rows.length === 0) throw new Error('Hiç verified=true yedek yok.');
  return r.rows[0];
}

async function run() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL tanımlı değil');

  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  if (!bucket || !region) throw new Error('AWS_S3_BUCKET veya AWS_REGION tanımlı değil');

  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10000 });
  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  console.log('\n🩺 Restore Drill (DRY RUN) başlıyor...');
  console.log('─'.repeat(60));

  let backup;
  try {
    backup = await pickBackup(pool);
  } finally {
    await pool.end();
  }

  console.log(`📦 Backup: ${backup.id}`);
  console.log(`   Org: ${backup.organization_id}`);
  console.log(`   Key: ${backup.file_url}`);
  console.log(`   Size: ${backup.file_size_mb ?? '?'} MB`);
  console.log(`   Created: ${backup.created_at.toISOString()}`);

  // ── S3 download ──
  const t0 = Date.now();
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: backup.file_url }));
  const chunks = [];
  for await (const chunk of obj.Body) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf-8');
  const downloadMs = Date.now() - t0;
  console.log(`⬇️  S3 download: ${downloadMs}ms, ${(raw.length / 1024 / 1024).toFixed(2)} MB`);

  // ── Decrypt ──
  const t1 = Date.now();
  const { text: jsonString, usedOldKey, encrypted } = decryptBackup(raw);
  const decryptMs = Date.now() - t1;
  console.log(`🔓 Decrypt: ${decryptMs}ms (encrypted=${encrypted}, oldKey=${usedOldKey})`);
  if (usedOldKey) {
    console.warn('⚠️  Yedek BACKUP_ENCRYPTION_KEY_OLD ile çözüldü — re-encrypt gerekli.');
  }

  // ── Parse + structural validation ──
  const t2 = Date.now();
  const parsed = JSON.parse(jsonString);
  const parseMs = Date.now() - t2;
  console.log(`📄 JSON parse: ${parseMs}ms`);

  const issues = [];
  for (const k of REQUIRED_ARRAYS) {
    if (!Array.isArray(parsed[k])) issues.push(`Zorunlu array eksik: ${k}`);
  }
  if (typeof parsed.organizationId !== 'string') issues.push('organizationId string değil');
  if (parsed.organizationId !== backup.organization_id) issues.push('organizationId uyuşmuyor');
  if (typeof parsed.exportedAt !== 'string') issues.push('exportedAt string değil');

  // ── Counts ──
  const counts = {};
  for (const k of REQUIRED_ARRAYS) counts[k] = Array.isArray(parsed[k]) ? parsed[k].length : 'N/A';
  counts.auditLogs = Array.isArray(parsed.auditLogs) ? parsed.auditLogs.length : 0;
  counts.hasOrganization = parsed.organization ? 1 : 0;
  counts.hasSubscription = parsed.subscription ? 1 : 0;
  counts.schemaVersion = parsed.schemaVersion ?? 1;

  // Sanity: nested trainings
  let trainingVideos = 0;
  let trainingQuestions = 0;
  for (const t of (parsed.trainings ?? [])) {
    trainingVideos += (t.videos ?? []).length;
    trainingQuestions += (t.questions ?? []).length;
  }
  counts.nestedVideos = trainingVideos;
  counts.nestedQuestions = trainingQuestions;

  console.log('\n📊 Kayıt sayıları:');
  for (const [k, v] of Object.entries(counts)) {
    console.log(`   ${k.padEnd(20)} ${v}`);
  }

  console.log('\n─'.repeat(60));
  if (issues.length > 0) {
    console.error('❌ DRILL BAŞARISIZ:');
    for (const i of issues) console.error(`   • ${i}`);
    process.exit(1);
  }

  const totalMs = Date.now() - t0;
  console.log(`✅ DRILL BAŞARILI — toplam ${totalMs}ms`);
  console.log('   Yedek restore edilebilir durumda. DB yazılmadı (dry run).');
  process.exit(0);
}

run().catch(err => {
  console.error('\nFATAL:', err.message);
  if (err.stack) console.error(err.stack.split('\n').slice(0, 5).join('\n'));
  process.exit(1);
});
