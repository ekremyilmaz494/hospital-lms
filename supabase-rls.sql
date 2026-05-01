-- ═══════════════════════════════════════════════════════════════
-- Hospital LMS — Supabase RLS Policies
-- Run this in Supabase SQL Editor AFTER running Prisma migrations
--
-- SECURITY: Uses auth.jwt() -> 'app_metadata' (NOT user_metadata!)
-- app_metadata can only be set via service_role — users cannot edit it.
-- user_metadata is editable by end-users and MUST NOT be used for authz.
--
-- PERFORMANCE: All auth.jwt() calls wrapped in (SELECT ...) for InitPlan
-- optimization — PostgreSQL evaluates the expression once per query
-- instead of once per row.
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
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE kvkk_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE scorm_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_training_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE smg_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE smg_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_content_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE his_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE competency_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE accreditation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE _prisma_migrations ENABLE ROW LEVEL SECURITY;

-- USERS
CREATE POLICY "super_admin_users_all" ON users FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_users_select" ON users FOR SELECT USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "admin_users_insert" ON users FOR INSERT WITH CHECK ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) AND role = 'staff');
CREATE POLICY "admin_users_update" ON users FOR UPDATE USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_users_select" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "staff_users_update" ON users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ORGANIZATIONS
CREATE POLICY "super_admin_orgs_all" ON organizations FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "member_orgs_select" ON organizations FOR SELECT USING (id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- SUBSCRIPTION PLANS
CREATE POLICY "super_admin_plans_all" ON subscription_plans FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "anyone_plans_select" ON subscription_plans FOR SELECT USING (is_active = true);

-- ORGANIZATION SUBSCRIPTIONS
CREATE POLICY "super_admin_subs_all" ON organization_subscriptions FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_subs_select" ON organization_subscriptions FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- TRAININGS
CREATE POLICY "super_admin_trainings_all" ON trainings FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_trainings_all" ON trainings FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_trainings_select" ON trainings FOR SELECT USING (id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));

-- TRAINING VIDEOS
CREATE POLICY "admin_videos_all" ON training_videos FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_videos_select" ON training_videos FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));

-- QUESTIONS + OPTIONS
CREATE POLICY "admin_questions_all" ON questions FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_questions_select" ON questions FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));
CREATE POLICY "admin_options_all" ON question_options FOR ALL USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid))));
CREATE POLICY "staff_options_select" ON question_options FOR SELECT USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid())));

-- TRAINING ASSIGNMENTS
CREATE POLICY "super_admin_assignments_all" ON training_assignments FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_assignments_all" ON training_assignments FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_assignments_select" ON training_assignments FOR SELECT USING (user_id = auth.uid());

-- EXAM ATTEMPTS (organization_id eklendi — direkt filtre, subquery gereksiz)
CREATE POLICY "admin_attempts_select" ON exam_attempts FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_attempts_all" ON exam_attempts FOR ALL USING (user_id = auth.uid());

-- EXAM ANSWERS
CREATE POLICY "admin_answers_select" ON exam_answers FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid))));
CREATE POLICY "staff_answers_all" ON exam_answers FOR ALL USING (attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid()));

-- VIDEO PROGRESS
CREATE POLICY "admin_progress_select" ON video_progress FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid))));
CREATE POLICY "staff_progress_all" ON video_progress FOR ALL USING (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "admin_notifications_all" ON notifications FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- AUDIT LOGS
CREATE POLICY "super_admin_audit_all" ON audit_logs FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_audit_select" ON audit_logs FOR SELECT USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- DB BACKUPS
CREATE POLICY "super_admin_backups_all" ON db_backups FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_backups_all" ON db_backups FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- DEPARTMENTS
CREATE POLICY "super_admin_departments_all" ON departments FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_departments_all" ON departments FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_departments_select" ON departments FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- CERTIFICATES
CREATE POLICY "super_admin_certificates_all" ON certificates FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_certificates_all" ON certificates FOR ALL USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_certificates_select" ON certificates FOR SELECT USING (user_id = auth.uid());

-- KVKK REQUESTS
CREATE POLICY "admin_kvkk_all" ON kvkk_requests FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_kvkk_own" ON kvkk_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_kvkk_insert" ON kvkk_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- SCORM ATTEMPTS
CREATE POLICY "admin_scorm_all" ON scorm_attempts FOR ALL USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_scorm_own" ON scorm_attempts FOR ALL USING (user_id = auth.uid());

-- DEPARTMENT TRAINING RULES
CREATE POLICY "admin_dept_rules_all" ON department_training_rules FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_dept_rules_select" ON department_training_rules FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- PAYMENTS
CREATE POLICY "super_admin_payments_all" ON payments FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_payments_select" ON payments FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- INVOICES
CREATE POLICY "super_admin_invoices_all" ON invoices FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_invoices_select" ON invoices FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- SMG ACTIVITIES
CREATE POLICY "admin_smg_activities_all" ON smg_activities FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_smg_activities_own" ON smg_activities FOR ALL USING (user_id = auth.uid() AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- SMG PERIODS
CREATE POLICY "admin_smg_periods_all" ON smg_periods FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_smg_periods_select" ON smg_periods FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- CONTENT LIBRARY
CREATE POLICY "super_admin_content_library_all" ON content_library FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "all_content_library_select" ON content_library FOR SELECT USING (is_active = true);

-- ORGANIZATION CONTENT LIBRARY
CREATE POLICY "admin_org_content_library_all" ON organization_content_library FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_org_content_library_select" ON organization_content_library FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- HIS INTEGRATIONS
CREATE POLICY "admin_his_integrations_all" ON his_integrations FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- SYNC LOGS
CREATE POLICY "admin_sync_logs_select" ON sync_logs FOR SELECT USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- COMPETENCY FORMS
CREATE POLICY "admin_comp_forms_all" ON competency_forms FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_comp_forms_select" ON competency_forms FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- COMPETENCY CATEGORIES
CREATE POLICY "admin_comp_categories_all" ON competency_categories FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_forms f WHERE f.id = form_id AND f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_categories_select" ON competency_categories FOR SELECT USING (EXISTS (SELECT 1 FROM competency_forms f WHERE f.id = form_id AND f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));

-- COMPETENCY ITEMS
CREATE POLICY "admin_comp_items_all" ON competency_items FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_categories c JOIN competency_forms f ON f.id = c.form_id WHERE c.id = category_id AND f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_items_select" ON competency_items FOR SELECT USING (EXISTS (SELECT 1 FROM competency_categories c JOIN competency_forms f ON f.id = c.form_id WHERE c.id = category_id AND f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));

-- COMPETENCY EVALUATIONS
CREATE POLICY "admin_comp_evals_all" ON competency_evaluations FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_forms f WHERE f.id = form_id AND f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_evals_own" ON competency_evaluations FOR ALL USING (evaluator_id = auth.uid() OR subject_id = auth.uid());

-- COMPETENCY ANSWERS
CREATE POLICY "admin_comp_answers_all" ON competency_answers FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND EXISTS (SELECT 1 FROM competency_evaluations e JOIN competency_forms f ON f.id = e.form_id WHERE e.id = evaluation_id AND f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)));
CREATE POLICY "staff_comp_answers_own" ON competency_answers FOR ALL USING (EXISTS (SELECT 1 FROM competency_evaluations e WHERE e.id = evaluation_id AND (e.evaluator_id = auth.uid() OR e.subject_id = auth.uid())));

-- PUSH SUBSCRIPTIONS
CREATE POLICY "user_push_subscriptions_own" ON push_subscriptions FOR ALL USING (user_id = auth.uid());

-- TRUSTED DEVICES (SMS MFA)
CREATE POLICY "user_trusted_devices_own" ON trusted_devices FOR ALL USING (user_id = auth.uid());

-- TRAINING CATEGORIES
CREATE POLICY "super_admin_training_categories_all" ON training_categories
  FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_training_categories_all" ON training_categories
  FOR ALL USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );
CREATE POLICY "staff_training_categories_select" ON training_categories
  FOR SELECT USING (
    organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- QUESTION BANK
CREATE POLICY "admin_question_bank_all" ON question_bank FOR ALL
  USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- QUESTION BANK OPTIONS
CREATE POLICY "admin_question_bank_options_all" ON question_bank_options FOR ALL
  USING (question_bank_id IN (
    SELECT id FROM question_bank
    WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  ));

-- ACCREDITATION STANDARDS
-- Super admin: tam erişim.
-- Admin: globalleri (organization_id IS NULL) okur; kendi kurumunun standartlarını CRUD eder.
CREATE POLICY "super_admin_accreditation_standards_all" ON accreditation_standards
  FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

CREATE POLICY "admin_accreditation_standards_select" ON accreditation_standards
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "admin_accreditation_standards_insert" ON accreditation_standards
  FOR INSERT WITH CHECK (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "admin_accreditation_standards_update" ON accreditation_standards
  FOR UPDATE USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

CREATE POLICY "admin_accreditation_standards_delete" ON accreditation_standards
  FOR DELETE USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- ACCREDITATION REPORTS
CREATE POLICY "super_admin_accreditation_reports_all" ON accreditation_reports
  FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_accreditation_reports_all" ON accreditation_reports
  FOR ALL USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );
CREATE POLICY "staff_accreditation_reports_select" ON accreditation_reports
  FOR SELECT USING (
    organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- ═══════════════════════════════════════════════════════════════
-- EY.FR.40 EĞİTİM GERİ BİLDİRİM FORMU
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE training_feedback_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_feedback_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_feedback_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_feedback_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_feedback_answers ENABLE ROW LEVEL SECURITY;

-- ⚠️ GÜVENLİK NOTU: Aşağıdaki policy'ler ÖNCEDEN user_metadata kullanıyordu (BYPASS RİSKİ).
-- user_metadata son kullanıcı tarafından düzenlenebilir → app_metadata'ya çevrildi.
-- app_metadata yalnızca service_role ile yazılabilir (auth-user-factory.ts).
-- Bkz: rls-sat-r-bazl-g-venlik-ethereal-otter.md GAP-1.

-- TRAINING FEEDBACK FORMS: admin duzenler, staff sadece okur (dolduracak)
CREATE POLICY "super_admin_tfb_forms_all" ON training_feedback_forms
  FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_tfb_forms_all" ON training_feedback_forms
  FOR ALL USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );
CREATE POLICY "staff_tfb_forms_select" ON training_feedback_forms
  FOR SELECT USING (
    organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    AND is_active = true
  );

-- TRAINING FEEDBACK CATEGORIES: form uzerinden org filtreli
CREATE POLICY "admin_tfb_categories_all" ON training_feedback_categories
  FOR ALL USING (
    form_id IN (
      SELECT id FROM training_feedback_forms
      WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    )
  );
CREATE POLICY "staff_tfb_categories_select" ON training_feedback_categories
  FOR SELECT USING (
    form_id IN (
      SELECT id FROM training_feedback_forms
      WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        AND is_active = true
    )
  );

-- TRAINING FEEDBACK ITEMS: kategori uzerinden org filtreli
CREATE POLICY "admin_tfb_items_all" ON training_feedback_items
  FOR ALL USING (
    category_id IN (
      SELECT c.id FROM training_feedback_categories c
      JOIN training_feedback_forms f ON c.form_id = f.id
      WHERE f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    )
  );
CREATE POLICY "staff_tfb_items_select" ON training_feedback_items
  FOR SELECT USING (
    category_id IN (
      SELECT c.id FROM training_feedback_categories c
      JOIN training_feedback_forms f ON c.form_id = f.id
      WHERE f.organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
        AND f.is_active = true
    )
  );

-- TRAINING FEEDBACK RESPONSES: denormalize organization_id ile direkt filtre
CREATE POLICY "super_admin_tfb_responses_all" ON training_feedback_responses
  FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_tfb_responses_select" ON training_feedback_responses
  FOR SELECT USING (
    (SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );
-- Staff: kendi attempt'ine ait response'u gorebilir ve ekleyebilir; guncelleme/silme yok
CREATE POLICY "staff_tfb_responses_select_own" ON training_feedback_responses
  FOR SELECT USING (
    attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid())
  );
CREATE POLICY "staff_tfb_responses_insert_own" ON training_feedback_responses
  FOR INSERT WITH CHECK (
    attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid())
    AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
  );

-- TRAINING FEEDBACK ANSWERS: response uzerinden filtreli
CREATE POLICY "admin_tfb_answers_select" ON training_feedback_answers
  FOR SELECT USING (
    response_id IN (
      SELECT id FROM training_feedback_responses
      WHERE organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid)
    )
  );
CREATE POLICY "staff_tfb_answers_select_own" ON training_feedback_answers
  FOR SELECT USING (
    response_id IN (
      SELECT r.id FROM training_feedback_responses r
      JOIN exam_attempts a ON r.attempt_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );
CREATE POLICY "staff_tfb_answers_insert_own" ON training_feedback_answers
  FOR INSERT WITH CHECK (
    response_id IN (
      SELECT r.id FROM training_feedback_responses r
      JOIN exam_attempts a ON r.attempt_id = a.id
      WHERE a.user_id = auth.uid()
    )
  );

-- ── SMG CATEGORIES RLS (SKS Uyumu) ──
ALTER TABLE smg_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE smg_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_smg_categories_all" ON smg_categories FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_smg_categories_select" ON smg_categories FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid) AND is_active = true);

CREATE POLICY "admin_smg_targets_all" ON smg_targets FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_smg_targets_select" ON smg_targets FOR SELECT USING (organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

-- ── ACTIVITY LOGS RLS (Personel Hareket Takibi) ──
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_activity_logs_all" ON activity_logs FOR ALL USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
CREATE POLICY "admin_activity_logs_select" ON activity_logs FOR SELECT USING ((SELECT auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));
CREATE POLICY "staff_activity_logs_select" ON activity_logs FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "authenticated_activity_logs_insert" ON activity_logs FOR INSERT WITH CHECK (user_id = auth.uid() AND organization_id = ((SELECT auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid));

