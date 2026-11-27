"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserId } from "@/lib/app-context";
import { rpcMessage, setCurrentHousehold, type FormState } from "@/lib/household";

async function recordConsent(consent: boolean) {
  const supabase = await createClient();
  const userId = await getUserId();
  if (!userId) return false;
  const { data } = await supabase.from("profiles").select("consent_at").eq("id", userId).maybeSingle();
  if (data?.consent_at) return true;
  if (!consent) return false;
  await supabase.from("profiles").update({ consent_at: new Date().toISOString() }).eq("id", userId);
  return true;
}

export async function createHouseholdAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await recordConsent(formData.get("consent") === "on"))) {
    return { error: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนเริ่มใช้งาน" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_household", {
    p_baby_name: String(formData.get("babyName") ?? "").trim().slice(0, 40),
    p_unit: formData.get("unit") === "ml" ? "ml" : "oz",
    p_freezer_days: Number(formData.get("freezerDays")) || 90,
  });
  if (error || !data) return { error: rpcMessage(error?.message) };
  await setCurrentHousehold(String(data));
  redirect("/");
}

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await recordConsent(formData.get("consent") === "on"))) {
    return { error: "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนเข้าร่วม" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_code: String(formData.get("code") ?? "") });
  if (error || !data) return { error: rpcMessage(error?.message) };
  await setCurrentHousehold(String(data));
  redirect("/");
}

export async function goToInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const code = String(formData.get("code") ?? "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (code.length !== 8) return { error: "โค้ดเชิญมี 8 ตัวอักษร" };
  redirect(`/join/${code}`);
}
