import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeNext } from "@/lib/site";

// ลิงก์จากอีเมล (ล็อกอินสำรองสำหรับคนที่ไม่ใช้ LINE)
// รองรับทั้งแบบ ?code= (PKCE ค่าเริ่มต้นของ Supabase) และ ?token_hash=&type= (เทมเพลตอีเมลแบบกำหนดเอง)
export async function GET(request: NextRequest) {
  const site = await getSiteUrl();
  const p = request.nextUrl.searchParams;
  const next = safeNext(p.get("next"));
  const supabase = await createClient();

  const code = p.get("code");
  const tokenHash = p.get("token_hash");
  const type = p.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }
  return NextResponse.redirect(ok ? `${site}${next}` : `${site}/login?error=email_link`);
}
