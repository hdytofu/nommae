import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // ใช้ any กับ row จาก Supabase โดยตั้งใจ — ไม่ถือเป็น error
      "@typescript-eslint/no-explicit-any": "off",
      // เครื่องหมาย " ในข้อความไทยภายใน JSX — cosmetic เท่านั้น
      "react/no-unescaped-entities": "off",
      // ตัวแปร/อาร์กิวเมนต์ที่ขึ้นต้นด้วย _ = ตั้งใจไม่ใช้ (เช่น omit ใน destructure)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // pattern sync prop→state ใน input ที่ debounce อยู่ — ทำงานถูกต้อง คงไว้เป็นคำเตือน
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);

export default eslintConfig;
