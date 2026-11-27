"use client";

import { useState } from "react";
import { BagIcon } from "@/components/bag-icon";
import { BagRow, dotStyle } from "@/components/bag-row";
import { useMilk, type MoveKind } from "@/components/milk-provider";
import {
  ACTIVE, PLACES, SIDES, bagLabel, bagName, expiry, remainText, spanText, status, sumMl, toLocalInput,
  type ActivePlace, type Bag,
} from "@/lib/milk";

function CloseButton() {
  const { close } = useMilk();
  return (
    <button className="x" onClick={close} aria-label="ปิด">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
  );
}

// ---------------------------------------------------------------- รายละเอียดถุง
export function BagSheet({ bag: b }: { bag: Bag }) {
  const { household, fmt, now, move, remove, open, close, nameOf } = useMilk();
  const [busy, setBusy] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const st = status(b, household, now);
  const e = expiry(b, household);
  const who = nameOf(b.createdBy);

  const act = async (kind: MoveKind) => {
    setBusy(true);
    const ok = await move(b.id, kind);
    setBusy(false);
    if (ok) close();
  };
  const del = async () => {
    setBusy(true);
    const ok = await remove(b.id);
    setBusy(false);
    if (ok) close();
  };

  const facts: [string, React.ReactNode][] = [
    ["ตอนนี้", <><span className="dot" style={dotStyle(PLACES[b.place].color)} />{b.direct ? "ป้อนลูกทันทีหลังปั๊ม" : PLACES[b.place].label}</>],
  ];
  if (e) facts.push(["ควรใช้ภายใน", <>{bagName(e)} <span className={`pill ${st}`}>{remainText(b, household, now)}</span></>]);
  if (b.thawedAt) facts.push(["ละลายเมื่อ", bagName(b.thawedAt)]);
  if (b.doneAt && !b.direct) facts.push([b.place === "used" ? "ป้อนเมื่อ" : "ทิ้งเมื่อ", bagName(b.doneAt)]);
  facts.push(["เขียนบนถุง", <span className="num" key="l">{bagLabel(b.pumpedAt)}</span>]);
  if (b.side) facts.push(["ข้าง", SIDES[b.side]]);
  if (b.note) facts.push(["หมายเหตุ", b.note]);
  if (who) facts.push(["บันทึกโดย", who]);

  return (
    <>
      <div className="sheet-h">
        <BagIcon ml={b.ml} place={b.place} scale={1.5} />
        <div className="main">
          <h2>ถุง {bagName(b.pumpedAt)}</h2>
          <div className="meta">{fmt.amt(b.ml)} · ≈ {fmt.alt(b.ml)}</div>
        </div>
        <CloseButton />
      </div>
      <dl className="facts">
        {facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {st === "expired" && <div className="box bad">ถุงนี้เกินระยะเก็บแล้ว ไม่ควรนำไปป้อนลูก</div>}
      {st !== "expired" && b.place === "thawed" && (
        <div className="box info">นมที่ละลายแล้วห้ามนำกลับไปแช่แข็งอีก ใช้ให้หมดภายในเวลาที่กำหนด</div>
      )}

      {b.active ? (
        <>
          {st === "expired" ? (
            <button className="btn danger block" disabled={busy} onClick={() => act("discard")}>ทิ้งถุงนี้</button>
          ) : b.place === "freezer" ? (
            <button className="btn primary block" disabled={busy} onClick={() => act("thaw")} autoFocus>นำออกมาละลาย</button>
          ) : (
            <button className="btn primary block" disabled={busy} onClick={() => act("use")} autoFocus>ป้อนลูกแล้ว</button>
          )}
          <div className="btns">
            {b.place === "freezer" && st !== "expired" && <button className="btn" disabled={busy} onClick={() => act("use")}>ป้อนลูกแล้ว</button>}
            {(b.place === "room" || b.place === "cooler") && <button className="btn" disabled={busy} onClick={() => act("fridge")}>ย้ายเข้าตู้เย็น</button>}
            {(b.place === "room" || b.place === "cooler" || b.place === "fridge") && (
              <button className="btn" disabled={busy} onClick={() => act("freezer")}>ย้ายเข้าช่องแช่แข็ง</button>
            )}
            <button className="btn" disabled={busy} onClick={() => open({ type: "edit", id: b.id })}>แก้ไข</button>
            {st !== "expired" && <button className="btn" disabled={busy} onClick={() => act("discard")}>ทิ้ง</button>}
          </div>
        </>
      ) : (
        <div className="btns">
          <button className="btn" disabled={busy} onClick={() => act("restore")}>ย้อนกลับเข้าสต็อก</button>
          <button className="btn" disabled={busy} onClick={() => open({ type: "edit", id: b.id })}>แก้ไข</button>
        </div>
      )}

      {askDelete ? (
        <div>
          <div className="box warn">ลบรายการนี้ออกถาวร ใช้เมื่อบันทึกผิดเท่านั้น</div>
          <div className="btns" style={{ marginTop: 8 }}>
            <button className="btn danger" disabled={busy} onClick={del}>ยืนยันลบ</button>
            <button className="btn" onClick={() => setAskDelete(false)}>ยกเลิก</button>
          </div>
        </div>
      ) : (
        <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={() => setAskDelete(true)}>ลบรายการนี้ (บันทึกผิด)</button>
      )}
    </>
  );
}

// ---------------------------------------------------------------- ปั๊มครั้งเดียวที่แบ่งหลายถุง
export function SessionSheet({ sessionKey }: { sessionKey: string }) {
  const { bags, fmt } = useMilk();
  const list = bags.filter((b) => (b.sessionId || b.id) === sessionKey).sort((a, b) => a.ml - b.ml);
  if (!list.length) return null;
  return (
    <>
      <div className="sheet-h">
        <div className="main">
          <h2>ปั๊มเมื่อ {bagName(list[0].pumpedAt)}</h2>
          <div className="meta">รวม {fmt.amt(sumMl(list))} · แบ่ง {list.length} ถุง</div>
        </div>
        <CloseButton />
      </div>
      <ul className="bags">{list.map((b) => <BagRow key={b.id} bag={b} />)}</ul>
    </>
  );
}

// ---------------------------------------------------------------- บันทึก/แก้ไข
function lsGet(k: string, d: string) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* โหมดส่วนตัว */ } }
const FORM_PLACES = ["fridge", "freezer", "room", "cooler", "feed"];
const isFuture = (t: number) => t > Date.now() + 5 * 60e3;

export function PumpForm({ bag }: { bag?: Bag }) {
  const { household: st, fmt, addPump, editBag, close, toast } = useMilk();
  const edit = !!bag;
  const [openedAt] = useState(() => Date.now());
  const [timeStr, setTimeStr] = useState(() => toLocalInput(bag ? bag.pumpedAt : openedAt));
  const [amount, setAmount] = useState(() => (bag ? String(+fmt.toUnit(bag.ml).toFixed(fmt.isOz ? 1 : 0)) : ""));
  const [side, setSide] = useState<string>(bag?.side ?? "");
  const [place, setPlace] = useState<string>(() => {
    if (bag) return bag.direct ? "feed" : bag.place;
    const last = lsGet("nommae.place", "fridge");
    return FORM_PLACES.includes(last) ? last : "fridge";
  });
  const [n, setN] = useState(1);
  const [note, setNote] = useState(bag?.note ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const stepV = fmt.isOz ? 0.5 : 10;
  const v = Number(amount) || 0;
  const t = new Date(timeStr).getTime() || openedAt;
  const m = fmt.fromInput(v);
  const parts = v > 0 && !edit ? fmt.splitInput(v, n) : [m];
  const lo = Math.min(...parts), hi = Math.max(...parts);

  let placeOpts: [string, string][] = [
    ["fridge", `เก็บได้ ${spanText(st.fridgeDays * 24)}`],
    ["freezer", `เก็บได้ ${spanText(st.freezerDays * 24)}`],
    ["room", `ใช้ภายใน ${spanText(st.roomHours)}`],
    ["cooler", `ใช้ภายใน ${spanText(st.coolerHours)}`],
  ];
  if (edit && bag.place === "thawed") {
    // นมที่ละลายแล้วย้ายกลับช่องแช่แข็งไม่ได้
    placeOpts = [["thawed", `ใช้ภายใน ${spanText(st.thawedHours)} หลังละลาย`], ["fridge", "ยังไม่ได้ละลาย"], placeOpts[2], placeOpts[3]];
  }
  if (!edit) placeOpts.push(["feed", "ไม่เข้าสต็อก นับเป็นยอดป้อน"]);
  const showPlace = !edit || bag.active;

  const step = (d: number) => {
    const nv = Math.max(0, v + d);
    setAmount(nv ? String(+nv.toFixed(fmt.isOz ? 1 : 0)) : "");
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const lim = fmt.isOz ? [0.1, 70] : [1, 2000];
    if (!Number.isFinite(new Date(timeStr).getTime())) return setErr("กรุณาใส่วันเวลาที่ปั๊ม");
    if (isFuture(t)) return setErr("เวลาที่ปั๊มต้องไม่อยู่ในอนาคต");
    if (!v || v < lim[0] || v > lim[1]) return setErr(`กรุณาใส่ปริมาณนม (${lim[0]}–${lim[1].toLocaleString("th-TH")} ${fmt.unitThai})`);
    if (!edit && parts.some((x) => x <= 0)) return setErr("ปริมาณน้อยเกินกว่าจะแบ่งเป็นหลายถุง");
    setErr("");
    setBusy(true);
    let ok: boolean;
    if (edit) {
      const patch: Record<string, unknown> = { pumped_at: new Date(t).toISOString(), ml: m, side: side || null, note: note.trim() };
      if (bag.active && place !== bag.place && ACTIVE.includes(place as ActivePlace)) {
        patch.place = place;
        if (place === "thawed" && !bag.thawedAt) patch.thawed_at = new Date().toISOString();
      }
      ok = await editBag(bag.id, patch);
      if (ok) toast("แก้ไขแล้ว");
    } else {
      lsSet("nommae.place", place);
      ok = await addPump({ pumpedAt: t, side: side || null, place: place as ActivePlace | "feed", note: note.trim() }, parts);
    }
    setBusy(false);
    if (ok) close();
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: "contents" }}>
      <div className="sheet-h"><div className="main"><h2>{edit ? "แก้ไขถุงนม" : "บันทึกปั๊มนม"}</h2></div><CloseButton /></div>

      <div className="field">
        <label htmlFor="f-time">เวลาที่ปั๊ม</label>
        <input className="inp" id="f-time" type="datetime-local" value={timeStr} max={toLocalInput(openedAt + 5 * 60e3)} onChange={(e) => setTimeStr(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="f-amount">{edit ? "ปริมาณในถุง" : "ปริมาณที่ปั๊มได้ (รวม)"} · {fmt.unitThai}</label>
        <div className="mlbox">
          <button type="button" className="btn" onClick={() => step(-stepV)} aria-label={`ลด ${stepV} ${fmt.unitName}`}>−{stepV}</button>
          <input className="inp" id="f-amount" type="number" inputMode="decimal" min={fmt.isOz ? 0.1 : 1} max={fmt.isOz ? 70 : 2000}
            step={fmt.isOz ? 0.1 : 1} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus={!edit} />
          <button type="button" className="btn" onClick={() => step(stepV)} aria-label={`เพิ่ม ${stepV} ${fmt.unitName}`}>+{stepV}</button>
        </div>
        <div className="ozhint">{v ? `${fmt.unitName} · ≈ ${fmt.alt(m)}` : fmt.unitName}</div>
        <div className="opts" role="group" aria-label="ปริมาณที่ใช้บ่อย">
          {(fmt.isOz ? [1, 2, 3, 4, 5, 6] : [60, 90, 120, 150, 180, 240]).map((p) => (
            <button type="button" className="chip" key={p} onClick={() => setAmount(String(p))}>{p}</button>
          ))}
        </div>
      </div>

      <fieldset>
        <legend>ข้างที่ปั๊ม</legend>
        <div className="opts">
          {[["", "ไม่ระบุ"], ["L", "ซ้าย"], ["R", "ขวา"], ["B", "สองข้าง"]].map(([val, label]) => (
            <label className="opt" key={val}>
              <input type="radio" name="side" value={val} checked={side === val} onChange={() => setSide(val)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {showPlace && (
        <fieldset>
          <legend>{edit ? "ที่เก็บตอนนี้" : "เก็บที่"}</legend>
          <div className="places">
            {placeOpts.map(([p, sub]) => (
              <label className="opt" key={p}>
                <input type="radio" name="place" value={p} checked={place === p} onChange={() => setPlace(p)} />
                <span>
                  <b>{p !== "feed" && <span className="dot" style={dotStyle(PLACES[p as ActivePlace].color)} />}{p === "feed" ? "ป้อนลูกทันที" : PLACES[p as ActivePlace].short}</b>
                  <small>{sub}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {!edit && (
        <div className="field">
          <span className="lab">แบ่งใส่ถุง</span>
          <div className="split">
            <button type="button" className="btn" onClick={() => setN(Math.max(1, n - 1))} aria-label="ลดจำนวนถุง">−</button>
            <span className="n">{n}</span>
            <button type="button" className="btn" onClick={() => setN(Math.min(8, n + 1))} aria-label="เพิ่มจำนวนถุง">+</button>
            <span className="muted">{v && n > 1 ? `ถุงละ ${fmt.amtNum(lo) === fmt.amtNum(hi) ? fmt.amt(lo) : `${fmt.amtNum(lo)}–${fmt.amt(hi)}`}` : ""}</span>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="f-note">หมายเหตุ</label>
        <input className="inp" id="f-note" maxLength={120} placeholder="เช่น ปั๊มที่ทำงาน" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="labelprev">
        {place === "feed"
          ? <>ป้อนลูกทันที {v ? fmt.amt(m) : ""} ไม่ต้องเขียนถุง</>
          : <>เขียนบนถุง: <b>{bagLabel(t)}</b>{v ? <> · <b>{fmt.amt(hi)}</b></> : null}</>}
      </div>
      <p className="err" role="alert">{err}</p>
      <button type="submit" className="btn primary block" disabled={busy}>{busy ? "กำลังบันทึก…" : edit ? "บันทึกการแก้ไข" : "บันทึก"}</button>
    </form>
  );
}
