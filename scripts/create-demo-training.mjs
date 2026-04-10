/**
 * Demo eğitim oluşturma scripti
 * - denemevideo.mp4'ü S3'e yükler
 * - SQL ile training + video + soru + atama oluşturur
 */
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import pg from "pg";
import { readFileSync } from "fs";
import { randomUUID } from "crypto";
import { config } from "dotenv";

config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;
const BUCKET = process.env.AWS_S3_BUCKET;
const REGION = process.env.AWS_REGION;
const CF_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN;

const ORG_ID = "29946f99-c656-4942-9884-6bd0bab1e703";
const ADMIN_ID = "353eb34c-38e3-45d3-8690-b9b2aaafee2c";

async function main() {
  const pool = new pg.Pool({ connectionString: DATABASE_URL });

  // 1) Video S3'e yükle
  console.log("1) Video S3'e yükleniyor...");
  const s3 = new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  const trainingId = randomUUID();
  const videoId = randomUUID();
  const videoKey = `videos/${ORG_ID}/${trainingId}/${videoId}.mp4`;
  const videoBuffer = readFileSync("../denemevideo.mp4");

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: videoKey,
      Body: videoBuffer,
      ContentType: "video/mp4",
    })
  );

  const videoUrl = `https://${CF_DOMAIN}/${videoKey}`;
  console.log(`   Video yüklendi: ${videoUrl}`);

  // 2) Training oluştur
  console.log("2) Eğitim oluşturuluyor...");
  const now = new Date().toISOString();
  const endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

  await pool.query(
    `INSERT INTO trainings (id, organization_id, title, description, category, passing_score, max_attempts, exam_duration_minutes, start_date, end_date, is_active, publish_status, is_compulsory, smg_points, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
    [
      trainingId, ORG_ID,
      "Demo Eğitim - Temel Hastane Oryantasyonu",
      "Tüm demo personel için zorunlu temel oryantasyon eğitimi. Hastane prosedürleri, güvenlik kuralları ve temel protokolleri kapsar.",
      "Oryantasyon", 70, 3, 30, now, endDate, true, "published", true, 15, ADMIN_ID, now,
    ]
  );
  console.log(`   Eğitim: ${trainingId}`);

  // 3) Video kaydı
  console.log("3) Video kaydı oluşturuluyor...");
  await pool.query(
    `INSERT INTO training_videos (id, training_id, title, video_url, video_key, content_type, duration_seconds, sort_order, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [videoId, trainingId, "Bölüm 1: Temel Hastane Oryantasyonu", videoUrl, videoKey, "video", 0, 0, now]
  );
  console.log(`   Video: ${videoId}`);

  // 4) Sorular
  console.log("4) Sınav soruları oluşturuluyor...");
  const questions = [
    {
      text: "Hastane acil durum prosedürlerinde ilk yapılması gereken nedir?",
      options: [
        { text: "Acil durum planını takip etmek ve yetkililere haber vermek", correct: true },
        { text: "Hastaneyi terk etmek", correct: false },
        { text: "Sosyal medyadan paylaşım yapmak", correct: false },
      ],
    },
    {
      text: "Hasta bilgilerinin gizliliği hangi mevzuatla korunur?",
      options: [
        { text: "KVKK (Kişisel Verilerin Korunması Kanunu)", correct: true },
        { text: "Ticaret Kanunu", correct: false },
        { text: "İmar Kanunu", correct: false },
      ],
    },
    {
      text: "El hijyeni ne zaman uygulanmalıdır?",
      options: [
        { text: "Sadece yemekten önce", correct: false },
        { text: "Her hasta temasından önce ve sonra", correct: true },
        { text: "Sadece mesai bitiminde", correct: false },
      ],
    },
  ];

  for (let i = 0; i < questions.length; i++) {
    const qId = randomUUID();
    await pool.query(
      `INSERT INTO questions (id, training_id, question_text, question_type, points, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [qId, trainingId, questions[i].text, "multiple_choice", 10, i, now]
    );
    for (let j = 0; j < questions[i].options.length; j++) {
      await pool.query(
        `INSERT INTO question_options (id, question_id, option_text, is_correct, sort_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), qId, questions[i].options[j].text, questions[i].options[j].correct, j]
      );
    }
  }
  console.log(`   3 soru + 9 seçenek oluşturuldu`);

  // 5) Tüm demo personele ata
  console.log("5) Demo personele atanıyor...");
  const staffResult = await pool.query(
    `SELECT id FROM users WHERE organization_id = $1 AND role = 'staff' AND is_active = true`,
    [ORG_ID]
  );

  const staffIds = staffResult.rows.map((r) => r.id);
  console.log(`   ${staffIds.length} personel bulundu`);

  // Batch insert assignments
  let assignCount = 0;
  const batchSize = 50;
  for (let i = 0; i < staffIds.length; i += batchSize) {
    const batch = staffIds.slice(i, i + batchSize);
    const values = batch
      .map(
        (uid, idx) =>
          `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`
      )
      .join(", ");
    const params = batch.flatMap((uid) => [randomUUID(), trainingId, uid, "assigned", 3, ADMIN_ID]);

    await pool.query(
      `INSERT INTO training_assignments (id, training_id, user_id, status, max_attempts, assigned_by)
       VALUES ${values}
       ON CONFLICT (training_id, user_id) DO NOTHING`,
      params
    );
    assignCount += batch.length;
  }
  console.log(`   ${assignCount} personele atandı`);

  // 6) Bildirimler
  console.log("6) Bildirimler gönderiliyor...");
  for (let i = 0; i < staffIds.length; i += batchSize) {
    const batch = staffIds.slice(i, i + batchSize);
    const values = batch
      .map(
        (_, idx) =>
          `($${idx * 6 + 1}, $${idx * 6 + 2}, $${idx * 6 + 3}, $${idx * 6 + 4}, $${idx * 6 + 5}, $${idx * 6 + 6})`
      )
      .join(", ");
    const params = batch.flatMap((uid) => [
      randomUUID(), uid, ORG_ID,
      "Yeni Eğitim Atandı",
      '"Demo Eğitim - Temel Hastane Oryantasyonu" eğitimi size atandı.',
      "training_assigned",
    ]);

    await pool.query(
      `INSERT INTO notifications (id, user_id, organization_id, title, message, type)
       VALUES ${values}`,
      params
    );
  }
  console.log(`   ${staffIds.length} bildirim gönderildi`);

  console.log("\n✓ Tamamlandı!");
  console.log(`  Eğitim ID: ${trainingId}`);
  console.log(`  Video: ${videoUrl}`);
  console.log(`  Atanan: ${assignCount} personel`);

  await pool.end();
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
