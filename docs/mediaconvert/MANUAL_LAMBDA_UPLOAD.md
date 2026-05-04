# Lambda Manuel Upload (AWS CLI yoksa)

`deploy.ps1` AWS CLI gerektirir. CLI yoksa Console'dan manuel deploy edebilirsin.

## Hazırlık — ZIP oluştur

PowerShell'de:

```powershell
# Trigger Lambda
cd 'C:\Users\pc\Desktop\Yeni klasör\hospital-lms\lambda\video-transcoder'
npm install --omit=dev --no-package-lock
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath ..\video-transcoder.zip -Force

# Completion Lambda
cd ..\video-completion
npm install --omit=dev --no-package-lock
Compress-Archive -Path index.mjs,package.json,node_modules -DestinationPath ..\video-completion.zip -Force
```

İki ZIP oluşur: `lambda/video-transcoder.zip` ve `lambda/video-completion.zip`

## 1) Trigger Lambda — hospital-lms-video-transcoder

AWS Console → Lambda → Functions → **Create function**:

- **Function name:** `hospital-lms-video-transcoder`
- **Runtime:** Node.js 20.x
- **Architecture:** x86_64
- **Permissions** → **Use an existing role:** `LambdaVideoTranscoderRole`
- **Create function**

Açılan fonksiyon sayfasında:

1. **Code** sekmesi → **Upload from ▾** → **.zip file** → `video-transcoder.zip` seç → **Save**
2. **Configuration** sekmesi → **General configuration** → **Edit:**
   - **Memory:** 256 MB
   - **Timeout:** 1 min 0 sec
   - **Save**
3. **Configuration** → **Environment variables** → **Edit** → **Add environment variable:**
   - Key: `MEDIACONVERT_ROLE_ARN`
   - Value: `arn:aws:iam::210806259402:role/MediaConvertHospitalLMSRole`
   - **Save**

## 2) Completion Lambda — hospital-lms-video-completion

Aynı adımlar:

- **Function name:** `hospital-lms-video-completion`
- **Runtime:** Node.js 20.x
- **Permissions:** existing role `LambdaVideoTranscoderRole`
- **Create function**

Sonra:
1. **Code** → Upload `video-completion.zip` → **Save**
2. **Configuration** → **General** → Memory 256, Timeout 1 min
3. **Configuration** → **Environment variables** — 3 değişken ekle:
   - `SUPABASE_URL` = `https://pkkkyyajfmusurcoovwt.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY` = (Vercel env'inden kopyala)
   - `CLOUDFRONT_DOMAIN` = (CloudFront distribution domain'in)

## 3) S3 Event Notification

S3 Console → `hospital-lms-videos` bucket → **Properties** sekmesi → **Event notifications** → **Create event notification**:

- **Event name:** `videos-uploaded-trigger-transcode`
- **Prefix:** `videos/`
- **Suffix:** (boş)
- **Event types:** ✅ **All object create events** (`s3:ObjectCreated:*`)
- **Destination:** Lambda function
- **Specify Lambda function:** `hospital-lms-video-transcoder`
- **Save changes**

AWS izin sorabilir → "Add permission" onayla.

## 4) EventBridge Rule

EventBridge Console → **Rules** → **Create rule**:

- **Name:** `mediaconvert-job-complete`
- **Event bus:** default
- **Rule type:** Rule with an event pattern
- **Next**

Event source:
- **AWS events or EventBridge partner events**
- **Method:** Use pattern form
- **Event source:** AWS services
- **AWS service:** Elemental MediaConvert
- **Event type:** MediaConvert Job State Change
- **Specific status(es):** ✅ COMPLETE

Veya direkt JSON ile:
```json
{
  "source": ["aws.mediaconvert"],
  "detail-type": ["MediaConvert Job State Change"],
  "detail": { "status": ["COMPLETE"] }
}
```

- **Next** → **Target:** AWS service → **Lambda function** → `hospital-lms-video-completion`
- **Next**, **Next**, **Create rule**

## 5) Test

Admin panelinden bir test eğitim oluştur, ~50 MB video yükle.

CloudWatch Logs:
- `/aws/lambda/hospital-lms-video-transcoder` — `Created MediaConvert job` görmelisin
- 1-5 dk sonra `/aws/lambda/hospital-lms-video-completion` — `DB updated` ve `Deleted original` görmelisin

S3 bucket'ta `videos/.../uuid_720p.mp4` yeni dosya, orijinal silinmiş olmalı.
