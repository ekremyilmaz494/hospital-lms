import { MediaConvertClient, CreateJobCommand, DescribeEndpointsCommand } from '@aws-sdk/client-mediaconvert'

const REGION = process.env.AWS_REGION || 'eu-central-1'
const MEDIACONVERT_ROLE_ARN = process.env.MEDIACONVERT_ROLE_ARN
const WEBHOOK_URL = process.env.WEBHOOK_URL
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

let cachedEndpoint = null

async function getEndpoint() {
  if (cachedEndpoint) return cachedEndpoint
  const probe = new MediaConvertClient({ region: REGION })
  const res = await probe.send(new DescribeEndpointsCommand({}))
  cachedEndpoint = res.Endpoints?.[0]?.Url
  if (!cachedEndpoint) throw new Error('MediaConvert endpoint not found')
  return cachedEndpoint
}

function buildJobSettings(bucket, inputKey, outputKeyPrefix) {
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

    const endpoint = await getEndpoint()
    const mc = new MediaConvertClient({ region: REGION, endpoint })

    const settings = buildJobSettings(bucket, inputKey, outputKeyPrefix)

    const job = await mc.send(new CreateJobCommand({
      Role: MEDIACONVERT_ROLE_ARN,
      Settings: settings,
      UserMetadata: {
        bucket,
        sourceKey: inputKey,
        outputKey: `${outputKeyPrefix}_720p.mp4`,
        webhookUrl: WEBHOOK_URL || '',
      },
      StatusUpdateInterval: 'SECONDS_60',
    }))

    console.log(`Created MediaConvert job ${job.Job?.Id} for ${inputKey}`)
    results.push({ jobId: job.Job?.Id, sourceKey: inputKey })
  }

  return { statusCode: 200, results }
}
