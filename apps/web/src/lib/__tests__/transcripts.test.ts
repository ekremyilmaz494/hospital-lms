import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Video transkript key türetme + durum çözümü.
 *
 * Türetme kuralı pipeline'ın omurgasıdır: lambda/video-transcoder ve
 * lambda/video-transcribe aynı kuralı .mjs içinde inline uygular — bu suite
 * kuralın web tarafındaki tek doğruluk kaynağıdır (lib/transcripts.ts).
 * Kural bozulursa wizard'daki "Video Transkripti" bölümü draft videolar için
 * transkripti hiç bulamaz (DB satırı yok, tek köprü key türetmesi).
 */

const { s3Mock } = vi.hoisted(() => ({
  s3Mock: {
    verifyS3Object: vi.fn(),
    s3ObjectExists: vi.fn(),
  },
}));

vi.mock('@/lib/s3', () => s3Mock);

import {
  deriveTranscriptBase,
  deriveTranscriptTextKey,
  deriveTranscriptSiblingKeys,
  resolveTranscriptStatus,
} from '@/lib/transcripts';

describe('deriveTranscriptBase / deriveTranscriptTextKey', () => {
  it('ham videoKey → transcripts tabanı (orgId + seg korunur)', () => {
    expect(deriveTranscriptBase('videos/org-1/training-9/abc-123.mp4')).toBe(
      'transcripts/org-1/training-9/abc-123',
    );
  });

  it('_720p transcode çıktısı aynı tabana çözülür (suffix strip)', () => {
    expect(deriveTranscriptBase('videos/org-1/training-9/abc-123_720p.mp4')).toBe(
      'transcripts/org-1/training-9/abc-123',
    );
    // Ham ve _720p key aynı transkripte işaret etmeli — yarış senaryosunun temeli.
    expect(deriveTranscriptTextKey('videos/org-1/training-9/abc-123.mp4')).toBe(
      deriveTranscriptTextKey('videos/org-1/training-9/abc-123_720p.mp4'),
    );
  });

  it("wizard draft key'i (seg='drafts') desteklenir", () => {
    expect(deriveTranscriptTextKey('videos/org-1/drafts/uuid-x.mp4')).toBe(
      'transcripts/org-1/drafts/uuid-x.txt',
    );
  });

  it.each(['mov', 'webm', 'mkv', 'avi', 'ogg'])('.%s uzantısı desteklenir', (ext) => {
    expect(deriveTranscriptBase(`videos/org-1/t-1/u-1.${ext}`)).toBe('transcripts/org-1/t-1/u-1');
  });

  it("video olmayan prefix'ler reddedilir", () => {
    expect(deriveTranscriptBase('documents/org-1/t-1/doc.pdf')).toBeNull();
    expect(deriveTranscriptBase('audio/org-1/t-1/ses.mp3')).toBeNull();
    // transcripts key'inden tekrar türetme yok — sonsuz zincir engellenir.
    expect(deriveTranscriptBase('transcripts/org-1/t-1/u-1.txt')).toBeNull();
  });

  it('path traversal ve URL girdileri reddedilir', () => {
    expect(deriveTranscriptBase('videos/org-1/../org-2/u.mp4')).toBeNull();
    expect(deriveTranscriptBase('https://evil.example/videos/org-1/t/u.mp4')).toBeNull();
    expect(deriveTranscriptBase('')).toBeNull();
  });

  it('segment sayısı uymayan key reddedilir', () => {
    expect(deriveTranscriptBase('videos/org-1/u.mp4')).toBeNull();
    expect(deriveTranscriptBase('videos/org-1/a/b/u.mp4')).toBeNull();
  });
});

describe('deriveTranscriptSiblingKeys', () => {
  it('silme için 4 kardeş key döner (.txt/.mp3/.queued/.failed)', () => {
    expect(deriveTranscriptSiblingKeys('videos/org-1/t-1/u-1_720p.mp4')).toEqual([
      'transcripts/org-1/t-1/u-1.txt',
      'transcripts/org-1/t-1/u-1.mp3',
      'transcripts/org-1/t-1/u-1.queued',
      'transcripts/org-1/t-1/u-1.failed',
    ]);
  });

  it('geçersiz videoKey için boş liste (silme no-op)', () => {
    expect(deriveTranscriptSiblingKeys('documents/org-1/t-1/doc.pdf')).toEqual([]);
  });
});

describe('resolveTranscriptStatus — S3 durum çözümü', () => {
  const KEY = 'videos/org-1/t-1/u-1_720p.mp4';
  const BASE = 'transcripts/org-1/t-1/u-1';

  beforeEach(() => {
    vi.clearAllMocks();
    s3Mock.verifyS3Object.mockResolvedValue(null);
    s3Mock.s3ObjectExists.mockResolvedValue(false);
  });

  it('.txt varsa completed + transcriptKey + boyut', async () => {
    s3Mock.verifyS3Object.mockImplementation(async (key: string) =>
      key === `${BASE}.txt` ? 4321 : null,
    );
    await expect(resolveTranscriptStatus(KEY)).resolves.toEqual({
      status: 'completed',
      transcriptKey: `${BASE}.txt`,
      sizeBytes: 4321,
    });
  });

  it('.failed varsa failed (txt yoksa)', async () => {
    s3Mock.s3ObjectExists.mockImplementation(async (key: string) => key === `${BASE}.failed`);
    await expect(resolveTranscriptStatus(KEY)).resolves.toMatchObject({ status: 'failed' });
  });

  it(".queued marker'ı (0 byte) processing sayılır — s3ObjectExists ile", async () => {
    s3Mock.s3ObjectExists.mockImplementation(async (key: string) => key === `${BASE}.queued`);
    await expect(resolveTranscriptStatus(KEY)).resolves.toMatchObject({ status: 'processing' });
  });

  it('.mp3 varsa (transkripsiyon sürüyor) processing', async () => {
    s3Mock.verifyS3Object.mockImplementation(async (key: string) =>
      key === `${BASE}.mp3` ? 999_000 : null,
    );
    await expect(resolveTranscriptStatus(KEY)).resolves.toMatchObject({ status: 'processing' });
  });

  it('hiçbir dosya yoksa none (özellik-öncesi video)', async () => {
    await expect(resolveTranscriptStatus(KEY)).resolves.toMatchObject({ status: 'none' });
  });

  it("geçersiz videoKey'de S3'e hiç gitmeden none", async () => {
    await expect(resolveTranscriptStatus('documents/org-1/t/d.pdf')).resolves.toMatchObject({
      status: 'none',
    });
    expect(s3Mock.verifyS3Object).not.toHaveBeenCalled();
    expect(s3Mock.s3ObjectExists).not.toHaveBeenCalled();
  });
});
