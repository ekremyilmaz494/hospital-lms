#!/usr/bin/env bash
# Editorial palette guard
#
# Kural: src/app/{staff,admin,super-admin}/** ve src/app/help/** içindeki
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

SCAN_DIRS=(src/app/staff src/app/admin src/app/super-admin src/app/help)
PATTERN='const[[:space:]]+(CREAM|INK|INK_SOFT|GOLD|RULE|OLIVE|CARD_BG|FONT_DISPLAY|FONT_BODY|FONT_MONO)[[:space:]]*='

VIOLATIONS=""
for d in "${SCAN_DIRS[@]}"; do
  if [ -d "$d" ]; then
    FOUND=$(grep -rnE "$PATTERN" "$d" 2>/dev/null || true)
    if [ -n "$FOUND" ]; then
      VIOLATIONS="${VIOLATIONS}${FOUND}
"
    fi
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
