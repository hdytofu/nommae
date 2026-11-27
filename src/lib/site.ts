import "server-only";
import { headers } from "next/headers";

export const APP_NAME = "คลังนมแม่";

// ที่อยู่เว็บจริง ใช้สร้างลิงก์ callback ของ LINE/อีเมล และลิงก์เชิญ
// ตั้ง NEXT_PUBLIC_SITE_URL บน Vercel ให้ตรงกับที่ลงทะเบียนไว้ใน LINE Developers
export async function getSiteUrl(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// รับเฉพาะ path ภายในเว็บ กันการส่งต่อไปเว็บอื่น (open redirect)
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
