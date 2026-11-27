import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { WelcomeForms } from "./welcome-forms";

export const metadata = { title: "เริ่มต้นใช้งาน" };

export default async function WelcomePage(props: { searchParams: Promise<{ new?: string }> }) {
  const [ctx, sp] = await Promise.all([getAppContext(), props.searchParams]);
  if (!ctx) redirect("/login");
  if (ctx.households.length && !sp.new) redirect("/");
  const first = !ctx.households.length;
  return (
    <main className="page">
      <div>
        <h1>{first ? `สวัสดี${ctx.profile.name ? " " + ctx.profile.name : ""}` : "สร้างสมุดนมเล่มใหม่"}</h1>
        <p className="muted" style={{ margin: "4px 0 0" }}>
          {first
            ? "เริ่มจากสร้างสมุดนมของลูก แล้วค่อยชวนพ่อหรือยายเข้ามาบันทึกด้วยกัน หรือถ้ามีคนส่งโค้ดเชิญมาให้ ใส่โค้ดด้านล่างได้เลย"
            : "สมุดนมแต่ละเล่มมีสต็อกและสมาชิกแยกกัน"}
        </p>
      </div>
      <WelcomeForms needConsent={!ctx.profile.consentAt} showJoin={first} />
    </main>
  );
}
