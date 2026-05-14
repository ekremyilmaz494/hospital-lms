-- Devakent doğrulama: formlar + yanıt snapshot kodları
-- prisma db execute SELECT çıktısı basmaz; bu yüzden RAISE NOTICE ile log'la
DO $$
DECLARE
  org_id uuid;
  rec record;
  snap_count int;
BEGIN
  SELECT id INTO org_id FROM organizations
   WHERE LOWER(name) LIKE '%devakent%' LIMIT 1;

  RAISE NOTICE '◐ Devakent org_id=%', org_id;

  RAISE NOTICE '— Eğitimler:';
  FOR rec IN
    SELECT title, instructor_name, publish_status
      FROM trainings
     WHERE organization_id = org_id
     ORDER BY created_at
  LOOP
    RAISE NOTICE '  • [%]  "%s"  eğitmen=%',
      rec.publish_status, rec.title, COALESCE(rec.instructor_name, '(boş)');
  END LOOP;

  RAISE NOTICE '— Feedback formları:';
  FOR rec IN
    SELECT title, document_code, is_active, is_archived
      FROM training_feedback_forms
     WHERE organization_id = org_id
     ORDER BY created_at
  LOOP
    RAISE NOTICE '  • [%]  "%s"  active=%  archived=%',
      rec.document_code, rec.title, rec.is_active, rec.is_archived;
  END LOOP;

  SELECT COUNT(*) INTO snap_count
    FROM training_feedback_responses
   WHERE organization_id = org_id
     AND form_snapshot::jsonb->>'documentCode' = 'EY.FR.40';
  RAISE NOTICE '— Snapshot''ı hâlâ EY.FR.40 olan yanıt sayısı: %', snap_count;

  SELECT COUNT(*) INTO snap_count
    FROM training_feedback_responses
   WHERE organization_id = org_id
     AND form_snapshot::jsonb->>'documentCode' = 'EY.FR.03';
  RAISE NOTICE '— Snapshot''ı EY.FR.03 olan yanıt sayısı: %', snap_count;
END $$;
