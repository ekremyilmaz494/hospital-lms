#!/usr/bin/env bash
set -euo pipefail
file=$(jq -r '.tool_input.file_path // .tool_input.path // ""')

protected=(
  ".env"
  ".env.*"
  ".env.local"
  ".env.production"
  ".git/*"
  "pnpm-lock.yaml"
  "package-lock.json"
  "cf-private.pem"
  "cf-public.pem"
  "*.pem"
  "*.key"
  "supabase-rls.sql"
  "scripts/secret-scanner.js"
)

for pattern in "${protected[@]}"; do
  regex="^${pattern//\*/.*}$"
  if echo "$file" | grep -qiE "$regex"; then
    echo "ENGELLENDI: '$file' korumali dosya. Bu dosyayi duzenlemek icin nedenini acikla." >&2
    exit 2
  fi
done
exit 0
