-- ═══════════════════════════════════════════════════════════════
-- Hospital LMS — Supabase RLS Policies
-- Run this in Supabase SQL Editor AFTER running Prisma migrations
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

-- Helper functions
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT AS $$
  SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS UUID AS $$
  SELECT (raw_user_meta_data->>'organization_id')::uuid FROM auth.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- USERS
CREATE POLICY "super_admin_users_all" ON users FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_users_select" ON users FOR SELECT USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());
CREATE POLICY "admin_users_insert" ON users FOR INSERT WITH CHECK (auth.user_role() = 'admin' AND organization_id = auth.user_org_id() AND role = 'staff');
CREATE POLICY "admin_users_update" ON users FOR UPDATE USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());
CREATE POLICY "staff_users_select" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "staff_users_update" ON users FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ORGANIZATIONS
CREATE POLICY "super_admin_orgs_all" ON organizations FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "member_orgs_select" ON organizations FOR SELECT USING (id = auth.user_org_id());

-- SUBSCRIPTION PLANS
CREATE POLICY "super_admin_plans_all" ON subscription_plans FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "anyone_plans_select" ON subscription_plans FOR SELECT USING (is_active = true);

-- ORGANIZATION SUBSCRIPTIONS
CREATE POLICY "super_admin_subs_all" ON organization_subscriptions FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_subs_select" ON organization_subscriptions FOR SELECT USING (organization_id = auth.user_org_id());

-- TRAININGS
CREATE POLICY "super_admin_trainings_all" ON trainings FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_trainings_all" ON trainings FOR ALL USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());
CREATE POLICY "staff_trainings_select" ON trainings FOR SELECT USING (id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));

-- TRAINING VIDEOS
CREATE POLICY "admin_videos_all" ON training_videos FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id()));
CREATE POLICY "staff_videos_select" ON training_videos FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));

-- QUESTIONS + OPTIONS
CREATE POLICY "admin_questions_all" ON questions FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id()));
CREATE POLICY "staff_questions_select" ON questions FOR SELECT USING (training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid()));
CREATE POLICY "admin_options_all" ON question_options FOR ALL USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id())));
CREATE POLICY "staff_options_select" ON question_options FOR SELECT USING (question_id IN (SELECT id FROM questions WHERE training_id IN (SELECT training_id FROM training_assignments WHERE user_id = auth.uid())));

-- TRAINING ASSIGNMENTS
CREATE POLICY "super_admin_assignments_all" ON training_assignments FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_assignments_all" ON training_assignments FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id()));
CREATE POLICY "staff_assignments_select" ON training_assignments FOR SELECT USING (user_id = auth.uid());

-- EXAM ATTEMPTS
CREATE POLICY "admin_attempts_select" ON exam_attempts FOR SELECT USING (training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id()));
CREATE POLICY "staff_attempts_all" ON exam_attempts FOR ALL USING (user_id = auth.uid());

-- EXAM ANSWERS
CREATE POLICY "admin_answers_select" ON exam_answers FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id())));
CREATE POLICY "staff_answers_all" ON exam_answers FOR ALL USING (attempt_id IN (SELECT id FROM exam_attempts WHERE user_id = auth.uid()));

-- VIDEO PROGRESS
CREATE POLICY "admin_progress_select" ON video_progress FOR SELECT USING (attempt_id IN (SELECT id FROM exam_attempts WHERE training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id())));
CREATE POLICY "staff_progress_all" ON video_progress FOR ALL USING (user_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "admin_notifications_all" ON notifications FOR ALL USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());
CREATE POLICY "staff_notifications_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_notifications_update" ON notifications FOR UPDATE USING (user_id = auth.uid());

-- AUDIT LOGS
CREATE POLICY "super_admin_audit_all" ON audit_logs FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_audit_select" ON audit_logs FOR SELECT USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());

-- DB BACKUPS
CREATE POLICY "admin_backups_all" ON db_backups FOR ALL USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());

-- DEPARTMENTS
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_departments_all" ON departments FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_departments_all" ON departments FOR ALL USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());
CREATE POLICY "staff_departments_select" ON departments FOR SELECT USING (organization_id = auth.user_org_id());

-- CERTIFICATES
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_certificates_all" ON certificates FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_certificates_all" ON certificates FOR ALL USING (training_id IN (SELECT id FROM trainings WHERE organization_id = auth.user_org_id()));
CREATE POLICY "staff_certificates_select" ON certificates FOR SELECT USING (user_id = auth.uid());

-- KVKK REQUESTS
ALTER TABLE kvkk_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_kvkk_all" ON kvkk_requests FOR ALL USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());
CREATE POLICY "staff_kvkk_own" ON kvkk_requests FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "staff_kvkk_insert" ON kvkk_requests FOR INSERT WITH CHECK (user_id = auth.uid());

-- SCORM ATTEMPTS
ALTER TABLE scorm_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_scorm_all" ON scorm_attempts FOR ALL USING (organization_id = auth.user_org_id());
CREATE POLICY "staff_scorm_own" ON scorm_attempts FOR ALL USING (user_id = auth.uid());

-- DEPARTMENT TRAINING RULES
ALTER TABLE department_training_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_dept_rules_all" ON department_training_rules FOR ALL USING (auth.user_role() = 'admin' AND organization_id = auth.user_org_id());
CREATE POLICY "staff_dept_rules_select" ON department_training_rules FOR SELECT USING (organization_id = auth.user_org_id());

-- PAYMENTS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_payments_all" ON payments FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_payments_select" ON payments FOR SELECT USING (organization_id = auth.user_org_id());

-- INVOICES
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "super_admin_invoices_all" ON invoices FOR ALL USING (auth.user_role() = 'super_admin');
CREATE POLICY "admin_invoices_select" ON invoices FOR SELECT USING (organization_id = auth.user_org_id());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
