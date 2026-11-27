import "server-only";
import { createClient } from "@supabase/supabase-js";

// admin client — ใช้ service_role key ฝั่ง server เท่านั้น (ข้าม RLS ได้ ห้ามส่งไปหน้าเว็บ)
// ใช้กับงานที่ผู้ใช้ทำเองไม่ได้: สร้างบัญชีจาก LINE, ลบบัญชี
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ยังไม่ได้ตั้งค่า SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
