import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Mevcut kodda ihlali olan kurallar: CI'ı kırmasın diye şimdilik uyarı seviyesinde.
    // `npm run lint:ci` toplam uyarı sayısını sabitler (--max-warnings), yani yeni
    // ihlal eklenemez. İhlaller temizlendikçe package.json'daki sayı düşürülür;
    // sıfırlanan kural buradan silinip tekrar hata seviyesine döner.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
