#!/usr/bin/env bash
# Editorial palette guard
#
# Kural: src/app/(app)/{staff,admin,super-admin}/** ve src/app/help/** içindeki
# sayfa dosyaları editorial renk/font constant'larını YEREL tanımlayamaz.
# Tek kaynak: src/lib/editorial-palette.ts — oradan import zorunlu.
#
# Aksi halde bir yerde renk değişince diğer sayfalar unutulur → tutarsızlık
# (2026-04-22'de yaşanan: 10 sayfa farklı cream fallback'iyle bir kısmı
# güncellenmedi, chrome-content arası seam oluştu).
#
# Chrome dosyaları (components/layouts/**) istisna — onlar bilinçli hex sabit
# kullanır (memory: feedback_editorial_palette.md).

set -euo pipefail

# Monorepo-aware: script konumundan ($repo/apps/web/scripts) src/app/'a göreceli
# yol. Böylece script root'tan, apps/web/'den veya CI'dan çağrılabilir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SCAN_DIRS=(
  "$APP_ROOT/src/app/(app)/staff"
  "$APP_ROOT/src/app/(app)/admin"
  "$APP_ROOT/src/app/(app)/super-admin"
  "$APP_ROOT/src/app/help"
)
PATTERN='const[[:space:]]+(CREAM|INK|INK_SOFT|GOLD|RULE|OLIVE|CARD_BG|FONT_DISPLAY|FONT_BODY|FONT_MONO)[[:space:]]*='

VIOLATIONS=""
for d in "${SCAN_DIRS[@]}"; do
  # Fail-closed: klasör taşınırsa (örn. route group'a) koruma sessizce kapanmasın.
  if [ ! -d "$d" ]; then
    echo "❌ Editorial palette guard: taranacak klasör bulunamadı: $d"
    echo "   Klasör taşındıysa SCAN_DIRS'i ve kök package.json lint-staged glob'unu güncelle."
    exit 1
  fi
  FOUND=$(grep -rnE "$PATTERN" "$d" 2>/dev/null || true)
  if [ -n "$FOUND" ]; then
    VIOLATIONS="${VIOLATIONS}${FOUND}
"
  fi
done

if [ -n "$VIOLATIONS" ]; then
  echo "❌ Editorial palette guard: sayfa dosyalarında yerel constant tanımı var."
  echo "   Şunu import et: import { CREAM, INK, ... } from '@/lib/editorial-palette'"
  echo ""
  echo "$VIOLATIONS"
  exit 1
fi

echo "✓ Editorial palette guard — tüm sayfa dosyaları merkezden import ediyor."
