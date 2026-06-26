import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getStreamUrlMock, loggerMock } = vi.hoisted(() => ({
  getStreamUrlMock: vi.fn(),
  loggerMock: { error: vi.fn() },
}));

vi.mock('@/lib/s3', () => ({ getStreamUrl: getStreamUrlMock }));
vi.mock('@/lib/logger', () => ({ logger: loggerMock }));

import { resolveMediaAssetUrl } from '../media-asset-url';

describe('resolveMediaAssetUrl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('s3Key varsa → signed URL döner', async () => {
    getStreamUrlMock.mockResolvedValue('https://cdn.example/file.mp4?Signature=abc');
    const url = await resolveMediaAssetUrl({ id: 'm1', s3Key: 'videos/org/media-library/x.mp4' });
    expect(url).toContain('Signature=');
    expect(getStreamUrlMock).toHaveBeenCalledWith('videos/org/media-library/x.mp4');
  });

  it('getStreamUrl throw → "" (ham key/URL fallback YOK)', async () => {
    getStreamUrlMock.mockRejectedValue(new Error('boom'));
    const url = await resolveMediaAssetUrl({ id: 'm1', s3Key: 'videos/org/media-library/x.mp4' });
    expect(url).toBe('');
    expect(loggerMock.error).toHaveBeenCalled();
  });

  it('s3Key null → "" (getStreamUrl çağrılmaz)', async () => {
    const url = await resolveMediaAssetUrl({ id: 'm1', s3Key: null });
    expect(url).toBe('');
    expect(getStreamUrlMock).not.toHaveBeenCalled();
  });
});
