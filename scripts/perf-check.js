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
