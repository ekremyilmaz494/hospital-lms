#!/usr/bin/env node
/**
 * One-off: upload cax.mp4 to S3 for Devakent radiation-safety training.
 * Parses MP4 mvhd atom for duration, then uploads. Outputs JSON for the
 * follow-up SQL step.
 */
import { readFile, stat, open } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(process.cwd(), '.env.local') })

const VIDEO_PATH = 'C:/Users/pc/Desktop/Yeni klasör/cax.mp4'
const ORG_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'
const TRAINING_ID = process.env.TRAINING_ID || randomUUID()

/**
 * Minimal MP4 atom parser — walks top-level boxes until it finds `moov`,
 * then finds `mvhd` and reads duration / timescale. Works for standard
 * MP4 / QuickTime files where moov sits at the beginning or end.
 */
async function getMp4Duration(path) {
  const fh = await open(path, 'r')
  try {
    const { size } = await fh.stat()
    let offset = 0
    while (offset < size) {
      const header = Buffer.alloc(8)
      await fh.read(header, 0, 8, offset)
      let boxSize = header.readUInt32BE(0)
      const type = header.toString('ascii', 4, 8)
      let headerLen = 8
      if (boxSize === 1) {
        const ext = Buffer.alloc(8)
        await fh.read(ext, 0, 8, offset + 8)
        boxSize = Number(ext.readBigUInt64BE(0))
        headerLen = 16
      }
      if (type === 'moov') {
        // Scan inside moov for mvhd
        const moov = Buffer.alloc(boxSize - headerLen)
        await fh.read(moov, 0, moov.length, offset + headerLen)
        let inner = 0
        while (inner < moov.length) {
          const innerSize = moov.readUInt32BE(inner)
          const innerType = moov.toString('ascii', inner + 4, inner + 8)
          if (innerType === 'mvhd') {
            const version = moov.readUInt8(inner + 8)
            // mvhd layout: version(1) flags(3) ctime ... timescale duration
            let timescale, duration
            if (version === 1) {
              timescale = moov.readUInt32BE(inner + 8 + 4 + 8 + 8)
              duration = Number(moov.readBigUInt64BE(inner + 8 + 4 + 8 + 8 + 4))
            } else {
              timescale = moov.readUInt32BE(inner + 8 + 4 + 4 + 4)
              duration = moov.readUInt32BE(inner + 8 + 4 + 4 + 4 + 4)
            }
            return Math.round(duration / timescale)
          }
          inner += innerSize
          if (innerSize === 0) break
        }
      }
      offset += boxSize
      if (boxSize === 0) break
    }
    throw new Error('mvhd atom not found')
  } finally {
    await fh.close()
  }
}

async function main() {
  const { size: fileSize } = await stat(VIDEO_PATH)
  const duration = await getMp4Duration(VIDEO_PATH)
  const videoId = randomUUID()
  const ext = 'mp4'
  const key = `videos/${ORG_ID}/${TRAINING_ID}/${videoId}.${ext}`

  const s3 = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  })

  const body = await readFile(VIDEO_PATH)
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'video/mp4',
  }))

  console.log(JSON.stringify({
    trainingId: TRAINING_ID,
    videoKey: key,
    durationSeconds: duration,
    fileSizeBytes: fileSize,
    bucket: process.env.AWS_S3_BUCKET,
    region: process.env.AWS_REGION,
  }, null, 2))
}

main().catch((err) => {
  console.error('UPLOAD FAILED:', err)
  process.exit(1)
})
