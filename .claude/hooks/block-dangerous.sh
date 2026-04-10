#!/usr/bin/env bash
set -euo pipefail
cmd=$(jq -r '.tool_input.command // ""')

dangerous_patterns=(
  "rm -rf"
  "git reset --hard"
  "git push.*--force"
  "DROP TABLE"
  "DROP DATABASE"
  "TRUNCATE"
  "curl.*|.*sh"
  "wget.*|.*bash"
  "prisma migrate reset"
  "prisma db push --force-reset"
)

for pattern in "${dangerous_patterns[@]}"; do
  if echo "$cmd" | grep -qiE "$pattern"; then
    echo "ENGELLENDI: '$cmd' tehlikeli komut '$pattern' ile eslesti. Daha guvenli bir alternatif oner." >&2
    exit 2
  fi
done
exit 0
