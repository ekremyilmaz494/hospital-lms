/* eslint-disable */
const fs = require('fs');
const path = require('path');

const SECRET_PATTERNS = [
  { name: 'Supabase JWT/Key', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/ },
  { name: 'Generic Password Assignment', regex: /password\s*=\s*['"][^'"]+['"]/i },
  { name: 'Generic Secret Assignment', regex: /secret\s*=\s*['"][^'"]+['"]/i },
  { name: 'Database URL', regex: /postgres(ql)?:\/\/[^:]+:[^@]+@[^/]+\/\w+/ },
  { name: 'AWS Access Key ID', regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
];

// Dosyaları argümanlardan al (lint-staged tarafından gönderilir)
const files = process.argv.slice(2);

let hasSecrets = false;

console.log(`\n🔍 Secret Scanner is checking ${files.length} files...\n`);

for (const file of files) {
  try {
    // Sadece mevcut dosyaları kontrol et
    if (!fs.existsSync(file)) continue;
    
    // .env.example gibi şablon dosyalarını atla
    if (file.includes('.env.example') || file.includes('secret-scanner.js')) continue;

    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // eslint-disable yorumu varsa yoksay
      if (line.includes('secret-scanner-disable-line')) continue;

      for (const pattern of SECRET_PATTERNS) {
        if (pattern.regex.test(line)) {
          // Eğer pattern bulursa ama bu bir environment variable kullanımı ise (process.env) atla
          if (line.includes('process.env.')) continue;
          
          hasSecrets = true;
          console.error(`🚨 [SECRET_DETECTED: ${pattern.name}] in ${file}:${i + 1}`);
          const snippet = line.length > 100 ? line.substring(0, 100) + '...' : line;
          console.error(`   > ${snippet.trim()}`);
        }
      }
    }
  } catch (err) {
    console.error(`Failed to read file ${file}:`, err.message);
  }
}

if (hasSecrets) {
  console.error('\n❌ Commit blocked! Please remove the plain text secrets above.');
  console.error('If this is a false positive, append `// secret-scanner-disable-line` to the line.');
  process.exit(1);
} else {
  console.log('✅ No secrets detected. Proceeding with commit.\n');
  process.exit(0);
}
