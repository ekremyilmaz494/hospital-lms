-- ═══════════════════════════════════════════════════════════════
-- Hospital LMS — Supabase RLS Policies
-- Run this in Supabase SQL Editor AFTER running Prisma migrations
-- NOTE: Uses auth.jwt() directly — no custom auth schema functions needed
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_backups ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "super_admin_users_all" ON users FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_users_select" ON users FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "admin_users_insert" ON users FOR INSERT WITH CHECK ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid) AND role = 'staff');
CREATE POLICY "admin_users_update" ON users FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_users_select" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "staff_users_update" ON users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ORGANIZATIONS
CREATE POLICY "super_admin_orgs_all" ON organizations FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "member_orgs_select" ON organizations FOR SELECT USING (id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- SUBSCRIPTION PLANS
CREATE POLICY "super_admin_plans_all" ON subscription_plans FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "anyone_plans_select" ON subscription_plans FOR SELECT USING (is_active = true);

-- ORGANIZATION SUBSCRIPTIONS
CREATE POLICY "super_admin_subs_all" ON organization_subscriptions FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_subs_select" ON organization_subscriptions FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- TRAININGS
CREATE POLICY "super_admin_trainings_all" ON trainings FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_trainings_all" ON trainings FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_trainings_select" ON trainings FOR SELECT USING (id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));

-- TRAINING VIDEOS
CREATE POLICY "admin_videos_all" ON training_videos FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_videos_select" ON training_videos FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));

-- QUESTIONS + OPTIONS
CREATE POLICY "admin_questions_all" ON questions FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_questions_select" ON questions FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));
CREATE POLICY "admin_options_all" ON question_options FOR ALL USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid))));
CREATE POLICY "staff_options_select" ON question_options FOR SELECT USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid())));

-- TRAINING ASSIGNMENTS
CREATE POLICY "super_admin_assignments_all" ON training_assignments FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_assignments_all" ON training_assignments FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_assignments_select" ON training_assignments FOR SELECT USING (user_id = auth.uid());

-- EXAM ATTEMPTS
CREATE POLICY "admin_attempts_select" ON exam_attempts FOR SELECT USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_attempts_all" ON exam_attempts FOR ALL USING (user_id = auth.uid());

-- EXAM ANSWERS
CREATE POLICY "admin_answers_select" ON exam_answers FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid))));
CREATE POLICY "staff_answers_all" ON exam_answers FOR ALL USING (attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid()));

-- VIDEO PROGRESS
CREATE POLICY "admin_progress_select" ON video_progress FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid))));
CREATE POLICY "staff_progress_all" ON video_progress FOR ALL USING (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "admin_notifications_all" ON notifications FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- AUDIT LOGS
CREATE POLICY "super_admin_audit_all" ON audit_logs FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_audit_select" ON audit_logs FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- DB BACKUPS
CREATE POLICY "super_admin_backups_all" ON db_backups FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_backups_all" ON db_backups FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- DEPARTMENTS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_departments_all" ON departments FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_departments_all" ON departments FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_departments_select" ON departments FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- CERTIFICATES
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_certificates_all" ON certificates FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_certificates_all" ON certificates FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_certificates_select" ON certificates FOR SELECT USING (user_id = auth.uid());

-- KVKK REQUESTS
ALTER TABLE kvkk_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_kvkk_all" ON kvkk_requests FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_kvkk_own" ON kvkk_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_kvkk_insert" ON kvkk_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- SCORM ATTEMPTS
ALTER TABLE scorm_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_scorm_all" ON scorm_attempts FOR ALL USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_scorm_own" ON scorm_attempts FOR ALL USING (user_id = auth.uid());

-- DEPARTMENT TRAINING RULES
ALTER TABLE department_training_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_dept_rules_all" ON department_training_rules FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_dept_rules_select" ON department_training_rules FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_payments_all" ON payments FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_payments_select" ON payments FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_invoices_all" ON invoices FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_invoices_select" ON invoices FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- SMG ACTIVITIES
ALTER TABLE smg_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_smg_activities_all" ON smg_activities FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_smg_activities_own" ON smg_activities FOR ALL USING (user_id = auth.uid() AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- SMG PERIODS
ALTER TABLE smg_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_smg_periods_all" ON smg_periods FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_smg_periods_select" ON smg_periods FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- CONTENT LIBRARY
ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_content_library_all" ON content_library FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "all_content_library_select" ON content_library FOR SELECT USING (is_active = true);

-- ORGANIZATION CONTENT LIBRARY
ALTER TABLE organization_content_library ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_org_content_library_all" ON organization_content_library FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_org_content_library_select" ON organization_content_library FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- HIS INTEGRATIONS
ALTER TABLE his_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_his_integrations_all" ON his_integrations FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- SYNC LOGS
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_sync_logs_select" ON sync_logs FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- COMPETENCY FORMS
ALTER TABLE competency_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_comp_forms_all" ON competency_forms FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_comp_forms_select" ON competency_forms FOR SELECT USING (organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- COMPETENCY CATEGORIES
ALTER TABLE competency_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_comp_categories_all" ON competency_categories FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_forms f WHERE f.id = form_id AND f.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_categories_select" ON competency_categories FOR SELECT USING (EXISTS (SELECT 1 FROM competency_forms f WHERE f.id = form_id AND f.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- COMPETENCY ITEMS
ALTER TABLE competency_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_comp_items_all" ON competency_items FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_categories c JOIN competency_forms f ON f.id = c.form_id WHERE c.id = category_id AND f.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_items_select" ON competency_items FOR SELECT USING (EXISTS (SELECT 1 FROM competency_categories c JOIN competency_forms f ON f.id = c.form_id WHERE c.id = category_id AND f.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));

-- COMPETENCY EVALUATIONS
ALTER TABLE competency_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_comp_evals_all" ON competency_evaluations FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_forms f WHERE f.id = form_id AND f.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_evals_own" ON competency_evaluations FOR ALL USING (evaluator_id = auth.uid() OR subject_id = auth.uid());

-- COMPETENCY ANSWERS
ALTER TABLE competency_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_comp_answers_all" ON competency_answers FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_evaluations e JOIN competency_forms f ON f.id = e.form_id WHERE e.id = evaluation_id AND f.organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_answers_own" ON competency_answers FOR ALL USING (EXISTS (SELECT 1 FROM competency_evaluations e WHERE e.id = evaluation_id AND (e.evaluator_id = auth.uid() OR e.subject_id = auth.uid())));

-- PUSH SUBSCRIPTIONS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_push_subscriptions_own" ON push_subscriptions FOR ALL USING (user_id = auth.uid());


-- TRAINING CATEGORIES
ALTER TABLE training_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_training_categories_all" ON training_categories
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_training_categories_all" ON training_categories
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );
CREATE POLICY "staff_training_categories_select" ON training_categories
  FOR SELECT USING (
    organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );

-- QUESTION BANK
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_question_bank_all" ON question_bank FOR ALL
  USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid));

-- QUESTION BANK OPTIONS
ALTER TABLE question_bank_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_question_bank_options_all" ON question_bank_options FOR ALL
  USING (question_bank_id IN (
    SELECT id FROM question_bank
    WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  ));

-- ACCREDITATION STANDARDS (eksik)
ALTER TABLE accreditation_standards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_accreditation_standards_all" ON accreditation_standards
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_accreditation_standards_select" ON accreditation_standards
  FOR SELECT USING (true);

-- ACCREDITATION REPORTS
ALTER TABLE accreditation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_accreditation_reports_all" ON accreditation_reports
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_accreditation_reports_all" ON accreditation_reports
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );
CREATE POLICY "staff_accreditation_reports_select" ON accreditation_reports
  FOR SELECT USING (
    organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );

-- ══════════════════════════════════════════════════════════════
-- YENI POLICY'LER — AI Modulu Tablolari
-- ══════════════════════════════════════════════════════════════

-- AI NOTEBOOKS
ALTER TABLE ai_notebooks ENABLE ROW LEVEL SECURITY;
-- super_admin: tum kayitlara full erisim
CREATE POLICY "super_admin_ai_notebooks_all" ON ai_notebooks
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
-- admin: sadece kendi organizasyonunun kayitlari
CREATE POLICY "admin_ai_notebooks_all" ON ai_notebooks
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );
-- staff: sadece kendi organizasyonunun kayitlarini gorebilir
CREATE POLICY "staff_ai_notebooks_select" ON ai_notebooks
  FOR SELECT USING (
    organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );

-- AI NOTEBOOK SOURCES (organizationId yok, notebook uzerinden filtrelenir)
ALTER TABLE ai_notebook_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_ai_notebook_sources_all" ON ai_notebook_sources
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_ai_notebook_sources_all" ON ai_notebook_sources
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    AND notebook_id IN (
      SELECT id FROM ai_notebooks
      WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    )
  );
CREATE POLICY "staff_ai_notebook_sources_select" ON ai_notebook_sources
  FOR SELECT USING (
    notebook_id IN (
      SELECT id FROM ai_notebooks
      WHERE organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
    )
  );

-- AI GENERATIONS
ALTER TABLE ai_generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_ai_generations_all" ON ai_generations
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_ai_generations_all" ON ai_generations
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );
-- staff: sadece kendi olusturdugu kayitlar (userId = auth.uid()) ve kendi org'u
CREATE POLICY "staff_ai_generations_select" ON ai_generations
  FOR SELECT USING (
    user_id = auth.uid()
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );

-- AI GOOGLE CONNECTIONS
ALTER TABLE ai_google_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_ai_google_connections_all" ON ai_google_connections
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_ai_google_connections_all" ON ai_google_connections
  FOR ALL USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );
-- staff: sadece kendi baglantisini gorebilir
CREATE POLICY "staff_ai_google_connections_own" ON ai_google_connections
  FOR SELECT USING (
    user_id = auth.uid()
    AND organization_id = ((auth.jwt() -> 'user_metadata' ->> 'organization_id')::uuid)
  );
