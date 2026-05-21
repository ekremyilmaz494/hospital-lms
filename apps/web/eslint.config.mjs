import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Flat config'de plugin'ler config nesnesine scoped'tur — react/react-hooks
    // kurallarını override eden bu blok plugin'leri kendisi kaydetmek zorunda.
    // Eksikti → "could not find plugin react" ile eslint hiç yüklenemiyordu.
    plugins: { react, "react-hooks": reactHooks },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-this-alias": "warn",
      "react/no-unescaped-entities": "warn",
      // eslint-plugin-react-hooks v7 (React Compiler) kuralları repoda warn'a
      // indiriliyor — Date.now()/window.location.href gibi yaygın pattern'leri
      // error sayar. immutability + purity, config çalışmadığı için listede
      // eksik kalmıştı; diğer üçüyle aynı seviyeye alındı.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    // `.next*` — .next, .next.nosync (macOS iCloud), ".next 2" (dev:clean artığı)
    // hepsi build çıktısıdır; lint edilmemeli (yoksa ~10k sahte problem).
    ".next*/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "tmp/**",
    "aaaaaaa/**",
    "public/**",
    "**/*.min.js",
  ]),
]);

export default eslintConfig;
