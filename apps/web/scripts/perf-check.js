/* eslint-disable */
// Performance Guard — Pre-commit scanner for API routes & client components
// Catches common performance anti-patterns before they reach production.
// Runs via lint-staged on API route.ts and client page.tsx files.
const fs = require('fs');

const allFiles = process.argv.slice(2);
const apiFiles = allFiles.filter(f => f.includes('src/app/api') && f.endsWith('route.ts'));
const pageFiles = allFiles.filter(f =>
  (f.endsWith('page.tsx') || f.endsWith('page.ts')) && f.includes('src/app/')
);

if (apiFiles.length === 0 && pageFiles.length === 0) {
  process.exit(0);
}

const issues = [];

// Paths exempt from certain rules
const GETUSER_EXEMPT = ['/auth/mfa/', '/auth/callback/'];
const CACHE_CONTROL_EXEMPT = ['/upload/', '/export/', '/completion-report/', '/backup/'];

// ═══════════════════════════════════════════════
// API ROUTE CHECKS
// ═══════════════════════════════════════════════
for (const file of apiFiles) {
  try {
    if (!fs.existsSync(file)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const fileShort = file.replace(/\\/g, '/').replace(/.*src\//, 'src/');

    // ── Rule 1: No supabase.auth.getUser() in API routes ──
    if (!GETUSER_EXEMPT.some(ex => file.includes(ex))) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('perf-check-disable-line')) continue;
        if (/supabase\.auth\.getUser\s*\(/.test(lines[i])) {
          issues.push({
            level: 'error',
            file: fileShort,
            line: i + 1,
            rule: 'no-getUser',
            msg: 'supabase.auth.getUser() HTTP round-trip tespit edildi. getAuthUser() veya getSession() kullanin.',
          });
        }
      }
    }

    // ── Rule 2: Sequential await prisma (warn at 3+, error at 5+) ──
    const hasPromiseAll = content.includes('Promise.all');
    const prismaAwaits = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('perf-check-disable-line')) continue;
      if (/^\s*(?:const|let|var)\s+\w.*=\s*await\s+prisma\./.test(lines[i])) {
        prismaAwaits.push(i + 1);
      }
    }
    if (prismaAwaits.length >= 5 && !hasPromiseAll) {
      issues.push({
        level: 'error',
        file: fileShort,
        line: prismaAwaits[0],
        rule: 'sequential-prisma',
        msg: `${prismaAwaits.length} ardisik await prisma bulundu (satir ${prismaAwaits.join(', ')}). Promise.all ile paralellestir. COMMIT ENGELLENDI.`,
      });
    } else if (prismaAwaits.length >= 3 && !hasPromiseAll) {
      issues.push({
        level: 'warn',
        file: fileShort,
        line: prismaAwaits[0],
        rule: 'sequential-prisma',
        msg: `${prismaAwaits.length} ardisik await prisma bulundu (satir ${prismaAwaits.join(', ')}). Promise.all ile paralellestir.`,
      });
    }

    // ── Rule 3: GET handler missing Cache-Control (error) ──
    if (!CACHE_CONTROL_EXEMPT.some(ex => file.includes(ex))) {
      const hasGetExport = /export\s+(?:async\s+)?function\s+GET/.test(content);
      const hasCacheControl = content.includes('Cache-Control');
      if (hasGetExport && !hasCacheControl) {
        issues.push({
          level: 'error',
          file: fileShort,
          line: 1,
          rule: 'missing-cache-control',
          msg: 'GET handler Cache-Control header eksik. jsonResponse(data, 200, { "Cache-Control": "..." }) ekleyin. COMMIT ENGELLENDI.',
        });
      }
    }

    // ── Rule N: Raw TrainingVideo.videoUrl döndürme yasak (error) ──
    // CLAUDE.md "Video URL Kuralı": API response'larda v.videoUrl/video.videoUrl
    // ham olarak döndürülemez. Mutlaka resolveTrainingVideoUrl() helper'ından geçer.
    // Bu kural admin paneli videosunun 5-6 kez bozulup geri gelmesinin önüne geçer.
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('perf-check-disable-line')) continue;
      if (/videoUrl:\s*(?:v|video|item|row|tv)\.videoUrl\b/.test(lines[i])) {
        issues.push({
          level: 'error',
          file: fileShort,
          line: i + 1,
          rule: 'raw-video-url',
          msg: 'Raw v.videoUrl API response\'a doniyor. resolveTrainingVideoUrl(v) kullan — bkz: CLAUDE.md "Video URL Kurali". COMMIT ENGELLENDI.',
        });
      }
    }

    // ── Rule 4: include without select (warn) ──
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('perf-check-disable-line')) continue;
      // Detect `include: {` followed by no `select:` in the next 5 lines
      if (/include:\s*\{/.test(lines[i]) && !lines[i].includes('select')) {
        const block = lines.slice(i, i + 8).join(' ');
        // If block has nested include but no select at all, warn
        if (/include:\s*\{[^}]*include:/.test(block) && !block.includes('select:')) {
          issues.push({
            level: 'warn',
            file: fileShort,
            line: i + 1,
            rule: 'nested-include-no-select',
            msg: 'Nested include select olmadan kullanılıyor. Gereksiz sütun çekmeyi önlemek için select ekleyin.',
          });
        }
      }
    }

  } catch (err) {
    console.error(`Failed to read ${file}: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════
// CLIENT PAGE CHECKS
// ═══════════════════════════════════════════════
for (const file of pageFiles) {
  try {
    if (!fs.existsSync(file)) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');
    const fileShort = file.replace(/\\/g, '/').replace(/.*src\//, 'src/');

    // Only check 'use client' pages
    if (!content.startsWith("'use client'") && !content.startsWith('"use client"')) continue;

    // ── Rule 5: Multiple .filter()/.map() without useMemo (warn) ──
    const filterMapCalls = [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('perf-check-disable-line')) continue;
      // Match lines like: const x = someArray.filter(...) outside of useMemo
      if (/^\s*(?:const|let|var)\s+\w.*\.(?:filter|map|reduce|sort)\s*\(/.test(lines[i])) {
        filterMapCalls.push(i + 1);
      }
    }
    const hasUseMemo = content.includes('useMemo');
    if (filterMapCalls.length >= 4 && !hasUseMemo) {
      issues.push({
        level: 'warn',
        file: fileShort,
        line: filterMapCalls[0],
        rule: 'unmemoized-computation',
        msg: `${filterMapCalls.length} filter/map/reduce/sort çağrısı memoize edilmeden kullanılıyor (satir ${filterMapCalls.slice(0, 5).join(', ')}). useMemo ile sarın.`,
      });
    }

    // ── Rule 6: useFetch without error handling (warn) ──
    if (content.includes('useFetch')) {
      const hasErrorCheck = /(?:error|isLoading)/.test(content);
      if (!hasErrorCheck) {
        issues.push({
          level: 'warn',
          file: fileShort,
          line: 1,
          rule: 'usefetch-no-error-check',
          msg: 'useFetch kullanılıyor ama error/isLoading kontrolü yok. Kullanıcı boş sayfa görebilir.',
        });
      }
    }

    // ── Rule 6.5: Exam video sayfasında useFetch noStore zorunlu (error) ──
    // CLAUDE.md "Video Resume Kuralı": /exam/ altındaki sayfalarda video listesi
    // (/videos endpoint'i) useFetch ile çekiliyorsa { noStore: true } ZORUNLU.
    // useFetch'in modül-level cache'i SPA geri dönüşünde bayat lastPosition=0
    // servis eder → onLoadedMetadata resume seek'i atlanır → video baştan başlar
    // ("kaldığım yerden devam etmiyor" şikayeti — Haziran 2026 Devakent).
    const isExamPage = /[\\/]exam[\\/]/.test(file);
    if (isExamPage && content.includes('useFetch')) {
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('perf-check-disable-line')) continue;
        // useFetch çağrısı /videos URL'i içeriyor mu? (çağrı birden çok satıra yayılabilir)
        if (/useFetch[<(]/.test(lines[i])) {
          const callWindow = lines.slice(i, i + 4).join(' ');
          const fetchesVideos = /\/videos/.test(callWindow) || /videosUrl/.test(callWindow);
          const hasNoStore = /noStore:\s*true/.test(callWindow);
          if (fetchesVideos && !hasNoStore) {
            issues.push({
              level: 'error',
              file: fileShort,
              line: i + 1,
              rule: 'exam-video-stale-cache',
              msg: 'Exam video sayfasinda useFetch noStore: true OLMADAN kullaniliyor. ' +
                   'Bayat lastPosition cache\'i "kaldigim yerden devam etmiyor" bug\'ini geri getirir. ' +
                   'useFetch(url, { noStore: true }) kullan — bkz: CLAUDE.md "Video Resume Kurali". COMMIT ENGELLENDI.',
            });
          }
        }
      }
    }

  } catch (err) {
    console.error(`Failed to read ${file}: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════
// Rule 7: Mutation routes affecting cached entities must invalidate cache
// (Geçmişteki tuzak: departman mutasyonu staff cache'ini invalidate etmiyordu →
// kullanıcı yeni departmanı 120 saniye boyunca göremedi.)
// ═══════════════════════════════════════════════
const MUTATION_HANDLER_RE = /export\s+const\s+(POST|PATCH|PUT|DELETE)\s*=/;
const PRISMA_WRITE_RE = /prisma\.[a-zA-Z]+\.(create|update|delete|upsert|createMany|updateMany|deleteMany)\s*\(/;
const INVALIDATE_RE = /invalidateOrgCache\s*\(|invalidateDashboardCache\s*\(|invalidateCache\s*\(/;
// Bu yorumla bir route bilinçli olarak invalidation'sız bırakılabilir
const NO_CACHE_OVERRIDE_RE = /\/\/\s*perf-check:\s*no-cache-invalidation/;

for (const file of apiFiles) {
  try {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const fileShort = file.replace(/\\/g, '/').replace(/.*src\//, 'src/');

    const isMutationRoute = MUTATION_HANDLER_RE.test(content);
    const hasPrismaWrite = PRISMA_WRITE_RE.test(content);
    const hasInvalidation = INVALIDATE_RE.test(content);
    const hasOverride = NO_CACHE_OVERRIDE_RE.test(content);

    if (isMutationRoute && hasPrismaWrite && !hasInvalidation && !hasOverride) {
      issues.push({
        level: 'warn',
        file: fileShort,
        line: 1,
        rule: 'missing-cache-invalidation',
        msg: 'Mutasyon route\'u prisma write yapıyor ama invalidateOrgCache çağrısı yok. ' +
             'Bu route\'un etkilediği entity cache\'lenmiş ise stale veri riski var. ' +
             'Gerekiyorsa invalidateOrgCache(orgId, "<entity>") ekle, gereksizse ' +
             '`// perf-check: no-cache-invalidation — <sebep>` yorumu yaz.',
      });
    }
  } catch (err) {
    console.error(`Failed to read ${file}: ${err.message}`);
  }
}

// ── Report ──
const errors = issues.filter(i => i.level === 'error');
const warns = issues.filter(i => i.level === 'warn');

const totalFiles = apiFiles.length + pageFiles.length;

if (issues.length > 0) {
  console.log(`\n⚡ Performance Guard — ${apiFiles.length} API route + ${pageFiles.length} page tarandı\n`);

  for (const issue of issues) {
    const icon = issue.level === 'error' ? '🚨' : '⚠️';
    console.log(`${icon} [${issue.rule}] ${issue.file}:${issue.line}`);
    console.log(`   ${issue.msg}\n`);
  }

  if (errors.length > 0) {
    console.error(`❌ ${errors.length} performans hatası bulundu. Commit engellendi.`);
    console.error('   False positive ise satıra `// perf-check-disable-line` ekleyin.\n');
    process.exit(1);
  } else {
    console.log(`⚠️  ${warns.length} performans uyarısı var (commit engellenmedi).\n`);
    process.exit(0);
  }
} else {
  console.log(`✅ Performans kontrolü temiz (${totalFiles} dosya).\n`);
  process.exit(0);
}
