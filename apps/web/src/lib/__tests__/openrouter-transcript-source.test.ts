import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * generateQuestions — video transkripti kaynak dalı.
 *
 * Transkript (transcripts/{org}/{seg}/{uuid}.txt, text/plain) PDF/office gibi
 * sunucuda okunup <source type="Video Transkripti"> bloğuna gömülür. Bu suite:
 *   1. Blok formatı + içerik (model transkripti kaynak olarak görmeli)
 *   2. Boş transkript → anlamlı Türkçe hata (sessiz düşürme yok)
 *   3. Aşırı uzun transkript → PDF_TEXT_MAX_CHARS cap'i (context/maliyet koruması)
 */

const { createMock, s3Mock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  s3Mock: {
    getDownloadUrl: vi.fn().mockResolvedValue('https://s3.example/signed'),
    downloadBuffer: vi.fn(),
  },
}));

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: createMock } };
  },
}));
vi.mock('@/lib/s3', () => s3Mock);
vi.mock('unpdf', () => ({
  getDocumentProxy: vi.fn().mockResolvedValue({}),
  extractText: vi.fn().mockResolvedValue({ totalPages: 1, text: '' }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { generateQuestions, OpenRouterError } from '@/lib/openrouter';

const MODEL = 'anthropic/claude-sonnet-4.6';
const TRANSCRIPT_SOURCE = {
  s3Key: 'transcripts/org-1/drafts/uuid-1.txt',
  mimeType: 'text/plain',
  filename: 'El Hijyeni Eğitimi — transkript',
};

const okResponse = () => ({
  choices: [
    {
      message: {
        content: JSON.stringify({
          questions: [
            {
              questionText: 'El hijyeni hangi durumda zorunludur?',
              options: ['Hasta temasından önce', 'Mola sonrası', 'Ameliyatta', 'Hiçbir zaman'],
              correctIndex: 0,
              sourceQuote: 'Her hasta temasından önce el hijyeni zorunludur.',
            },
          ],
        }),
      },
    },
  ],
});

/** create() çağrısındaki user mesajının text content bloklarını döndürür. */
function userTextBlocks(): string[] {
  const call = createMock.mock.calls[0][0] as {
    messages: { role: string; content: unknown }[];
  };
  const user = call.messages.find((m) => m.role === 'user');
  const parts = user?.content as { type: string; text?: string }[];
  return parts.filter((p) => p.type === 'text').map((p) => p.text ?? '');
}

describe('generateQuestions — transkript kaynağı', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OPENROUTER_API_KEY = 'test-key';
    createMock.mockResolvedValue(okResponse());
  });

  it('transkript metnini <source type="Video Transkripti"> bloğuna gömer', async () => {
    s3Mock.downloadBuffer.mockResolvedValue(
      Buffer.from('El hijyeni beş endikasyonu şunlardır: hasta temasından önce...', 'utf8'),
    );

    const questions = await generateQuestions({
      model: MODEL,
      sources: [TRANSCRIPT_SOURCE],
      count: 5,
    });

    expect(questions).toHaveLength(1);
    expect(s3Mock.downloadBuffer).toHaveBeenCalledWith(TRANSCRIPT_SOURCE.s3Key);

    const blocks = userTextBlocks();
    const sourceBlock = blocks.find((t) => t.includes('type="Video Transkripti"'));
    expect(sourceBlock).toBeDefined();
    expect(sourceBlock).toContain('El Hijyeni Eğitimi — transkript');
    expect(sourceBlock).toContain('El hijyeni beş endikasyonu');
  });

  it('mimeType verilmese bile transcripts/*.txt key ile tanınır', async () => {
    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from('Sterilizasyon adımları...', 'utf8'));

    await generateQuestions({
      model: MODEL,
      sources: [{ s3Key: 'transcripts/org-1/t-1/uuid-2.txt' }],
      count: 3,
    });

    expect(userTextBlocks().some((t) => t.includes('type="Video Transkripti"'))).toBe(true);
  });

  it('boş transkript → OpenRouterError (sessiz düşürme yok)', async () => {
    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from('   \n  ', 'utf8'));

    await expect(
      generateQuestions({ model: MODEL, sources: [TRANSCRIPT_SOURCE], count: 5 }),
    ).rejects.toThrow(OpenRouterError);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('aşırı uzun transkript PDF_TEXT_MAX_CHARS (200K) ile kırpılır', async () => {
    const hugeText = 'a'.repeat(250_000);
    s3Mock.downloadBuffer.mockResolvedValue(Buffer.from(hugeText, 'utf8'));

    await generateQuestions({ model: MODEL, sources: [TRANSCRIPT_SOURCE], count: 5 });

    const sourceBlock = userTextBlocks().find((t) => t.includes('type="Video Transkripti"'));
    expect(sourceBlock).toBeDefined();
    // Wrapper (<source ...> + filename) payı dışında metin 200K'da kesilmiş olmalı.
    expect((sourceBlock as string).length).toBeLessThan(200_000 + 500);
  });
});
