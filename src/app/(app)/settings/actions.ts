"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HH_COOKIE, getAppContext } from "@/lib/app-context";
import { rpcMessage, setCurrentHousehold, type FormState } from "@/lib/household";

// ทุก action อ่านครอบครัวปัจจุบันจาก cookie ฝั่ง server (ไม่เชื่อค่าจากหน้าเว็บ) และ RLS กันซ้ำอีกชั้น
async function requireHousehold() {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.household) redirect("/welcome");
  return { ctx, household: ctx.household };
}

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { household } = await requireHousehold();
  const num = (key: string, max: number) => {
    const v = Number(formData.get(key));
    return Number.isFinite(v) && v > 0 && v <= max ? v : null;
  };
  const vals = {
    baby_name: String(formData.get("babyName") ?? "").trim().slice(0, 40),
    unit: formData.get("unit") === "ml" ? "ml" : "oz",
    room_hours: num("roomHours", 72),
    cooler_hours: num("coolerHours", 168),
    fridge_days: num("fridgeDays", 30),
    freezer_days: num("freezerDays", 730),
    thawed_hours: num("thawedHours", 72),
  };
  if (Object.values(vals).some((v) => v === null)) {
    return { error: "ระยะเวลาต้องเป็นตัวเลขมากกว่า 0 (ห้อง/ละลาย ไม่เกิน 72 ชม. · ตู้เย็นไม่เกิน 30 วัน · ช่องแข็งไม่เกิน 730 วัน)" };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("households").update(vals).eq("id", household.id);
  if (error) return { error: "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง" };
  revalidatePath("/", "layout");
  return { ok: "บันทึกการตั้งค่าแล้ว" };
}

export async function createInviteAction(): Promise<{ code?: string; error?: string }> {
  const { household } = await requireHousehold();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", { p_household: household.id });
  if (error || !data) return { error: rpcMessage(error?.message) };
  revalidatePath("/settings");
  return { code: String(data) };
}

export async function revokeInviteAction(code: string) {
  const { household } = await requireHousehold();
  const supabase = await createClient();
  await supabase.from("invites").delete().eq("code", code).eq("household_id", household.id);
  revalidatePath("/settings");
}

export async function removeMemberAction(userId: string): Promise<{ error?: string }> {
  const { household } = await requireHousehold();
  const supabase = await createClient();
  const { data, error } = await supabase.from("household_members").delete()
    .eq("household_id", household.id).eq("user_id", userId).select("user_id");
  if (error || !data?.length) return { error: "เอาสมาชิกออกไม่สำเร็จ (เฉพาะเจ้าของครอบครัวทำได้)" };
  revalidatePath("/", "layout");
  return {};
}

export async function leaveHouseholdAction(): Promise<{ error?: string }> {
  const { ctx, household } = await requireHousehold();
  const supabase = await createClient();
  const { data } = await supabase.from("household_members").delete()
    .eq("household_id", household.id).eq("user_id", ctx.userId).select("user_id");
  if (!data?.length) return { error: "เจ้าของครอบครัวออกเองไม่ได้ ถ้าไม่ใช้แล้วให้ลบบัญชีแทน" };
  (await cookies()).delete(HH_COOKIE);
  redirect("/");
}

export async function switchHouseholdAction(id: string) {
  const { ctx } = await requireHousehold();
  if (ctx.households.some((h) => h.id === id)) await setCurrentHousehold(id);
  redirect("/");
}

export async function renameAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { ctx } = await requireHousehold();
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { error: "กรุณาใส่ชื่อ" };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", ctx.userId);
  if (error) return { error: "บันทึกไม่สำเร็จ" };
  revalidatePath("/", "layout");
  return { ok: "เปลี่ยนชื่อแล้ว" };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(HH_COOKIE);
  redirect("/login");
}

// ลบบัญชีถาวร: ครอบครัวที่เหลือเราคนเดียวถูกลบทั้งหมด ครอบครัวที่ยังมีคนอื่น ส่งต่อความเป็นเจ้าของให้สมาชิกคนแรก
export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (String(formData.get("confirm") ?? "").trim() !== "ลบ") return { error: "พิมพ์คำว่า ลบ เพื่อยืนยัน" };

  const admin = createAdminClient();
  const uid = ctx.userId;
  const { data: mine, error: listErr } = await admin.from("household_members").select("household_id, role").eq("user_id", uid);
  if (listErr) return { error: "ลบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง" };
  for (const m of mine ?? []) {
    const { data: others } = await admin.from("household_members").select("user_id")
      .eq("household_id", m.household_id).neq("user_id", uid).order("created_at").limit(1);
    if (!others?.length) {
      await admin.from("households").delete().eq("id", m.household_id);
    } else if (m.role === "owner") {
      await admin.from("household_members").update({ role: "owner" })
        .eq("household_id", m.household_id).eq("user_id", others[0].user_id);
    }
  }
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return { error: "ลบบัญชีไม่สำเร็จ ติดต่อผู้ดูแลระบบ" };
  (await cookies()).delete(HH_COOKIE);
  redirect("/login?deleted=1");
}
