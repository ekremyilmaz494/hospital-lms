-- Seed global SKS (Saglikta Kalite Standartlari) denetim hazirlik standartlari.
-- organization_id NULL: tum kurumlara gorunen kilitli/resmi standartlar.
INSERT INTO "accreditation_standards" (
  "id", "code", "title", "description", "standard_body", "required_training_categories", "required_completion_rate"
)
VALUES
  (gen_random_uuid(), 'SKS.EY.01', 'Egitim Yonetimi ve Zorunlu Egitimler', 'Calisanlarin gorev alanina uygun zorunlu egitimleri tamamlamasi izlenmelidir.', 'SKS', '["genel","hasta-haklari"]'::jsonb, 90),
  (gen_random_uuid(), 'SKS.ENF.01', 'Enfeksiyonlarin Onlenmesi', 'El hijyeni, izolasyon onlemleri ve enfeksiyon kontrol egitimleri tamamlanmalidir.', 'SKS', '["enfeksiyon"]'::jsonb, 90),
  (gen_random_uuid(), 'SKS.ADY.01', 'Acil Durum ve Afet Yonetimi', 'Afet, yangin ve acil durum sureclerine yonelik egitimler tamamlanmalidir.', 'SKS', '["acil","is-guvenligi"]'::jsonb, 85),
  (gen_random_uuid(), 'SKS.CGY.01', 'Calisan Sagligi ve Guvenligi', 'Calisan sagligi, is guvenligi ve risk azaltma egitimleri izlenmelidir.', 'SKS', '["is-guvenligi"]'::jsonb, 85),
  (gen_random_uuid(), 'SKS.HHD.01', 'Hasta Haklari ve Hasta Guvenligi', 'Hasta haklari, iletisim ve hasta guvenligi egitimleri tamamlanmalidir.', 'SKS', '["hasta-haklari","genel"]'::jsonb, 90)
ON CONFLICT DO NOTHING;