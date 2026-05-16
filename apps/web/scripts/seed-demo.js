/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DATABASE_URL;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
if (!DEMO_PASSWORD) { console.error('DEMO_PASSWORD env değişkeni eksik'); process.exit(1); }

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !DB_URL) {
  console.error("Missing required environment variables.");
  process.exit(1);
}

async function run() {
  // Supabase admin client for auth user creation
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Direct DB connection for data seeding
  const db = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  console.log('Connected');

  // 1. Create demo organization
  const orgResult = await db.query(`
    INSERT INTO organizations (id, name, code, address, phone, email, is_active)
    VALUES (gen_random_uuid(), 'Demo Hastanesi', 'DEMO-001', 'Istanbul, Turkiye', '02121234567', 'info@demohastanesi.com', true)
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const orgId = orgResult.rows[0].id;
  console.log('Organization created:', orgId);

  // 2. Create subscription plan
  const planResult = await db.query(`
    INSERT INTO subscription_plans (id, name, slug, description, max_staff, max_trainings, max_storage_gb, price_monthly, price_annual, features, is_active)
    VALUES (gen_random_uuid(), 'Profesyonel', 'pro', 'Tam ozellikli plan', 500, 100, 50, 499.00, 4999.00, '["Video egitim", "Sinav modulu", "Raporlama", "E-posta bildirimleri"]', true)
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `);
  const planId = planResult.rows[0].id;
  console.log('Plan created:', planId);

  // 3. Create subscription for org
  await db.query(`
    INSERT INTO organization_subscriptions (id, organization_id, plan_id, status, billing_cycle, started_at, expires_at)
    VALUES (gen_random_uuid(), $1, $2, 'active', 'annual', now(), now() + interval '1 year')
    ON CONFLICT (organization_id) DO NOTHING
  `, [orgId, planId]);
  console.log('Subscription linked');

  // 4. Create auth users
  const SUPER_EMAIL = process.env.SEED_SUPER_EMAIL;
  const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL;
  const STAFF_EMAIL = process.env.SEED_STAFF_EMAIL;
  if (!SUPER_EMAIL || !ADMIN_EMAIL || !STAFF_EMAIL) {
    console.error('SEED_SUPER_EMAIL, SEED_ADMIN_EMAIL, SEED_STAFF_EMAIL env değişkenleri gerekli');
    process.exit(1);
  }
  const users = [
    { email: SUPER_EMAIL, password: DEMO_PASSWORD, firstName: 'Super', lastName: 'Admin', role: 'super_admin', orgId: null },
    { email: ADMIN_EMAIL, password: DEMO_PASSWORD, firstName: 'Hastane', lastName: 'Admin', role: 'admin', orgId: orgId },
    { email: STAFF_EMAIL, password: DEMO_PASSWORD, firstName: 'Personel', lastName: 'Test', role: 'staff', orgId: orgId },
  ];

  for (const u of users) {
    // Check if user exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(eu => eu.email === u.email);

    let userId;
    if (existing) {
      userId = existing.id;
      // Update metadata
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: {
          first_name: u.firstName,
          last_name: u.lastName,
          role: u.role,
          organization_id: u.orgId,
        }
      });
      console.log(`User updated: ${u.email} (${userId})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email,
        password: u.password,
        email_confirm: true,
        user_metadata: {
          first_name: u.firstName,
          last_name: u.lastName,
          role: u.role,
          organization_id: u.orgId,
        }
      });
      if (error) { console.error(`Failed to create ${u.email}:`, error.message); continue; }
      userId = data.user.id;
      console.log(`User created: ${u.email} (${userId})`);
    }

    // Upsert into users table
    await db.query(`
      INSERT INTO users (id, organization_id, email, first_name, last_name, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      ON CONFLICT (id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        role = EXCLUDED.role
    `, [userId, u.orgId, u.email, u.firstName, u.lastName, u.role]);
  }

  // 5. Create a sample training
  const adminUser = await db.query(`SELECT id FROM users WHERE email = $1`, [ADMIN_EMAIL]);
  const staffUser = await db.query(`SELECT id FROM users WHERE email = $1`, [STAFF_EMAIL]);

  if (adminUser.rows[0] && staffUser.rows[0]) {
    const trainingResult = await db.query(`
      INSERT INTO trainings (id, organization_id, title, description, category, passing_score, max_attempts, exam_duration_minutes, start_date, end_date, is_active, created_by)
      VALUES (gen_random_uuid(), $1, 'Enfeksiyon Kontrol Egitimi', 'Hastane ortaminda enfeksiyon onleme ve kontrol prosedurlerini iceren kapsamli egitim programi.', 'Enfeksiyon Kontrol', 70, 3, 30, now(), now() + interval '30 days', true, $2)
      RETURNING id
    `, [orgId, adminUser.rows[0].id]);
    const trainingId = trainingResult.rows[0].id;
    console.log('Training created:', trainingId);

    // Add questions
    const questions = [
      { text: 'El yikama suresi en az kac saniye olmalidir?', options: [
        { text: '10 saniye', correct: false },
        { text: '20 saniye', correct: true },
        { text: '5 saniye', correct: false },
        { text: '30 saniye', correct: false },
      ]},
      { text: 'Hangi durumda eldiven kullanimi zorunludur?', options: [
        { text: 'Hasta ile temas', correct: false },
        { text: 'Kan ve vucut sivilari ile temas', correct: true },
        { text: 'Sadece ameliyatlarda', correct: false },
        { text: 'Hicbir zaman zorunlu degil', correct: false },
      ]},
      { text: 'Tibbi atiklar hangi renkli posetlere atilir?', options: [
        { text: 'Siyah', correct: false },
        { text: 'Mavi', correct: false },
        { text: 'Kirmizi', correct: true },
        { text: 'Yesil', correct: false },
      ]},
    ];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qResult = await db.query(`
        INSERT INTO questions (id, training_id, question_text, question_type, points, sort_order)
        VALUES (gen_random_uuid(), $1, $2, 'multiple_choice', 10, $3) RETURNING id
      `, [trainingId, q.text, i + 1]);

      for (let j = 0; j < q.options.length; j++) {
        await db.query(`
          INSERT INTO question_options (id, question_id, option_text, is_correct, sort_order)
          VALUES (gen_random_uuid(), $1, $2, $3, $4)
        `, [qResult.rows[0].id, q.options[j].text, q.options[j].correct, j + 1]);
      }
    }
    console.log('Questions created');

    // Assign training to staff
    await db.query(`
      INSERT INTO training_assignments (id, training_id, user_id, status, current_attempt, max_attempts, assigned_by)
      VALUES (gen_random_uuid(), $1, $2, 'assigned', 0, 3, $3)
      ON CONFLICT (training_id, user_id) DO NOTHING
    `, [trainingId, staffUser.rows[0].id, adminUser.rows[0].id]);
    console.log('Training assigned to staff');

    // Create notification
    await db.query(`
      INSERT INTO notifications (id, user_id, organization_id, title, message, type, related_training_id)
      VALUES (gen_random_uuid(), $1, $2, 'Yeni Egitim Atandi', '"Enfeksiyon Kontrol Egitimi" size atandi.', 'assignment', $3)
    `, [staffUser.rows[0].id, orgId, trainingId]);
    console.log('Notification created');
  }

  await db.end();
  console.log('\n=== DEMO SETUP COMPLETE ===');
  console.log('Demo setup tamamlandi.');
}

run().catch(e => console.error('FATAL:', e.message));
