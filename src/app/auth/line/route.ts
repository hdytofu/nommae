import { NextResponse, type NextRequest } from "next/server";
import { getSiteUrl, safeNext } from "@/lib/site";

// เริ่มล็อกอินด้วย LINE: สร้าง state/nonce เก็บใน cookie แล้วส่งไปหน้าอนุญาตของ LINE
export async function GET(request: NextRequest) {
  const site = await getSiteUrl();
  const channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.redirect(`${site}/login?error=line_not_configured`);
  }
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", channelId);
  url.searchParams.set("redirect_uri", `${site}/auth/line/callback`);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("scope", "profile openid");
  // ชวนเพิ่มเพื่อน LINE OA ตอนล็อกอิน (ใช้ส่งแจ้งเตือนในเฟสถัดไป) — ต้องผูก OA กับ Login channel ก่อน
  if (process.env.LINE_BOT_PROMPT === "aggressive" || process.env.LINE_BOT_PROMPT === "normal") {
    url.searchParams.set("bot_prompt", process.env.LINE_BOT_PROMPT);
  }

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("line_oauth", JSON.stringify({ state, nonce, next }), {
    httpOnly: true,
    secure: site.startsWith("https://"),
    sameSite: "lax",
    path: "/auth/line",
    maxAge: 600,
  });
  return res;
}
