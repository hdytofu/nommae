"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeNext } from "@/lib/site";

export type MagicLinkState = { error?: string; sent?: string };

// ล็อกอินสำรองด้วยอีเมล (สำหรับคนที่ไม่ใช้ LINE) — ส่งลิงก์เข้าสู่ระบบไปที่อีเมล
export async function sendMagicLink(_prev: MagicLinkState, formData: FormData): Promise<MagicLinkState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(String(formData.get("next") ?? "/"));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };

  const site = await getSiteUrl();
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    return { error: error.status === 429 ? "ขอลิงก์บ่อยเกินไป รอสักครู่แล้วลองใหม่" : "ส่งอีเมลไม่สำเร็จ ลองใหม่อีกครั้ง" };
  }
  return { sent: email };
}
