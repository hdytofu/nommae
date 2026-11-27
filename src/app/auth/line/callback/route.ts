import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeNext } from "@/lib/site";

// LINE ส่งกลับมาพร้อม code → แลกเป็น id_token → ให้ LINE ยืนยัน → สร้าง/เข้าสู่บัญชีใน Supabase
//
// Supabase ไม่มีปุ่ม LINE ในตัว จึงสร้างผู้ใช้ด้วยอีเมลภายใน (ไม่มีการส่งอีเมลจริง)
// แล้วออก magic link ฝั่ง server และยืนยันทันทีเพื่อได้ session ใน cookie
const LINE_EMAIL_DOMAIN = "line.nommae.local";

type LineProfile = { sub: string; name?: string; picture?: string; nonce?: string };

export async function GET(request: NextRequest) {
  const site = await getSiteUrl();
  const fail = (code: string) => {
    const res = NextResponse.redirect(`${site}/login?error=${code}`);
    res.cookies.delete({ name: "line_oauth", path: "/auth/line" });
    return res;
  };

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("line_cancelled"); // ผู้ใช้กดยกเลิกที่หน้า LINE

  let saved: { state: string; nonce: string; next: string } | null = null;
  try {
    saved = JSON.parse(request.cookies.get("line_oauth")?.value ?? "null");
  } catch {
    saved = null;
  }
  const code = params.get("code");
  if (!saved || !code || params.get("state") !== saved.state) return fail("line_state");

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID!;
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET!;
  if (!channelId || !channelSecret) return fail("line_not_configured");

  // 1) แลก code เป็น token
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${site}/auth/line/callback`,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  if (!tokenRes.ok) return fail("line_token");
  const { id_token: idToken } = (await tokenRes.json()) as { id_token?: string };
  if (!idToken) return fail("line_token");

  // 2) ให้ LINE ตรวจลายเซ็น id_token และ nonce
  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId, nonce: saved.nonce }),
  });
  if (!verifyRes.ok) return fail("line_verify");
  const line = (await verifyRes.json()) as LineProfile;
  if (!line.sub) return fail("line_verify");

  // 3) สร้างผู้ใช้ (ครั้งแรก) แล้วออก session
  const admin = createAdminClient();
  const email = `${line.sub.toLowerCase()}@${LINE_EMAIL_DOMAIN}`;
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name: line.name ?? "", picture: line.picture ?? null, line_user_id: line.sub },
  });
  if (createErr && createErr.code !== "email_exists" && !/already/i.test(createErr.message)) {
    return fail("account");
  }
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (linkErr || !link?.properties?.hashed_token) return fail("account");

  const supabase = await createClient();
  const { data: session, error: otpErr } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpErr || !session.user) return fail("account");

  // รูปโปรไฟล์อัปเดตทุกครั้งที่ล็อกอิน · ชื่อไม่ทับ (ผู้ใช้อาจตั้งชื่อเรียกในครอบครัวไว้แล้ว)
  await admin
    .from("profiles")
    .update({ picture_url: line.picture ?? null, line_user_id: line.sub })
    .eq("id", session.user.id);

  const res = NextResponse.redirect(`${site}${safeNext(saved.next)}`);
  res.cookies.delete({ name: "line_oauth", path: "/auth/line" });
  return res;
}
