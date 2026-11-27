import Link from "next/link";
import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./join-form";

export const metadata = { title: "เข้าร่วมครอบครัว" };

export default async function JoinPage(props: { params: Promise<{ code: string }> }) {
  const { code } = await props.params;
  const ctx = await getAppContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("invite_info", { p_code: code });
  const info = Array.isArray(data) ? data[0] : data;

  return (
    <main className="page">
      <h1>เข้าร่วมครอบครัว</h1>
      {!info || !info.valid ? (
        <div className="card">
          <p>โค้ดเชิญนี้ไม่ถูกต้องหรือหมดอายุแล้ว (โค้ดใช้ได้ 7 วัน) ขอให้คนที่เชิญส่งลิงก์ใหม่มาอีกครั้ง</p>
          <Link className="btn" href="/">ไปหน้าแรก</Link>
        </div>
      ) : info.already_member ? (
        <div className="card">
          <p>คุณเป็นสมาชิกครอบครัวของน้อง{info.baby_name || "คนนี้"}อยู่แล้ว</p>
          <Link className="btn primary" href="/">ไปที่สต็อกนม</Link>
        </div>
      ) : (
        <JoinForm code={code} babyName={info.baby_name} needConsent={!ctx.profile.consentAt} />
      )}
    </main>
  );
}
