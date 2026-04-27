#!/usr/bin/env bash
# SessionStart hook — Hospital LMS oturum açıldığında kritik durumu özetler.
# Çıktısı Claude'a context olarak iletilir, kullanıcıya değil.

set -uo pipefail
cd "$(dirname "$0")/../.." || exit 0

echo "## Hospital LMS — Oturum Bağlamı"
echo

# Branch bilgisi
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
echo "- Branch: \`${branch}\`"

# Schema vs migration drift hızlı kontrol
schema_changed=$(git diff --name-only HEAD 2>/dev/null | grep -c '^prisma/schema\.prisma$' || true)
migrations_pending=$(git status --short prisma/migrations/ 2>/dev/null | grep -c '^??' || true)
if [ "${schema_changed:-0}" -gt 0 ] && [ "${migrations_pending:-0}" -eq 0 ]; then
  echo "- ⚠️  schema.prisma değişti, prisma/migrations/ altında yeni klasör YOK → drift riski. \`/migration-check\` çalıştır."
fi

# Hatırlatmalar
cat <<'EOF'

### Bu projede unutma:
- **Next.js 16** — kırıcı değişiklikler var, eski API'leri varsaymadan önce `node_modules/next/dist/docs/` oku
- **Multi-tenant** — her Prisma sorgusunda `organizationId` filtresi zorunlu (`/check-tenant` ile denetle)
- **Migration** — schema değişti mi → `pnpm db:migrate dev --name <isim>`. `pnpm db:push` YASAK
- **Auth** — API route'ta `getAuthUser()` kullan, `supabase.auth.getUser()` YASAK
- **Cache-Control** — her GET endpoint'inde zorunlu
- **Turkish UI** — kullanıcıya gösterilen tüm hata mesajları Türkçe

### Hızlı komutlar:
- `/check-tenant` — organizationId eksik sorguları bul
- `/check-rls` — RLS policy'si eksik tabloları bul
- `/migration-check` — schema/migration drift kontrolü
EOF
