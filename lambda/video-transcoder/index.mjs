import { MediaConvertClient, CreateJobCommand, DescribeEndpointsCommand } from '@aws-sdk/client-mediaconvert'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const REGION = process.env.AWS_REGION || 'eu-central-1'
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN
const WEBHOOK_URL = process.env.WEBHOOK_URL
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

let cachedEndpoint = null

const s3 = new S3Client({ region: REGION })

async function getEndpoint() {
  if (cachedEndpoint) return cachedEndpoint
  const probe = new MediaConvertClient({ region: REGION })
  const res = await probe.send(new DescribeEndpointsCommand({}))
  cachedEndpoint = res.Endpoints?.[0]?.Url
  if (!cachedEndpoint) throw new Error('MediaConvert endpoint not found')
  return cachedEndpoint
}

function buildJobSettings(bucket, inputKey, outputKeyPrefix, audioKeyPrefix) {
  return {
    Inputs: [{
      FileInput: `s3://${bucket}/${inputKey}`,
      AudioSelectors: { 'Audio Selector 1': { DefaultSelection: 'DEFAULT' } },
      VideoSelector: {},
      TimecodeSource: 'ZEROBASED',
    }],
    OutputGroups: [{
      Name: 'File Group',
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: { Destination: `s3://${bucket}/${outputKeyPrefix}` },
      },
      Outputs: [{
        ContainerSettings: {
          Container: 'MP4',
          Mp4Settings: { MoovPlacement: 'PROGRESSIVE_DOWNLOAD' },
        },
        VideoDescription: {
          Width: 1280,
          Height: 720,
          ScalingBehavior: 'DEFAULT',
          CodecSettings: {
            Codec: 'H_264',
            H264Settings: {
              RateControlMode: 'QVBR',
              QvbrSettings: { QvbrQualityLevel: 7 },
              MaxBitrate: 1500000,
              FramerateControl: 'INITIALIZE_FROM_SOURCE',
              GopSize: 90,
              CodecProfile: 'MAIN',
              CodecLevel: 'AUTO',
              SceneChangeDetect: 'TRANSITION_DETECTION',
            },
          },
        },
        AudioDescriptions: [{
          AudioSourceName: 'Audio Selector 1',
          CodecSettings: {
            Codec: 'AAC',
            AacSettings: { Bitrate: 128000, CodingMode: 'CODING_MODE_2_0', SampleRate: 48000 },
          },
        }],
        NameModifier: '_720p',
      }],
    }, {
      // Transkripsiyon için ses çıktısı — video-transcribe Lambda bu MP3'ü
      // OpenRouter/Gemini'ye gönderir. CBR ZORUNLU: chunk'lama byte-range ile
      // yapılır (32kbps CBR = 4.000 byte/sn), VBR süre hesabını bozar.
      // DİKKAT: Bu grup 2. SIRADA kalmalı — video-completion Lambda süreyi
      // outputGroupDetails[0]'dan okur (index 0 = 720p grubu).
      Name: 'Transcript Audio',
      OutputGroupSettings: {
        Type: 'FILE_GROUP_SETTINGS',
        FileGroupSettings: { Destination: `s3://${bucket}/${audioKeyPrefix}` },
      },
      Outputs: [{
        ContainerSettings: { Container: 'RAW' },
        AudioDescriptions: [{
          AudioSourceName: 'Audio Selector 1',
          CodecSettings: {
            Codec: 'MP3',
            Mp3Settings: { Bitrate: 32000, Channels: 1, RateControlMode: 'CBR', SampleRate: 22050 },
          },
        }],
      }],
    }],
    TimecodeConfig: { Source: 'ZEROBASED' },
  }
}

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event))

  if (!MEDIACONVERT_ROLE_ARN) throw new Error('MEDIACONVERT_ROLE_ARN env var not set')

  const results = []

  for (const record of event.Records || []) {
    const bucket = record.s3?.bucket?.name
    const rawKey = record.s3?.object?.key
    if (!bucket || !rawKey) continue

    const inputKey = decodeURIComponent(rawKey.replace(/\+/g, ' '))

    if (!inputKey.startsWith('videos/')) {
      console.log(`Skip non-video key: ${inputKey}`)
      continue
    }
    if (inputKey.includes('_720p.mp4') || inputKey.endsWith('.transcoded')) {
      console.log(`Skip already-transcoded: ${inputKey}`)
      continue
    }
    const ext = inputKey.split('.').pop()?.toLowerCase()
    if (!['mp4', 'mov', 'webm', 'mkv', 'avi', 'ogg'].includes(ext)) {
      console.log(`Skip non-video extension: ${ext}`)
      continue
    }

    const baseKey = inputKey.replace(/\.[^.]+$/, '')
    const outputKeyPrefix = `${baseKey}`
    // Transkript ses/metin key ailesi videoKey'den deterministik türetilir:
    // videos/{org}/{seg}/{uuid}.mp4 -> transcripts/{org}/{seg}/{uuid}.(mp3|txt|queued|failed)
    // transcripts/ prefix'i S3 'videos/' event bildirimini tekrar TETİKLEYEMEZ.
    const audioKeyPrefix = baseKey.replace(/^videos\//, 'transcripts/')

    const endpoint = await getEndpoint()
    const mc = new MediaConvertClient({ region: REGION, endpoint })

    const settings = buildJobSettings(bucket, inputKey, outputKeyPrefix, audioKeyPrefix)

    const job = await mc.send(new CreateJobCommand({
      Role: MEDIACONVERT_ROLE_ARN,
      Settings: settings,
      UserMetadata: {
        bucket,
        sourceKey: inputKey,
        outputKey: `${outputKeyPrefix}_720p.mp4`,
        audioKey: `${audioKeyPrefix}.mp3`,
        webhookUrl: WEBHOOK_URL || '',
      },
      StatusUpdateInterval: 'SECONDS_60',
    }))

    console.log(`Created MediaConvert job ${job.Job?.Id} for ${inputKey}`)

    // .queued marker'ı: UI "Hazırlanıyor" durumunu S3'ten çözebilsin diye
    // (draft videolarda DB satırı yok). Best-effort — marker yazılamazsa
    // transkripsiyon yine çalışır, sadece ara durum 'none' görünür.
    try {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${audioKeyPrefix}.queued`,
        Body: '',
        ServerSideEncryption: 'AES256',
      }))
    } catch (err) {
      console.error(`Failed to write queued marker for ${audioKeyPrefix}:`, err)
    }

    results.push({ jobId: job.Job?.Id, sourceKey: inputKey })
  }

  return { statusCode: 200, results }
}
