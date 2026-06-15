import { describe, it, expect, vi } from 'vitest';

// s3.ts modül-yüklemede @/lib/prisma'yı import ediyor (checkStorageQuota DB
// sorgusu için). documentKey saf bir fonksiyon — gerçek prisma client'a gerek
// yok; stub'la ki test DATABASE_URL olmadan da çalışsın.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { documentKey } from '@/lib/s3';

/**
 * AI soru üretimi kaynak yükleme regresyon testi.
 *
 * Bug: documentKey yalnızca ['pdf','pptx'] kabul ediyordu → Word (.docx) ve
 * Excel (.xlsx) yüklemesi "İzin verilmeyen dosya türü/uzantısı" ile reddediliyordu;
 * oysa client (ai-question-generator) ve getUploadUrl MIME allowlist'i bunlara
 * izin veriyordu (katmanlar-arası tutarsız allowlist). Bu test 4 formatı da korur.
 */
describe('documentKey — AI kaynak dosya uzantıları', () => {
  const orgId = 'org-1';
  const tid = 'drafts';

  it.each(['pdf', 'pptx', 'docx', 'xlsx'])('%s uzantısını kabul eder', (ext) => {
    const key = documentKey(orgId, tid, `kaynak.${ext}`);
    expect(key).toMatch(new RegExp(`^documents/${orgId}/${tid}/[0-9a-f-]+\\.${ext}$`));
  });

  it.each(['exe', 'zip', 'doc', 'txt'])('%s gibi desteklenmeyen uzantıyı reddeder', (ext) => {
    expect(() => documentKey(orgId, tid, `kaynak.${ext}`)).toThrow(/İzin verilmeyen dosya uzantısı/);
  });
});
