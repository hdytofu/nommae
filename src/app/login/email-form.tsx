"use client";

import { useActionState } from "react";
import { sendMagicLink, type MagicLinkState } from "./actions";

export function EmailForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<MagicLinkState, FormData>(sendMagicLink, {});
  if (state.sent) {
    return (
      <div className="box good">
        ส่งลิงก์เข้าสู่ระบบไปที่ <b>{state.sent}</b> แล้ว เปิดอีเมลบนเครื่องนี้แล้วกดลิงก์ได้เลย
      </div>
    );
  }
  return (
    <form action={action} className="field">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="email">เข้าสู่ระบบด้วยอีเมล</label>
      <input className="inp" id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" required />
      <p className="err" role="alert">{state.error ?? ""}</p>
      <button className="btn block" type="submit" disabled={pending}>
        {pending ? "กำลังส่ง…" : "ส่งลิงก์เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
