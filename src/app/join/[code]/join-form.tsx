"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/lib/household-actions";
import type { FormState } from "@/lib/household";
import { ConsentCheck } from "@/app/welcome/welcome-forms";

export function JoinForm({ code, babyName, needConsent }: { code: string; babyName: string; needConsent: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(acceptInviteAction, {});
  return (
    <form action={action} className="card">
      <input type="hidden" name="code" value={code} />
      <p>
        คุณได้รับเชิญให้ช่วยบันทึกสต็อกนมของ<b>{babyName ? `น้อง${babyName}` : "ครอบครัวนี้"}</b> เข้าร่วมแล้วจะเห็นและบันทึกถุงนมชุดเดียวกับคนอื่นในบ้าน
      </p>
      {needConsent && <ConsentCheck />}
      <p className="err" role="alert">{state.error ?? ""}</p>
      <button className="btn primary block" disabled={pending}>{pending ? "กำลังเข้าร่วม…" : "เข้าร่วม"}</button>
    </form>
  );
}
