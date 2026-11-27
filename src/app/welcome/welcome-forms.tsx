"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createHouseholdAction, goToInviteAction } from "@/lib/household-actions";
import type { FormState } from "@/lib/household";
import { FREEZER_PRESETS } from "@/lib/milk";

export function ConsentCheck() {
  return (
    <label className="check">
      <input type="checkbox" name="consent" required />
      <span>
        ฉันยอมรับ <Link className="link" href="/privacy" target="_blank">นโยบายความเป็นส่วนตัว</Link> และยินยอมให้เก็บข้อมูลการปั๊มนมเพื่อใช้ในแอพนี้
      </span>
    </label>
  );
}

export function WelcomeForms({ needConsent, showJoin }: { needConsent: boolean; showJoin: boolean }) {
  const [state, create, creating] = useActionState<FormState, FormData>(createHouseholdAction, {});
  const [joinState, join, joining] = useActionState<FormState, FormData>(goToInviteAction, {});
  return (
    <>
      <form action={create} className="card">
        <h2>สร้างสมุดนมของลูก</h2>
        <div className="field">
          <label htmlFor="babyName">ชื่อเล่นลูก</label>
          <input className="inp" id="babyName" name="babyName" maxLength={40} placeholder="เช่น ข้าวหอม" />
        </div>
        <fieldset>
          <legend>หน่วยที่ใช้บันทึก</legend>
          <div className="opts">
            <label className="opt"><input type="radio" name="unit" value="oz" defaultChecked /><span>ออนซ์ (oz)</span></label>
            <label className="opt"><input type="radio" name="unit" value="ml" /><span>มิลลิลิตร (ml)</span></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>ช่องแช่แข็งที่บ้านเป็นแบบไหน</legend>
          <div className="presets">
            {FREEZER_PRESETS.map((p) => (
              <label className="opt" key={p.days}>
                <input type="radio" name="freezerDays" value={p.days} defaultChecked={p.days === 90} />
                <span><b>{p.label}</b><small>เก็บได้ {p.sub}</small></span>
              </label>
            ))}
          </div>
          <p className="hint">ใช้คำนวณวันหมดอายุของถุงที่แช่แข็ง เปลี่ยนภายหลังได้ที่หน้าตั้งค่า</p>
        </fieldset>
        {needConsent && <ConsentCheck />}
        <p className="err" role="alert">{state.error ?? ""}</p>
        <button className="btn primary block" disabled={creating}>{creating ? "กำลังสร้าง…" : "เริ่มใช้งาน · ทดลองฟรี 30 วัน"}</button>
      </form>

      {showJoin && (
        <form action={join} className="card">
          <h2>มีโค้ดเชิญจากครอบครัว</h2>
          <p className="hint">ถ้าแม่หรือคนในบ้านส่งลิงก์เชิญมา กดลิงก์นั้นได้เลย หรือพิมพ์โค้ด 8 ตัวที่นี่</p>
          <input className="inp code" name="code" maxLength={12} autoCapitalize="characters" autoComplete="off" placeholder="ABCD2345" aria-label="โค้ดเชิญ" />
          <p className="err" role="alert">{joinState.error ?? ""}</p>
          <button className="btn block" disabled={joining}>เข้าร่วมครอบครัว</button>
        </form>
      )}
    </>
  );
}
