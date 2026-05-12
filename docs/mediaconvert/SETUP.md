# AWS MediaConvert — Otomatik Video Sıkıştırma Pipeline

Admin video yüklediğinde otomatik olarak 720p H.264 formatına sıkıştırılır.
Hedef: CloudFront bandwidth maliyetini %80-95 düşürmek.

> **Not:** Client-side ffmpeg.wasm sıkıştırması kaldırıldı. Tüm transcoding bu pipeline'da
> (MediaConvert) yapılır — orijinal dosya buradaki job tamamlanınca silinir.

## Mimari

```
Admin video yükler
    │
    ▼
S3: videos/{org}/{training}/{uuid}.mp4   ← orijinal (büyük)
    │
    ▼ (S3 event notification)
Lambda: hospital-lms-video-transcoder
    │
    ▼ (CreateJob API)
MediaConvert: 720p H.264 + AAC encode
    │
    ▼ (EventBridge: Job COMPLETE event)
Lambda: hospital-lms-video-completion
    │
    ├─ Supabase REST: training_videos.video_key + file_size_bytes update
    └─ S3: orijinal dosyayı sil

Sonuç: videos/{org}/{training}/{uuid}_720p.mp4 (sıkıştırılmış)
```

## Ön gereksinimler

- AWS hesap Paid Plan'da olmalı (Free Plan'da MediaConvert kapalı)
- S3 bucket: `hospital-lms-videos` (eu-central-1)
- AWS CLI yüklü ve `aws configure` ile login olunmuş
- PowerShell 5.1+

## Kurulum

### 1) MediaConvert IAM Role

AWS Console → IAM → Roles → Create role:
- Trusted entity: AWS service → MediaConvert
- Permissions: AWS managed policy (otomatik)
- Role name: `MediaConvertHospitalLMSRole`
- Create

ARN'ı kopyala — `arn:aws:iam::210806259402:role/MediaConvertHospitalLMSRole`

### 2) Lambda Execution Role

AWS Console → IAM → Roles → Create role:
- Trusted entity: AWS service → Lambda
- Permissions:
  - `AWSLambdaBasicExecutionRole` (managed)
  - Inline policy `LambdaTranscodeAccess`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::hospital-lms-videos/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "mediaconvert:CreateJob",
        "mediaconvert:DescribeEndpoints",
        "mediaconvert:GetJob"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": "arn:aws:iam::210806259402:role/MediaConvertHospitalLMSRole"
    }
  ]
}
```

- Role name: `LambdaVideoTranscoderRole`
- Create, ARN'ı kopyala

### 3) Lambda Deploy

PowerShell'de proje köküne git, çalıştır:

```powershell
.\lambda\deploy.ps1 `
  -MediaConvertRoleArn 'arn:aws:iam::210806259402:role/MediaConvertHospitalLMSRole' `
  -LambdaExecRoleArn 'arn:aws:iam::210806259402:role/LambdaVideoTranscoderRole' `
  -SupabaseUrl 'https://pkkkyyajfmusurcoovwt.supabase.co' `
  -SupabaseServiceRoleKey '<service_role_key_buraya>' `
  -CloudfrontDomain '<cloudfront_domain_buraya>'
```

Bu komut iki Lambda'yı build eder ve deploy eder.

### 4) S3 Event Notification

AWS Console → S3 → `hospital-lms-videos` → Properties → Event notifications → Create:
- Event name: `videos-uploaded`
- Prefix: `videos/`
- Suffix: (boş bırak — birden fazla extension destekleniyor)
- Event types: `s3:ObjectCreated:*`
- Destination: Lambda function → `hospital-lms-video-transcoder`

### 5) EventBridge Rule

AWS Console → EventBridge → Rules → Create rule:
- Name: `mediaconvert-job-complete`
- Event bus: default
- Rule type: Rule with an event pattern
- Event source: AWS services
- AWS service: MediaConvert
- Event type: MediaConvert Job State Change
- Specific state: COMPLETE
- Target: Lambda → `hospital-lms-video-completion`

Event pattern (otomatik üretilir):
```json
{
  "source": ["aws.mediaconvert"],
  "detail-type": ["MediaConvert Job State Change"],
  "detail": { "status": ["COMPLETE"] }
}
```

## Test

1. Admin panelinden bir test eğitim oluştur, ~50 MB video yükle
2. Lambda CloudWatch logs: `/aws/lambda/hospital-lms-video-transcoder` — `Created MediaConvert job ...` görmelisin
3. MediaConvert Console → Jobs → job devam ediyor olmalı (1-5 dk)
4. Tamamlanınca `/aws/lambda/hospital-lms-video-completion` log'unda `DB updated` ve `Deleted original` görmelisin
5. S3 bucket: orijinal silinmiş, `*_720p.mp4` yeni dosya var
6. Supabase `training_videos`: `video_key` ve `file_size_bytes` güncel
7. Frontend: video oynatma çalışıyor (CloudFront URL yeni key'i çözebilmeli)

## Maliyet kontrolü

- MediaConvert: ~$0.0150/dk HD output (Basic tier, eu-central-1)
- 100 eğitim/yıl × 30 dk = $45/yıl
- Lambda: free tier içinde
- EventBridge: free tier içinde
- S3 PUT/DELETE: önemsiz

## Sorun giderme

| Belirti | Neden | Çözüm |
|---|---|---|
| Lambda tetiklenmiyor | S3 event yok | Bucket Properties → Event notifications kontrol |
| MediaConvert "AccessDenied" | IAM rolü eksik | MediaConvertHospitalLMSRole'e S3 read/write permission ekle |
| Completion Lambda Supabase 401 | Service role key yanlış | Lambda env var SUPABASE_SERVICE_ROLE_KEY güncelle |
| Job COMPLETE ama DB güncellenmiyor | EventBridge rule yok / yanlış | EventBridge → Rules listesinde aktif olmalı |
| Sonsuz transcode döngüsü | `_720p` çıktısı tekrar tetikliyor | Trigger Lambda'da `_720p.mp4` filtresi var, kontrol et |
| Orijinal silinmiyor | Lambda IAM s3:DeleteObject izni yok | Lambda role'üne ekle |

## Geri alma

Pipeline'ı kapatmak için:
1. S3 event notification'ı sil
2. EventBridge rule'u disable et
3. (Lambda'lar dursun, tetikleyen yok)
