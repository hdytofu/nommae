import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Household, Member } from "@/lib/milk";

export const HH_COOKIE = "hh"; // ครอบครัวที่เลือกดูอยู่ (กรณีเป็นสมาชิกหลายครอบครัว)

export type AppContext = {
  userId: string;
  profile: { name: string; picture: string | null; consentAt: string | null };
  households: { id: string; babyName: string; role: "owner" | "member" }[];
  household: Household | null;
  members: Member[];
};

// ผู้ใช้ปัจจุบัน — cache ต่อ request (layout กับ page เรียกซ้ำได้ ยิง Supabase ครั้งเดียว)
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return error || !sub ? null : String(sub);
});

export function toHousehold(h: any, role: "owner" | "member"): Household {
  const now = Date.now();
  const trial = Date.parse(h.trial_ends_at);
  const paid = h.paid_until ? Date.parse(h.paid_until) : 0;
  return {
    id: h.id,
    babyName: h.baby_name ?? "",
    unit: h.unit === "ml" ? "ml" : "oz",
    roomHours: Number(h.room_hours),
    coolerHours: Number(h.cooler_hours),
    fridgeDays: Number(h.fridge_days),
    freezerDays: Number(h.freezer_days),
    thawedHours: Number(h.thawed_hours),
    trialEndsAt: h.trial_ends_at,
    paidUntil: h.paid_until ?? null,
    isPremium: trial > now || paid > now,
    role,
  };
}

export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const userId = await getUserId();
  if (!userId) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("display_name, picture_url, consent_at").eq("id", userId).maybeSingle(),
    supabase.from("household_members").select("role, households(*)").eq("user_id", userId).order("created_at"),
  ]);
  const list = (rows ?? [])
    .filter((r: any) => r.households)
    .map((r: any) => ({ role: r.role as "owner" | "member", h: Array.isArray(r.households) ? r.households[0] : r.households }));

  const wanted = (await cookies()).get(HH_COOKIE)?.value;
  const current = list.find((x) => x.h.id === wanted) ?? list[0];

  let members: Member[] = [];
  if (current) {
    const { data: m } = await supabase
      .from("household_members")
      .select("user_id, role, profiles(display_name, picture_url)")
      .eq("household_id", current.h.id)
      .order("created_at");
    members = (m ?? []).map((r: any) => {
      const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return { id: r.user_id, name: p?.display_name ?? "", picture: p?.picture_url ?? null, role: r.role };
    });
  }

  return {
    userId,
    profile: {
      name: profile?.display_name ?? "",
      picture: profile?.picture_url ?? null,
      consentAt: profile?.consent_at ?? null,
    },
    households: list.map((x) => ({ id: x.h.id, babyName: x.h.baby_name ?? "", role: x.role })),
    household: current ? toHousehold(current.h, current.role) : null,
    members,
  };
});
