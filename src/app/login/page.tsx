import Link from "next/link";
import { BagIcon } from "@/components/bag-icon";
import { safeNext } from "@/lib/site";
import { EmailForm } from "./email-form";

export const metadata = { title: "เข้าสู่ระบบ" };

const ERRORS: Record<string, string> = {
  line_not_configured: "ยังไม่ได้ตั้งค่าการล็อกอินด้วย LINE ใช้อีเมลไปก่อนได้",
  line_cancelled: "ยกเลิกการล็อกอินด้วย LINE แล้ว",
  line_state: "ล็อกอินด้วย LINE ไม่สำเร็จ ลองกดใหม่อีกครั้ง",
  line_token: "ล็อกอินด้วย LINE ไม่สำเร็จ ลองกดใหม่อีกครั้ง",
  line_verify: "ล็อกอินด้วย LINE ไม่สำเร็จ ลองกดใหม่อีกครั้ง",
  account: "สร้างบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง",
  email_link: "ลิงก์ในอีเมลหมดอายุหรือถูกใช้ไปแล้ว ขอลิงก์ใหม่ได้เลย",
};

export default async function LoginPage(props: { searchParams: Promise<{ next?: string; error?: string; deleted?: string }> }) {
  const sp = await props.searchParams;
  const next = safeNext(sp.next);
  const error = sp.error ? ERRORS[sp.error] ?? "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง" : null;
  return (
    <main className="page">
      <section className="login-hero">
        <BagIcon ml={180} place="fridge" scale={2.2} />
        <h1>คลังนมแม่</h1>
        <p>บันทึกการปั๊มนมและสต็อกนมร่วมกันทั้งครอบครัว รู้ว่าถุงไหนควรใช้ก่อนและหมดอายุเมื่อไร</p>
      </section>
      {sp.deleted && <div className="box good">ลบบัญชีและข้อมูลของคุณเรียบร้อยแล้ว</div>}
      {error && <div className="box bad" role="alert">{error}</div>}
      <a className="btn line block" href={`/auth/line?next=${encodeURIComponent(next)}`}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
          <path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5 1.1-.5 6-3.5 8.2-6 1.5-1.6 2.2-3.3 2.2-4.8C22.4 6.6 17.9 3 12 3z" />
        </svg>
        เข้าสู่ระบบด้วย LINE
      </a>
      <div className="divider">หรือ</div>
      <EmailForm next={next} />
      <p className="hint" style={{ textAlign: "center" }}>
        การเข้าสู่ระบบถือว่ายอมรับ <Link className="link" href="/privacy">นโยบายความเป็นส่วนตัว</Link>
      </p>
    </main>
  );
}
