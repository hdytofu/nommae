"use client";

import { useState } from "react";
import { BagIcon } from "@/components/bag-icon";
import { BagRow, dotStyle } from "@/components/bag-row";
import { useMilk } from "@/components/milk-provider";
import { LoadNote } from "@/components/top-bar";
import {
  ACTIVE, PLACES, avgDailyUse, bagName, byExpiry, dayName, dur, remainText, sessionsOf, startOfDay, status, sumMl, time,
  type ActivePlace,
} from "@/lib/milk";

type Filter = "all" | "fridge" | "freezer" | "other" | "expired";
const ORDER: ActivePlace[] = ["freezer", "fridge", "thawed", "cooler", "room"];

export function StockView() {
  const { household, fmt, bags, loaded, now, open } = useMilk();
  const [filter, setFilter] = useState<Filter>("all");

  if (!loaded || !now) return <LoadNote />;

  const active = bags.filter((b) => b.active && ACTIVE.includes(b.place as ActivePlace)).sort(byExpiry(household));
  const fresh = active.filter((b) => status(b, household, now) !== "expired");
  const expired = active.filter((b) => status(b, household, now) === "expired");
  const total = sumMl(fresh);

  if (!bags.length) {
    return (
      <div className="empty">
        <BagIcon ml={0} place="fridge" scale={2} />
        <h2>ยังไม่มีนมในสต็อก</h2>
        <p>ทุกครั้งที่ปั๊มนม กด “บันทึกปั๊มนม” แล้วเลือกว่าเก็บที่ไหน แอพจะนับยอดสต็อก บอกวันหมดอายุของแต่ละถุง และบอกว่าถุงไหนควรใช้ก่อน</p>
        <button className="btn primary" onClick={() => open({ type: "add" })}>บันทึกปั๊มนมครั้งแรก</button>
      </div>
    );
  }

  const groups = ORDER.map((p) => {
    const bs = fresh.filter((b) => b.place === p);
    return { p, ml: sumMl(bs), n: bs.length };
  }).filter((g) => g.n);
  const avg = avgDailyUse(bags, now);
  const today0 = startOfDay(now);
  const todaySessions = sessionsOf(bags.filter((b) => b.pumpedAt >= today0 && b.pumpedAt <= now + 5 * 60e3));
  const todayMl = todaySessions.reduce((a, s) => a + s.ml, 0);
  const lastPump = bags.reduce((m, b) => (b.pumpedAt <= now + 60e3 && b.pumpedAt > m ? b.pumpedAt : m), 0);
  const justNow = lastPump && now - lastPump < 60e3;

  const counts: Record<Filter, number> = {
    all: active.length,
    fridge: active.filter((b) => b.place === "fridge").length,
    freezer: active.filter((b) => b.place === "freezer").length,
    other: active.filter((b) => ["room", "cooler", "thawed"].includes(b.place)).length,
    expired: expired.length,
  };
  const f: Filter = filter === "expired" && !expired.length ? "all" : filter;
  const shown = active.filter((b) => {
    switch (f) {
      case "fridge": return b.place === "fridge";
      case "freezer": return b.place === "freezer";
      case "other": return ["room", "cooler", "thawed"].includes(b.place);
      case "expired": return status(b, household, now) === "expired";
    }
    return true;
  });
  const next = fresh[0];
  const days = avg > 0 ? total / avg : 0;

  return (
    <>
      <section className="hero" aria-label="สรุปสต็อก">
        <div className="eyebrow">นมในสต็อกที่ยังใช้ได้</div>
        <div className="big"><span className="n">{fmt.amtNum(total)}</span><span className="u">{fmt.unitName}</span></div>
        <div className="sub">≈ {fmt.alt(total)} · {fresh.length} ถุง</div>
        {total > 0 && (
          <>
            <div className="stack" role="img" aria-label={groups.map((g) => `${PLACES[g.p].short} ${fmt.amt(g.ml)}`).join(", ")}>
              {groups.map((g) => <i key={g.p} style={{ flex: g.ml, background: PLACES[g.p].color }} />)}
            </div>
            <ul className="legend">
              {groups.map((g) => (
                <li key={g.p}>
                  <span className="sw" style={dotStyle(PLACES[g.p].color)} />
                  <span>{PLACES[g.p].short} <b>{fmt.amt(g.ml)}</b> <span className="muted">· {g.n} ถุง</span></span>
                </li>
              ))}
            </ul>
          </>
        )}
        {avg > 0 && total > 0 && (
          <p className="supply">
            พอป้อนได้ประมาณ <b>{days < 10 ? days.toFixed(1) : Math.round(days)} วัน</b>{" "}
            <span className="muted">· ลูกกินเฉลี่ย {fmt.amt(avg)}/วัน (7 วันล่าสุด)</span>
          </p>
        )}
      </section>

      <section className="today">
        <div className="stat">
          <span className="eyebrow">วันนี้ปั๊มได้</span>
          <span className="v">{fmt.amt(todayMl)}</span>
          <span className="s">{todaySessions.length ? `${todaySessions.length} ครั้ง · ≈ ${fmt.alt(todayMl)}` : "ยังไม่ได้บันทึก"}</span>
        </div>
        <div className="stat">
          <span className="eyebrow">ปั๊มล่าสุด</span>
          <span className="v">{lastPump ? (justNow ? "เมื่อสักครู่" : dur(now - lastPump)) : "—"}</span>
          <span className="s">{lastPump ? (justNow ? time(lastPump) : `ที่แล้ว · ${dayName(lastPump, now)} ${time(lastPump)}`) : "ยังไม่มีข้อมูล"}</span>
        </div>
      </section>

      {expired.length > 0 && (
        <button className="alert" onClick={() => setFilter("expired")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17v.5" strokeLinecap="round" /></svg>
          <span>{expired.length} ถุงเกินระยะเก็บแล้ว ({fmt.amt(sumMl(expired))}) แตะเพื่อดูและทิ้ง</span>
        </button>
      )}

      {next && <NextBag id={next.id} />}

      <section className="list-head">
        <h2>ถุงนมในสต็อก</h2>
        <div className="chips" role="group" aria-label="กรองตามที่เก็บ">
          {([["all", "ทั้งหมด"], ["fridge", "ตู้เย็น"], ["freezer", "ช่องแข็ง"], ["other", "ละลาย/ห้อง/กระติก"], ["expired", "เกินระยะเก็บ"]] as [Filter, string][])
            .filter(([k]) => k === "all" || counts[k])
            .map(([k, l]) => (
              <button key={k} className="chip" aria-pressed={f === k} onClick={() => setFilter(k)}>{l} {counts[k]}</button>
            ))}
        </div>
      </section>
      {shown.length ? (
        <ul className="bags">{shown.map((b) => <BagRow key={b.id} bag={b} />)}</ul>
      ) : (
        <p className="muted">{active.length ? "ไม่มีถุงนมในหมวดนี้" : "ตอนนี้ไม่มีนมในสต็อก ดูประวัติการปั๊มและป้อนได้ที่แท็บประวัติ"}</p>
      )}
    </>
  );
}

function NextBag({ id }: { id: string }) {
  const { byId, household, fmt, now, move, open } = useMilk();
  const [busy, setBusy] = useState(false);
  const b = byId.get(id);
  if (!b) return null;
  const st = status(b, household, now);
  const run = async (kind: "use" | "thaw") => { setBusy(true); await move(b.id, kind); setBusy(false); };
  return (
    <section className="next" aria-label="ถุงที่ควรใช้ต่อไป">
      <div className="eyebrow">ถุงที่ควรใช้ต่อไป</div>
      <div className="next-row">
        <BagIcon ml={b.ml} place={b.place} scale={1.25} />
        <div className="main">
          <div className="lbl">{bagName(b.pumpedAt)}</div>
          <div className="sub"><span className="dot" style={dotStyle(PLACES[b.place].color)} /> {PLACES[b.place].short} · <span className={`pill ${st}`}>{remainText(b, household, now)}</span></div>
        </div>
        <div className="ml">{fmt.amt(b.ml)}</div>
      </div>
      <div className="btns">
        {b.place === "freezer"
          ? <button className="btn primary" disabled={busy} onClick={() => run("thaw")}>นำออกมาละลาย</button>
          : <button className="btn primary" disabled={busy} onClick={() => run("use")}>ป้อนลูกแล้ว</button>}
        <button className="btn ghost" onClick={() => open({ type: "bag", id: b.id })}>ตัวเลือกอื่น</button>
      </div>
    </section>
  );
}
