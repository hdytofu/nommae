import "server-only";
import { cookies } from "next/headers";
import { HH_COOKIE } from "@/lib/app-context";

export type FormState = { error?: string; ok?: string };

const RPC_ERRORS: [string, string][] = [
  ["invite_invalid", "โค้ดเชิญไม่ถูกต้องหรือหมดอายุแล้ว ขอโค้ดใหม่จากเจ้าของครอบครัว"],
  ["premium_required", "แพ็กเกจของครอบครัวนี้หมดอายุ ให้เจ้าของครอบครัวต่ออายุก่อนจึงจะเชิญคนเพิ่มได้"],
  ["household_full", "ครอบครัวนี้มีสมาชิกครบ 8 คนแล้ว"],
  ["too_many_households", "สร้างครอบครัวได้สูงสุด 5 ครอบครัวต่อบัญชี"],
  ["not_member", "คุณไม่ได้เป็นสมาชิกครอบครัวนี้"],
];
export function rpcMessage(message: string | undefined) {
  const hit = RPC_ERRORS.find(([k]) => message?.includes(k));
  return hit ? hit[1] : "ทำรายการไม่สำเร็จ ลองใหม่อีกครั้ง";
}

export async function setCurrentHousehold(id: string) {
  (await cookies()).set(HH_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
