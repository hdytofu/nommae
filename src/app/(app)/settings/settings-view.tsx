"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { useMilk } from "@/components/milk-provider";
import { FREEZER_PRESETS, longDate, planText } from "@/lib/milk";
import type { FormState } from "@/lib/household";
import {
  createInviteAction, deleteAccountAction, leaveHouseholdAction, removeMemberAction, renameAction,
  revokeInviteAction, saveSettingsAction, signOutAction, switchHouseholdAction,
} from "./actions";

type Props = {
  households: { id: string; babyName: string; role: "owner" | "member" }[];
  myName: string;
  invites: { code: string; expiresAt: string }[];
  support: string;
  site: string;
};

export function SettingsView({ households, myName, invites, support, site }: Props) {
  const { household: h, now } = useMilk();
  return (
    <>
      {households.length > 1 && <Switcher households={households} current={h.id} />}
      <StorageSettings key={`${h.id}-${h.unit}-${h.freezerDays}-${h.babyName}`} />
      <Members invites={invites} origin={site} />
      <section className="card" id="plan">
        <h2>แพ็กเกจ</h2>
        {now > 0 && (
          <div className={`box ${planText(h, now).active ? "good" : "warn"}`}>{planText(h, now).label}</div>
        )}
        <ul className="hint" style={{ margin: 0, paddingLeft: "1.2em", listStyle: "disc" }}>
          <li>บันทึกปั๊มนม ดูสต็อก และวันหมดอายุ ใช้ได้ตลอด</li>
          <li>พรีเมียม: ชวนคนในบ้านมาบันทึกด้วยกัน และส่งออกไฟล์ข้อมูล</li>
        </ul>
        <p className="hint">ต่ออายุพรีเมียม: {support ? `ติดต่อ ${support}` : "ติดต่อผู้ดูแลระบบ"} (ระบบชำระเงินในแอพกำลังตามมา)</p>
      </section>
      <Account myName={myName} />
      <Guide />
    </>
  );
}

function Switcher({ households, current }: { households: Props["households"]; current: string }) {
  const [pending, start] = useTransition();
  return (
    <section className="card">
      <h2>สมุดนมที่เปิดอยู่</h2>
      <div className="opts">
        {households.map((x) => (
          <label className="opt" key={x.id}>
            <input type="radio" name="hh" checked={x.id === current} disabled={pending}
              onChange={() => start(() => switchHouseholdAction(x.id))} />
            <span>{x.babyName ? `น้อง${x.babyName}` : "ไม่มีชื่อ"}</span>
          </label>
        ))}
      </div>
    </section>
  );
}

function StorageSettings() {
  const { household: h } = useMilk();
  const [state, action, pending] = useActionState<FormState, FormData>(saveSettingsAction, {});
  const [freezer, setFreezer] = useState(String(h.freezerDays));
  const row = (id: string, name: string, label: string, small: string, val: number, unit: string) => (
    <div className="row-inp">
      <label className="txt" htmlFor={id}>{label}{small && <small>{small}</small>}</label>
      <input className="inp" id={id} name={name} type="number" inputMode="decimal" min="0.5" step="0.5" defaultValue={val} required />
      <span className="u">{unit}</span>
    </div>
  );
  return (
    <form action={action} className="card">
      <h2>สมุดนม</h2>
      <div className="field">
        <label htmlFor="s-baby">ชื่อเล่นลูก</label>
        <input className="inp" id="s-baby" name="babyName" maxLength={40} defaultValue={h.babyName} placeholder="เช่น ข้าวหอม" />
      </div>
      <fieldset>
        <legend>หน่วยปริมาณนม</legend>
        <div className="opts">
          <label className="opt"><input type="radio" name="unit" value="oz" defaultChecked={h.unit === "oz"} /><span>ออนซ์ (oz)</span></label>
          <label className="opt"><input type="radio" name="unit" value="ml" defaultChecked={h.unit === "ml"} /><span>มิลลิลิตร (ml)</span></label>
        </div>
        <p className="hint">ใช้ทั้งตอนบันทึกและแสดงผล ทุกคนในครอบครัวเห็นหน่วยเดียวกัน · 1 oz ≈ 30 ml</p>
      </fieldset>
      <div>
        <h2>ระยะเวลาเก็บนมแม่</h2>
        <p className="hint">ใช้คำนวณว่าแต่ละถุงต้องใช้ภายในเมื่อไร ค่าเริ่มต้นอ้างอิงแนวทางของ CDC และเลือกให้ปลอดภัยไว้ก่อน</p>
      </div>
      {row("s-room", "roomHours", "อุณหภูมิห้อง", "ห้องไม่เกิน 25°C · ถ้าห้องร้อนกว่านี้ ควรใช้ภายใน 1–2 ชม.", h.roomHours, "ชม.")}
      {row("s-cooler", "coolerHours", "กระติกน้ำแข็ง / ไอซ์แพ็ก", "กระเป๋าเก็บความเย็นที่มีไอซ์แพ็ก", h.coolerHours, "ชม.")}
      {row("s-fridge", "fridgeDays", "ตู้เย็นช่องธรรมดา", "ประมาณ 4°C · วางด้านในสุด ไม่วางที่ประตู", h.fridgeDays, "วัน")}
      {row("s-thawed", "thawedHours", "นมที่ละลายแล้ว (ในตู้เย็น)", "นับจากตอนละลายเสร็จ · ห้ามแช่แข็งซ้ำ", h.thawedHours, "ชม.")}
      <fieldset>
        <legend>ช่องแช่แข็งที่ใช้</legend>
        <div className="presets">
          {FREEZER_PRESETS.map((p) => (
            <label className="opt" key={p.days}>
              <input type="radio" name="fzPreset" checked={freezer === String(p.days)} onChange={() => setFreezer(String(p.days))} />
              <span><b>{p.label}</b><small>{p.sub}</small></span>
            </label>
          ))}
        </div>
        <div className="row-inp">
          <label className="txt" htmlFor="s-freezer">หรือกำหนดเอง</label>
          <input className="inp" id="s-freezer" name="freezerDays" type="number" inputMode="numeric" min="1" step="1"
            value={freezer} onChange={(e) => setFreezer(e.target.value)} required />
          <span className="u">วัน</span>
        </div>
      </fieldset>
      <p className={state.error ? "err" : "hint"} role="status">{state.error ?? state.ok ?? ""}</p>
      <button className="btn primary block" disabled={pending}>{pending ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button>
    </form>
  );
}

function Members({ invites, origin }: { invites: Props["invites"]; origin: string }) {
  const { household: h, members, meId, toast } = useMilk();
  const [code, setCode] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const isOwner = h.role === "owner";

  const link = (c: string) => `${origin}/join/${c}`;
  const shareText = (c: string) => `ชวนมาช่วยบันทึกสต็อกนม${h.babyName ? `ของน้อง${h.babyName}` : ""} กดลิงก์นี้เพื่อเข้าร่วม (ใช้ได้ 7 วัน)\n${link(c)}`;
  const copy = async (c: string) => {
    try { await navigator.clipboard.writeText(link(c)); toast("คัดลอกลิงก์แล้ว"); } catch { toast("คัดลอกไม่ได้ กดค้างที่ลิงก์เพื่อคัดลอก"); }
  };
  const create = () => start(async () => {
    setErr("");
    const r = await createInviteAction();
    if (r.error) setErr(r.error); else setCode(r.code ?? null);
  });
  const shown = code ? [{ code, expiresAt: "" }, ...invites.filter((i) => i.code !== code)] : invites;

  return (
    <section className="card" id="members">
      <h2>สมาชิกในครอบครัว</h2>
      <ul className="members">
        {members.map((m) => (
          <li key={m.id}>
            {m.picture
              // eslint-disable-next-line @next/next/no-img-element -- รูปโปรไฟล์ LINE ขนาดเล็ก ไม่ต้องผ่านตัวย่อรูป
              ? <img className="avatar" src={m.picture} alt="" referrerPolicy="no-referrer" />
              : <span className="avatar" aria-hidden="true">{(m.name || "?").slice(0, 1)}</span>}
            <span className="nm">
              {m.name || "ไม่มีชื่อ"}{m.id === meId && <span className="muted"> (คุณ)</span>}
              {m.role === "owner" && <span className="pill" style={{ marginLeft: 6 }}>เจ้าของ</span>}
            </span>
            {isOwner && m.id !== meId && (
              <button className="btn ghost" style={{ color: "var(--bad)", minHeight: 36, padding: "4px 10px" }} disabled={pending}
                onClick={() => start(async () => { const r = await removeMemberAction(m.id); if (r.error) toast(r.error); })}>
                เอาออก
              </button>
            )}
          </li>
        ))}
      </ul>

      {h.isPremium ? (
        <>
          <p className="hint">ส่งลิงก์เชิญให้พ่อ ยาย หรือพี่เลี้ยง เข้าร่วมแล้วจะเห็นและบันทึกสต็อกเดียวกัน ลิงก์ใช้ได้ 7 วัน</p>
          {shown.map((i) => (
            <div key={i.code} className="field">
              <div className="copybox">
                <span>{link(i.code)}</span>
                <button className="btn" style={{ minHeight: 36 }} onClick={() => copy(i.code)}>คัดลอก</button>
              </div>
              <div className="btns">
                <a className="btn line" style={{ minHeight: 36, fontSize: ".9rem" }} href={`https://line.me/R/msg/text/?${encodeURIComponent(shareText(i.code))}`} target="_blank" rel="noopener">ส่งทาง LINE</a>
                <button className="btn ghost" style={{ minHeight: 36 }} disabled={pending} onClick={() => start(async () => { await revokeInviteAction(i.code); if (i.code === code) setCode(null); })}>
                  ยกเลิกลิงก์
                </button>
                {i.expiresAt && <span className="hint" style={{ alignSelf: "center" }}>ใช้ได้ถึง {longDate(Date.parse(i.expiresAt))}</span>}
              </div>
            </div>
          ))}
          {!code && <button className="btn primary" onClick={create} disabled={pending}>{pending ? "กำลังสร้าง…" : "สร้างลิงก์เชิญ"}</button>}
          {err && <p className="err">{err}</p>}
        </>
      ) : (
        <div className="box warn">แพ็กเกจหมดอายุ ต่ออายุพรีเมียมเพื่อชวนคนเพิ่ม สมาชิกเดิมยังใช้ได้ตามปกติ</div>
      )}
      {!isOwner && (
        <button className="btn ghost" style={{ color: "var(--bad)" }} disabled={pending}
          onClick={() => start(async () => { const r = await leaveHouseholdAction(); if (r?.error) toast(r.error); })}>
          ออกจากครอบครัวนี้
        </button>
      )}
    </section>
  );
}

function Account({ myName }: { myName: string }) {
  const { household: h, exportCsv } = useMilk();
  const [renameState, rename, renaming] = useActionState<FormState, FormData>(renameAction, {});
  const [delState, del, deleting] = useActionState<FormState, FormData>(deleteAccountAction, {});
  const [askDelete, setAskDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [, start] = useTransition();
  return (
    <section className="card">
      <h2>บัญชีของฉัน</h2>
      <form action={rename} className="field">
        <label htmlFor="s-name">ชื่อที่คนในบ้านเห็น</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="inp" id="s-name" name="name" maxLength={80} defaultValue={myName} placeholder="เช่น แม่ปุ้ย" />
          <button className="btn" disabled={renaming}>บันทึก</button>
        </div>
        <p className={renameState.error ? "err" : "hint"} role="status">{renameState.error ?? renameState.ok ?? ""}</p>
      </form>
      <div className="btns">
        <button className="btn" disabled={!h.isPremium || exporting}
          onClick={async () => { setExporting(true); await exportCsv(); setExporting(false); }}>
          {exporting ? "กำลังเตรียมไฟล์…" : "ดาวน์โหลดข้อมูล (CSV)"}
        </button>
        <button className="btn" onClick={() => start(() => signOutAction())}>ออกจากระบบ</button>
        <Link className="btn ghost" href="/welcome?new=1">+ สร้างสมุดนมเล่มใหม่</Link>
      </div>
      {!h.isPremium && <p className="hint">การส่งออกไฟล์ใช้ได้ในแพ็กเกจพรีเมียม</p>}
      <p className="hint"><Link className="link" href="/privacy">นโยบายความเป็นส่วนตัว</Link></p>
      {askDelete ? (
        <form action={del} className="field">
          <div className="box bad">
            ลบบัญชีถาวร ข้อมูลบัญชีจะหายทันที สมุดนมที่มีคุณคนเดียวจะถูกลบทั้งเล่ม ถ้ามีคนอื่นอยู่ด้วย สมุดจะยังอยู่กับเขา
          </div>
          <label htmlFor="s-confirm">พิมพ์คำว่า <b>ลบ</b> เพื่อยืนยัน</label>
          <input className="inp" id="s-confirm" name="confirm" autoComplete="off" />
          <p className="err" role="alert">{delState.error ?? ""}</p>
          <div className="btns">
            <button className="btn danger" disabled={deleting}>{deleting ? "กำลังลบ…" : "ลบบัญชีถาวร"}</button>
            <button type="button" className="btn" onClick={() => setAskDelete(false)}>ยกเลิก</button>
          </div>
        </form>
      ) : (
        <button className="btn ghost" style={{ color: "var(--bad)", alignSelf: "flex-start" }} onClick={() => setAskDelete(true)}>ลบบัญชีและข้อมูล</button>
      )}
    </section>
  );
}

function Guide() {
  return (
    <section className="card guide">
      <h2>เก็บนมแม่ให้ปลอดภัย</h2>
      <ul>
        <li>ล้างมือให้สะอาดก่อนปั๊มนมและก่อนหยิบถุงนม</li>
        <li>เขียนวันที่และเวลาที่ปั๊มบนถุงทุกครั้ง แล้วใช้ถุงที่เก่าที่สุดก่อน</li>
        <li>แช่แข็งถุงนมแบบวางนอน และเว้นที่ว่างด้านบนถุง เพราะนมจะขยายตัวเมื่อแข็ง</li>
        <li>ละลายนมในตู้เย็นข้ามคืน หรือแช่ถุงในน้ำอุ่น ห้ามใช้ไมโครเวฟ</li>
        <li>นมที่ละลายแล้วห้ามนำกลับไปแช่แข็งอีก</li>
        <li>นมที่ลูกกินเหลือ ใช้ได้อีกไม่เกิน 2 ชั่วโมงหลังลูกกินเสร็จ จากนั้นให้ทิ้ง</li>
      </ul>
      <p className="hint">
        ที่มา: <a href="https://www.cdc.gov/breastfeeding/breast-milk-preparation-and-storage/handling-breastmilk.html" target="_blank" rel="noopener">CDC · Breast Milk Storage and Preparation</a>{" "}
        แอพนี้ช่วยจดบันทึกเท่านั้น หากไม่แน่ใจ ปรึกษาแพทย์หรือพยาบาล
      </p>
    </section>
  );
}
