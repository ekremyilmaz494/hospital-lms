const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:14521452Aa.14521452@db.bzvunibntyewobkdsoow.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('Connected to database');

  // Enable RLS on all tables
  const tables = [
    'users','organizations','organization_subscriptions','subscription_plans',
    'trainings','training_videos','questions','question_options',
    'training_assignments','exam_attempts','exam_answers','video_progress',
    'notifications','audit_logs','db_backups'
  ];

  for (const t of tables) {
    try { await client.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`); } catch(e) {}
  }
  console.log('RLS enabled on all tables');

  // Create helper functions
  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_user_role()
    RETURNS TEXT AS $$
      SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE
  `);
  console.log('Created get_user_role()');

  await client.query(`
    CREATE OR REPLACE FUNCTION public.get_user_org_id()
    RETURNS UUID AS $$
      SELECT (raw_user_meta_data->>'organization_id')::uuid FROM auth.users WHERE id = auth.uid();
    $$ LANGUAGE sql SECURITY DEFINER STABLE
  `);
  console.log('Created get_user_org_id()');

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
