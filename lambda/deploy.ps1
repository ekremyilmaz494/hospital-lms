param(
  [string]$Region = 'eu-central-1',
  [string]$AccountId = '210806259402',
  [string]$Bucket = 'hospital-lms-videos',
  [string]$MediaConvertRoleArn,
  [string]$LambdaExecRoleArn,
  [string]$SupabaseUrl,
  [string]$SupabaseServiceRoleKey,
  [string]$CloudfrontDomain,
  [string]$OpenRouterApiKey
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Build-And-Zip([string]$LambdaDir) {
  Push-Location $LambdaDir
  try {
    Write-Host "Installing deps in $LambdaDir..."
    npm install --omit=dev --no-package-lock 2>&1 | Out-Null

    $zipPath = Join-Path $ScriptDir ((Split-Path $LambdaDir -Leaf) + '.zip')
    if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

    Write-Host "Zipping to $zipPath..."
    Compress-Archive -Path @('index.mjs', 'package.json', 'node_modules') -DestinationPath $zipPath -Force
    return $zipPath
  } finally {
    Pop-Location
  }
}

function Create-Or-Update-Lambda {
  param(
    [string]$Name,
    [string]$ZipPath,
    [string]$RoleArn,
    [hashtable]$EnvVars,
    [int]$Timeout = 60,
    [int]$MemorySize = 256
  )

  $envJson = ($EnvVars.GetEnumerator() | ForEach-Object { "`"$($_.Key)`":`"$($_.Value)`"" }) -join ','
  $envArg = "Variables={$envJson}"

  Write-Host "Checking if Lambda $Name exists..."
  $exists = $true
  try {
    aws lambda get-function --function-name $Name --region $Region 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { $exists = $false }
  } catch { $exists = $false }

  if ($exists) {
    Write-Host "Updating existing Lambda $Name..."
    aws lambda update-function-code --function-name $Name --zip-file "fileb://$ZipPath" --region $Region | Out-Null
    Start-Sleep -Seconds 3
    aws lambda update-function-configuration --function-name $Name --environment $envArg --timeout $Timeout --memory-size $MemorySize --region $Region | Out-Null
  } else {
    Write-Host "Creating new Lambda $Name..."
    aws lambda create-function `
      --function-name $Name `
      --runtime nodejs20.x `
      --role $RoleArn `
      --handler index.handler `
      --zip-file "fileb://$ZipPath" `
      --timeout $Timeout `
      --memory-size $MemorySize `
      --environment $envArg `
      --region $Region | Out-Null
  }
}

if (-not $MediaConvertRoleArn) { throw 'MediaConvertRoleArn parameter required' }
if (-not $LambdaExecRoleArn) { throw 'LambdaExecRoleArn parameter required' }
if (-not $SupabaseUrl) { throw 'SupabaseUrl parameter required' }
if (-not $SupabaseServiceRoleKey) { throw 'SupabaseServiceRoleKey parameter required' }
if (-not $OpenRouterApiKey) { throw 'OpenRouterApiKey parameter required (video-transcribe Lambda icin)' }

Write-Host "=== Building trigger Lambda ==="
$triggerZip = Build-And-Zip (Join-Path $ScriptDir 'video-transcoder')

Write-Host "=== Building completion Lambda ==="
$completionZip = Build-And-Zip (Join-Path $ScriptDir 'video-completion')

Write-Host "=== Building transcribe Lambda ==="
$transcribeZip = Build-And-Zip (Join-Path $ScriptDir 'video-transcribe')

Write-Host "=== Deploying trigger Lambda ==="
Create-Or-Update-Lambda `
  -Name 'hospital-lms-video-transcoder' `
  -ZipPath $triggerZip `
  -RoleArn $LambdaExecRoleArn `
  -EnvVars @{ MEDIACONVERT_ROLE_ARN = $MediaConvertRoleArn }

Write-Host "=== Deploying completion Lambda ==="
$completionEnv = @{
  SUPABASE_URL = $SupabaseUrl
  SUPABASE_SERVICE_ROLE_KEY = $SupabaseServiceRoleKey
}
if ($CloudfrontDomain) { $completionEnv.CLOUDFRONT_DOMAIN = $CloudfrontDomain }
Create-Or-Update-Lambda `
  -Name 'hospital-lms-video-completion' `
  -ZipPath $completionZip `
  -RoleArn $LambdaExecRoleArn `
  -EnvVars $completionEnv

Write-Host "=== Deploying transcribe Lambda ==="
# Timeout 600s: chunk basina OpenRouter cagrisi dakikalar surebilir (uzun videolar).
Create-Or-Update-Lambda `
  -Name 'hospital-lms-video-transcribe' `
  -ZipPath $transcribeZip `
  -RoleArn $LambdaExecRoleArn `
  -Timeout 600 `
  -MemorySize 512 `
  -EnvVars @{
    OPENROUTER_API_KEY = $OpenRouterApiKey
    SUPABASE_URL = $SupabaseUrl
    SUPABASE_SERVICE_ROLE_KEY = $SupabaseServiceRoleKey
  }

Write-Host ""
Write-Host "=== DEPLOY COMPLETE ==="
Write-Host "Next steps (manual in AWS Console):"
Write-Host "1. Add S3 event notification on bucket '$Bucket' for prefix 'videos/' -> trigger 'hospital-lms-video-transcoder'"
Write-Host "2. Create EventBridge rule 'mediaconvert-complete' that matches:"
Write-Host "   { source: ['aws.mediaconvert'], detail-type: ['MediaConvert Job State Change'], detail: { status: ['COMPLETE'] } }"
Write-Host "   Target: hospital-lms-video-completion Lambda"
Write-Host "3. Add 'hospital-lms-video-transcribe' as a SECOND target on the same 'mediaconvert-complete' rule"
Write-Host "   (+ aws lambda add-permission --function-name hospital-lms-video-transcribe --principal events.amazonaws.com ...)"
Write-Host "4. IAM: grant transcoder exec role s3:PutObject on '$Bucket/transcripts/*';"
Write-Host "   grant transcribe exec role s3:GetObject/PutObject/DeleteObject on '$Bucket/transcripts/*'"
