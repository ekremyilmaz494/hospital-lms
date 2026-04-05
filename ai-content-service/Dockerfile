FROM python:3.11-slim

WORKDIR /app

# Playwright sistem bağımlılıkları
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install chromium

COPY . .

RUN mkdir -p temp auth_store browser_profiles

ENV NODE_ENV=production

EXPOSE 8100

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1"]
