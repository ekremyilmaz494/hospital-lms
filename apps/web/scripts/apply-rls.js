/* eslint-disable @typescript-eslint/no-require-imports */
require('dotenv').config({ path: '.env' });
const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to database');

  // Enable RLS on all tables
  const tables = [
    'users','organizations','organization_subscriptions','subscription_plans',
    'trainings','training_videos','questions','question_options',
    'training_assignments','exam_attempts','exam_answers','video_progress',
    'notifications','audit_logs','db_backups',
    // Yeni tablolar
    'payments','invoices','departments','certificates',
    'content_library','organization_content_library',
    'accreditation_standards','accreditation_reports',
    'competency_forms','competency_categories','competency_items',
    'competency_evaluations','competency_answers',
    'training_categories','question_bank','question_bank_options',
    'smg_periods','smg_activities',
    'his_integrations','sync_logs',
    'kvkk_requests','push_subscriptions',
    'department_training_rules','scorm_attempts',
    // Training Feedback (EY.FR.40)
    'training_feedback_forms','training_feedback_categories','training_feedback_items',
    'training_feedback_responses','training_feedback_answers',
  ];

  for (const t of tables) {
    try { await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`); } catch(e) {}
  }
  console.log('RLS enabled on all tables');

  // Create helper functions — read from app_metadata (NOT user_metadata!)
  // app_metadata can only be set via service_role, users cannot edit it.
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_user_role()
    RETURNS TEXT AS $$
      SELECT raw_app_meta_data->>'role' FROM auth.users WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
  `);
  console.log('Created get_user_role() [app_metadata]');

  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_user_org_id()
    RETURNS UUID AS $$
      SELECT (raw_app_meta_data->>'organization_id')::uuid FROM auth.users WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
  `);
  console.log('Created get_user_org_id() [app_metadata]');

  // Policies
  const policies = [
    // USERS
    [`CREATE POLICY "super_admin_users_all" ON users FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_users_select" ON users FOR SELECT USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "admin_users_insert" ON users FOR INSERT WITH CHECK (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id() AND role = 'staff')`],
    [`CREATE POLICY "admin_users_update" ON users FOR UPDATE USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_users_select" ON users FOR SELECT USING (id = auth.uid())`],
    [`CREATE POLICY "staff_users_update" ON users FOR UPDATE USING (id = auth.uid())`],
    // ORGANIZATIONS
    [`CREATE POLICY "super_admin_orgs_all" ON organizations FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "member_orgs_select" ON organizations FOR SELECT USING (id = public.get_user_org_id())`],
    // SUBSCRIPTION PLANS
    [`CREATE POLICY "super_admin_plans_all" ON subscription_plans FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "anyone_plans_select" ON subscription_plans FOR SELECT USING (is_active = true)`],
    // ORGANIZATION SUBSCRIPTIONS
    [`CREATE POLICY "super_admin_subs_all" ON organization_subscriptions FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_subs_select" ON organization_subscriptions FOR SELECT USING (organization_id = public.get_user_org_id())`],
    // TRAININGS
    [`CREATE POLICY "super_admin_trainings_all" ON trainings FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_trainings_all" ON trainings FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_trainings_select" ON trainings FOR SELECT USING (id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()))`],
    // TRAINING VIDEOS
    [`CREATE POLICY "admin_videos_all" ON training_videos FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_videos_select" ON training_videos FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()))`],
    // QUESTIONS
    [`CREATE POLICY "admin_questions_all" ON questions FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_questions_select" ON questions FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()))`],
    // QUESTION OPTIONS
    [`CREATE POLICY "admin_options_all" ON question_options FOR ALL USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id())))`],
    [`CREATE POLICY "staff_options_select" ON question_options FOR SELECT USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid())))`],
    // TRAINING ASSIGNMENTS
    [`CREATE POLICY "super_admin_assignments_all" ON training_assignments FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_assignments_all" ON training_assignments FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_assignments_select" ON training_assignments FOR SELECT USING (user_id = auth.uid())`],
    // EXAM ATTEMPTS
    [`CREATE POLICY "admin_attempts_select" ON exam_attempts FOR SELECT USING (training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_attempts_all" ON exam_attempts FOR ALL USING (user_id = auth.uid())`],
    // EXAM ANSWERS
    [`CREATE POLICY "admin_answers_select" ON exam_answers FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id())))`],
    [`CREATE POLICY "staff_answers_all" ON exam_answers FOR ALL USING (attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid()))`],
    // VIDEO PROGRESS
    [`CREATE POLICY "admin_progress_select" ON video_progress FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id())))`],
    [`CREATE POLICY "staff_progress_all" ON video_progress FOR ALL USING (user_id = auth.uid())`],
    // NOTIFICATIONS
    [`CREATE POLICY "admin_notifications_all" ON notifications FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid())`],
    [`CREATE POLICY "staff_notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid())`],
    // AUDIT LOGS
    [`CREATE POLICY "super_admin_audit_all" ON audit_logs FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_audit_select" ON audit_logs FOR SELECT USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    // DB BACKUPS
    [`CREATE POLICY "admin_backups_all" ON db_backups FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- PAYMENTS ---
    [`CREATE POLICY "super_admin_payments_all" ON payments FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_payments_select" ON payments FOR SELECT USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- INVOICES ---
    [`CREATE POLICY "super_admin_invoices_all" ON invoices FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_invoices_select" ON invoices FOR SELECT USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- DEPARTMENTS ---
    [`CREATE POLICY "super_admin_departments_all" ON departments FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_departments_all" ON departments FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_departments_select" ON departments FOR SELECT USING (organization_id = public.get_user_org_id())`],

    // --- CERTIFICATES ---
    [`CREATE POLICY "super_admin_certificates_all" ON certificates FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_certificates_all" ON certificates FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_certificates_select" ON certificates FOR SELECT USING (user_id = auth.uid())`],

    // --- CONTENT LIBRARY ---
    [`CREATE POLICY "super_admin_content_library_all" ON content_library FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_content_library_select" ON content_library FOR SELECT USING (organization_id IS NULL OR organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "admin_content_library_write" ON content_library FOR INSERT WITH CHECK (public.get_user_role() = 'admin' AND (organization_id IS NULL OR organization_id = public.get_user_org_id()))`],

    // --- ORGANIZATION CONTENT LIBRARY (install tracking) ---
    [`CREATE POLICY "super_admin_org_content_all" ON organization_content_library FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_org_content_all" ON organization_content_library FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- ACCREDITATION STANDARDS ---
    [`CREATE POLICY "super_admin_accred_standards_all" ON accreditation_standards FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_accred_standards_select" ON accreditation_standards FOR SELECT USING (true)`],

    // --- ACCREDITATION REPORTS ---
    [`CREATE POLICY "super_admin_accred_reports_all" ON accreditation_reports FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_accred_reports_all" ON accreditation_reports FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- COMPETENCY FORMS ---
    [`CREATE POLICY "super_admin_comp_forms_all" ON competency_forms FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_comp_forms_all" ON competency_forms FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_comp_forms_select" ON competency_forms FOR SELECT USING (id IN (SELECT form_id FROM competency_evaluations WHERE subject_id = auth.uid() OR evaluator_id = auth.uid()))`],

    // --- COMPETENCY CATEGORIES ---
    [`CREATE POLICY "super_admin_comp_cats_all" ON competency_categories FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_comp_cats_all" ON competency_categories FOR ALL USING (form_id IN (SELECT id FROM competency_forms WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_comp_cats_select" ON competency_categories FOR SELECT USING (form_id IN (SELECT form_id FROM competency_evaluations WHERE subject_id = auth.uid() OR evaluator_id = auth.uid()))`],

    // --- COMPETENCY ITEMS ---
    [`CREATE POLICY "super_admin_comp_items_all" ON competency_items FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_comp_items_all" ON competency_items FOR ALL USING (category_id IN (SELECT id FROM competency_categories WHERE form_id IN (SELECT id FROM competency_forms WHERE organization_id = public.get_user_org_id())))`],
    [`CREATE POLICY "staff_comp_items_select" ON competency_items FOR SELECT USING (category_id IN (SELECT id FROM competency_categories WHERE form_id IN (SELECT form_id FROM competency_evaluations WHERE subject_id = auth.uid() OR evaluator_id = auth.uid())))`],

    // --- COMPETENCY EVALUATIONS ---
    [`CREATE POLICY "super_admin_comp_evals_all" ON competency_evaluations FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_comp_evals_all" ON competency_evaluations FOR ALL USING (form_id IN (SELECT id FROM competency_forms WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_comp_evals_own" ON competency_evaluations FOR ALL USING (subject_id = auth.uid() OR evaluator_id = auth.uid())`],

    // --- COMPETENCY ANSWERS ---
    [`CREATE POLICY "super_admin_comp_answers_all" ON competency_answers FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_comp_answers_all" ON competency_answers FOR ALL USING (evaluation_id IN (SELECT id FROM competency_evaluations WHERE form_id IN (SELECT id FROM competency_forms WHERE organization_id = public.get_user_org_id())))`],
    [`CREATE POLICY "staff_comp_answers_own" ON competency_answers FOR ALL USING (evaluation_id IN (SELECT id FROM competency_evaluations WHERE subject_id = auth.uid() OR evaluator_id = auth.uid()))`],

    // --- TRAINING CATEGORIES ---
    [`CREATE POLICY "super_admin_train_cats_all" ON training_categories FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_train_cats_all" ON training_categories FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- QUESTION BANK ---
    [`CREATE POLICY "super_admin_qbank_all" ON question_bank FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_qbank_all" ON question_bank FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- QUESTION BANK OPTIONS ---
    [`CREATE POLICY "super_admin_qbank_opts_all" ON question_bank_options FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_qbank_opts_all" ON question_bank_options FOR ALL USING (question_id IN (SELECT id FROM question_bank WHERE organization_id = public.get_user_org_id()))`],

    // --- SMG PERIODS ---
    [`CREATE POLICY "super_admin_smg_periods_all" ON smg_periods FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_smg_periods_all" ON smg_periods FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_smg_periods_select" ON smg_periods FOR SELECT USING (organization_id = public.get_user_org_id())`],

    // --- SMG ACTIVITIES ---
    [`CREATE POLICY "super_admin_smg_activities_all" ON smg_activities FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_smg_activities_all" ON smg_activities FOR ALL USING (period_id IN (SELECT id FROM smg_periods WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_smg_activities_own" ON smg_activities FOR ALL USING (user_id = auth.uid())`],

    // --- HIS INTEGRATIONS ---
    [`CREATE POLICY "super_admin_his_all" ON his_integrations FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_his_all" ON his_integrations FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],

    // --- SYNC LOGS ---
    [`CREATE POLICY "super_admin_sync_logs_all" ON sync_logs FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_sync_logs_select" ON sync_logs FOR SELECT USING (organization_id = public.get_user_org_id())`],

    // --- KVKK REQUESTS ---
    [`CREATE POLICY "super_admin_kvkk_all" ON kvkk_requests FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_kvkk_all" ON kvkk_requests FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_kvkk_own" ON kvkk_requests FOR ALL USING (user_id = auth.uid())`],

    // --- PUSH SUBSCRIPTIONS ---
    [`CREATE POLICY "staff_push_own" ON push_subscriptions FOR ALL USING (user_id = auth.uid())`],

    // --- DEPARTMENT TRAINING RULES ---
    [`CREATE POLICY "super_admin_dept_rules_all" ON department_training_rules FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_dept_rules_all" ON department_training_rules FOR ALL USING (department_id IN (SELECT id FROM departments WHERE organization_id = public.get_user_org_id()))`],

    // --- SCORM ATTEMPTS ---
    [`CREATE POLICY "admin_scorm_attempts_select" ON scorm_attempts FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = public.get_user_org_id())))`],
    [`CREATE POLICY "staff_scorm_attempts_all" ON scorm_attempts FOR ALL USING (attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid()))`],

    // --- TRAINING FEEDBACK FORMS (EY.FR.40) ---
    // ⚠️ ÖNCEDEN user_metadata kullanıyordu (BYPASS RİSKİ) — app_metadata helper'larıyla düzeltildi
    [`CREATE POLICY "super_admin_tfb_forms_all" ON training_feedback_forms FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_tfb_forms_all" ON training_feedback_forms FOR ALL USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_tfb_forms_select" ON training_feedback_forms FOR SELECT USING (organization_id = public.get_user_org_id() AND is_active = true)`],

    // --- TRAINING FEEDBACK CATEGORIES ---
    [`CREATE POLICY "admin_tfb_categories_all" ON training_feedback_categories FOR ALL USING (form_id IN (SELECT id FROM training_feedback_forms WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_tfb_categories_select" ON training_feedback_categories FOR SELECT USING (form_id IN (SELECT id FROM training_feedback_forms WHERE organization_id = public.get_user_org_id() AND is_active = true))`],

    // --- TRAINING FEEDBACK ITEMS ---
    [`CREATE POLICY "admin_tfb_items_all" ON training_feedback_items FOR ALL USING (category_id IN (SELECT c.id FROM training_feedback_categories c JOIN training_feedback_forms f ON c.form_id = f.id WHERE f.organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_tfb_items_select" ON training_feedback_items FOR SELECT USING (category_id IN (SELECT c.id FROM training_feedback_categories c JOIN training_feedback_forms f ON c.form_id = f.id WHERE f.organization_id = public.get_user_org_id() AND f.is_active = true))`],

    // --- TRAINING FEEDBACK RESPONSES ---
    [`CREATE POLICY "super_admin_tfb_responses_all" ON training_feedback_responses FOR ALL USING (public.get_user_role() = 'super_admin')`],
    [`CREATE POLICY "admin_tfb_responses_select" ON training_feedback_responses FOR SELECT USING (public.get_user_role() = 'admin' AND organization_id = public.get_user_org_id())`],
    [`CREATE POLICY "staff_tfb_responses_select_own" ON training_feedback_responses FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid()))`],
    [`CREATE POLICY "staff_tfb_responses_insert_own" ON training_feedback_responses FOR INSERT WITH CHECK (attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid()) AND organization_id = public.get_user_org_id())`],

    // --- TRAINING FEEDBACK ANSWERS ---
    [`CREATE POLICY "admin_tfb_answers_select" ON training_feedback_answers FOR SELECT USING (response_id IN (SELECT id FROM training_feedback_responses WHERE organization_id = public.get_user_org_id()))`],
    [`CREATE POLICY "staff_tfb_answers_select_own" ON training_feedback_answers FOR SELECT USING (response_id IN (SELECT r.id FROM training_feedback_responses r JOIN exam_attempts a ON r.attempt_id = a.id WHERE a.user_id = auth.uid()))`],
    [`CREATE POLICY "staff_tfb_answers_insert_own" ON training_feedback_answers FOR INSERT WITH CHECK (response_id IN (SELECT r.id FROM training_feedback_responses r JOIN exam_attempts a ON r.attempt_id = a.id WHERE a.user_id = auth.uid()))`],
  ];

  let ok = 0, fail = 0;
  for (const [sql] of policies) {
    // Extract policy name and table for DROP
    const match = sql.match(/CREATE POLICY "(.+?)" ON (\S+)/);
    if (match) {
      try { await client.query(`DROP POLICY IF EXISTS "${match[1]}" ON ${match[2]}`); } catch(e) {}
    }
    try {
      await client.query(sql);
      ok++;
    } catch(e) {
      console.error('FAIL:', match?.[1] || 'unknown', '-', e.message.substring(0, 100));
      fail++;
    }
  }
  console.log(`Policies: ${ok} created, ${fail} failed`);

  // Realtime for notifications
  try {
    await client.query('ALTER PUBLICATION supabase_realtime ADD TABLE notifications');
    console.log('Realtime enabled for notifications');
  } catch(e) {
    console.log('Realtime already configured or skipped');
  }

  await client.end();
  console.log('Done!');
}

run().catch(e => console.error('FATAL:', e.message));
