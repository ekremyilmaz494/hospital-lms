/**
 * AI İçerik Stüdyosu için Zod şemaları.
 * Ana validations.ts'tan ayrı tutuldu — modülerlik + import zinciri sade kalsın.
 */
import { z } from 'zod/v4'
import {
  AI_ARTIFACT_TYPES,
  AI_MAX_PROMPT_LEN,
  AI_MAX_SOURCE_FILES,
  AI_MAX_SOURCE_URLS,
  AI_MAX_SOURCE_SIZE_MB,
} from './constants'

const MAX_SOURCE_SIZE_BYTES = AI_MAX_SOURCE_SIZE_MB * 1024 * 1024

export const aiArtifactTypeSchema = z.enum(AI_ARTIFACT_TYPES)

/** NotebookLM Google hesabı bağlama isteği — storage_state.json içeriği */
export const aiAccountConnectSchema = z.object({
  // notebooklm-py storage_state.json — JSON string olarak yapıştırılır.
  // Playwright storage state formatı: { cookies: [...], origins: [...] }
  storageStateJson: z
    .string()
    .min(100, 'storage_state.json çok kısa görünüyor — geçerli bir Playwright session değil.')
    .max(500_000, 'storage_state.json çok büyük (>500KB) — beklenmedik.')
    .refine((val) => {
      try {
        const parsed = JSON.parse(val)
        return Array.isArray(parsed?.cookies) && Array.isArray(parsed?.origins)
      } catch {
        return false
      }
    }, 'Geçersiz storage_state formatı. notebooklm login komutu çıktısını yapıştırdığınızdan emin olun.'),
})

export const aiSourceFileMetaSchema = z.object({
  s3Key: z.string().min(1).max(500),
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_SOURCE_SIZE_BYTES),
  mimeType: z.string().max(100),
})

/** Generation üretim isteği */
export const aiGenerateSchema = z
  .object({
    artifactType: aiArtifactTypeSchema,
    prompt: z.string().max(AI_MAX_PROMPT_LEN).optional().nullable(),
    sourceFiles: z.array(aiSourceFileMetaSchema).max(AI_MAX_SOURCE_FILES).default([]),
    sourceUrls: z.array(z.url()).max(AI_MAX_SOURCE_URLS).default([]),
    options: z.record(z.string(), z.string()).default({}),
    language: z
      .string()
      .regex(/^[a-zA-Z_]{2,10}$/)
      .default('tr'),
  })
  .refine(
    (data) =>
      (data.prompt && data.prompt.trim().length > 0) ||
      data.sourceFiles.length > 0 ||
      data.sourceUrls.length > 0,
    { message: 'En az bir kaynak (dosya/URL) veya prompt belirtilmelidir.' },
  )

/** Kaynak dosya yükleme presign isteği */
export const aiSourcePresignSchema = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_SOURCE_SIZE_BYTES),
  mimeType: z.string().min(1).max(100),
})
