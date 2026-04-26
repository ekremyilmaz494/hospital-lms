# NotebookLM Worker

Hospital LMS'in AI İçerik Stüdyosu için ayrı çalışan worker servisi.
Vercel serverless `notebooklm-py` (Python + Playwright Chromium) çalıştıramadığından
tüm NotebookLM çağrıları bu worker'a HMAC-imzalı HTTP üzerinden forward edilir.

## Lokal geliştirme

```bash
# 1. Lokal Node-only test (mock mode — gerçek notebooklm yok)
npm install
WORKER_HMAC_SECRET=test MOCK_NOTEBOOKLM=1 DATA_DIR=/tmp/nb-data npm run dev

# 2. Docker ile (gerçek notebooklm-py + Chromium)
docker build -t nb-worker .
docker run -p 8080:8080 \
  -e WORKER_HMAC_SECRET=test \
  -v $HOME/.notebooklm-worker-data:/data \
  nb-worker
```

## Hospital LMS env

```bash
NOTEBOOK_WORKER_URL=http://localhost:8080
WORKER_HMAC_SECRET=test  # üretimde: openssl rand -hex 32
```

## Deploy (Fly.io)

```bash
flyctl auth login
flyctl launch --no-deploy   # ilk kez (fly.toml zaten var)
flyctl volumes create notebook_data --size 3 --region fra
flyctl secrets set WORKER_HMAC_SECRET=$(openssl rand -hex 32)
flyctl deploy
```

## Endpoints

| Method | Path | Açıklama |
|---|---|---|
| GET | /healthz | Liveness (HMAC yok) |
| POST | /api/login/storage-state | Per-org `storage_state.json` yaz + verify |
| GET | /api/login/status?orgId=X | Bağlantı durumu + Google email |
| DELETE | /api/login/storage-state?orgId=X | Bağlantıyı kaldır |
| POST | /api/generate | Generation başlat (jobId döner) |
| GET | /api/jobs/:jobId | Job status (status, progress, error, uploadedSize) |

HMAC headers:
- `X-Worker-Timestamp`: unix ms (5 dk skew tolerance)
- `X-Worker-Signature`: hex(hmac256(`${ts}\n${method}\n${path}\n${body}`, secret))
