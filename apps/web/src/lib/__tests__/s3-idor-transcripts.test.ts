import { describe, it, expect, vi } from 'vitest';

// s3.ts modül-yüklemede @/lib/prisma'yı import ediyor (checkStorageQuota DB
// sorgusu için). isValidS3KeyForOrg saf fonksiyon — prisma stub yeterli.
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { isValidS3KeyForOrg } from '@/lib/s3';

/**
 * IDOR guard — transcripts/ prefix regresyonu.
 *
 * AI soru üretim route'ları kaynak s3Key'lerini isValidS3KeyForOrg'dan geçirir.
 * `transcripts/` prefix'i eklenmeden transkript kaynakları reddedilir (özellik
 * çalışmaz); orgId segment kontrolü gevşetilirse başka hastanenin transkripti
 * LLM üzerinden sızdırılabilir. Bu suite iki yönü de sabitler.
 */
describe('isValidS3KeyForOrg — transcripts prefix', () => {
  const ORG = 'org-1';

  it("kendi org'unun transkript key'ini kabul eder", () => {
    expect(isValidS3KeyForOrg(`transcripts/${ORG}/drafts/uuid-1.txt`, ORG)).toBe(true);
    expect(isValidS3KeyForOrg(`transcripts/${ORG}/training-9/uuid-2.txt`, ORG)).toBe(true);
  });

  it("başka org'un transkript key'ini reddeder (cross-tenant sızıntı)", () => {
    expect(isValidS3KeyForOrg('transcripts/org-2/drafts/uuid-1.txt', ORG)).toBe(false);
  });

  it('traversal ve URL şemaları hâlâ reddedilir', () => {
    expect(isValidS3KeyForOrg(`transcripts/${ORG}/../org-2/u.txt`, ORG)).toBe(false);
    expect(isValidS3KeyForOrg(`https://x/transcripts/${ORG}/t/u.txt`, ORG)).toBe(false);
  });

  it('mevcut prefixler etkilenmez, bilinmeyen prefix reddedilir', () => {
    expect(isValidS3KeyForOrg(`videos/${ORG}/t/u.mp4`, ORG)).toBe(true);
    expect(isValidS3KeyForOrg(`documents/${ORG}/t/u.pdf`, ORG)).toBe(true);
    expect(isValidS3KeyForOrg(`audio/${ORG}/t/u.mp3`, ORG)).toBe(true);
    expect(isValidS3KeyForOrg(`backups/${ORG}/t/u.json`, ORG)).toBe(false);
  });
});
