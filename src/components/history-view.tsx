"use client";

import { useState } from "react";
import { useMilk } from "@/components/milk-provider";
import { LoadNote } from "@/components/top-bar";
import {
  HISTORY_DAYS, PLACES, SIDES, addDays, bagName, day, dayKey, dayName, fmtNum, sessionsOf, startOfDay, sumMl, time,
  type Bag, type Fmt, type PumpSession,
} from "@/lib/milk";

type DayStat = { s: number; ml: number; n: number };

function niceScale(max: number, isOz: boolean) {
  if (max <= 0) return isOz ? { top: 12, step: 3 } : { top: 400, step: 100 };
  const raw = max / 4, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * mag;
  return { step, top: Math.ceil(max / step) * step };
}

function Chart({ days, sel, onSel, fmt, now }: { days: DayStat[]; sel: number; onSel: (i: number) => void; fmt: Fmt; now: number }) {
  const W = 340, Ht = 170, L = 34, R = 4, T = 20, B = 24;
  const pw = W - L - R, ph = Ht - T - B;
  const { step, top } = niceScale(Math.max(...days.map((d) => fmt.toUnit(d.ml))), fmt.isOz);
  const y = (v: number) => T + ph - (v / top) * ph;
  const band = pw / days.length, bw = Math.min(16, band - 4);
  const ticks: number[] = [];
  for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${Ht}`} role="img" aria-label={`ปริมาณนมที่ปั๊มได้รายวัน ${days.length} วันล่าสุด`}>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
          <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted)">{fmtNum(v)}</text>
        </g>
      ))}
      {days.map((d, i) => {
        const cx = L + band * i + band / 2, x = cx - bw / 2;
        const yt = y(fmt.toUnit(d.ml)), y0 = y(0), r = Math.min(4, bw / 2, y0 - yt);
        return (
          <g key={d.s}>
            {d.ml > 0 && (
              <path
                d={`M${x} ${y0} V${yt + r} A${r} ${r} 0 0 1 ${x + r} ${yt} H${x + bw - r} A${r} ${r} 0 0 1 ${x + bw} ${yt + r} V${y0} Z`}
                fill="var(--accent)" opacity={i === sel ? 1 : 0.45}
              />
            )}
            {d.ml > 0 && i === sel && (
              <text x={cx} y={yt - 6} textAnchor="middle" fontSize="10.5" fontWeight="600" fill="var(--ink)">{fmt.amtNum(d.ml)}</text>
            )}
            <text x={cx} y={Ht - 8} textAnchor="middle" fontSize="10" fill={i === sel ? "var(--ink)" : "var(--muted)"} fontWeight={i === sel ? 600 : 400}>
              {new Date(d.s).getDate()}
            </text>
            <rect
              x={L + band * i} y={T} width={band} height={ph + B} fill="transparent" tabIndex={0} role="button"
              aria-label={`${dayName(d.s, now)} ปั๊มได้ ${fmt.amt(d.ml)}`}
              onClick={() => onSel(i)}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") onSel(i); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSel(i); } }}
            />
          </g>
        );
      })}
    </svg>
  );
}

type Ev = { type: "pump"; t: number; s: PumpSession } | { type: "used" | "discarded"; t: number; b: Bag };

export function HistoryView() {
  const { bags, fmt, loaded, now, since, open, nameOf } = useMilk();
  const [sel, setSel] = useState(13);
  if (!loaded || !now) return <LoadNote />;

  const t0 = startOfDay(now);
  const days: DayStat[] = [];
  for (let i = 13; i >= 0; i--) {
    const s = addDays(t0, -i), e = addDays(t0, -i + 1);
    const bs = bags.filter((b) => b.pumpedAt >= s && b.pumpedAt < e);
    days.push({ s, ml: sumMl(bs), n: sessionsOf(bs).length });
  }
  const first = days.findIndex((d) => d.ml > 0);
  const avg = first >= 0 ? days.slice(first).reduce((a, d) => a + d.ml, 0) / (days.length - first) : 0;
  const d = days[sel] ?? days[days.length - 1];
  const selName = dayName(d.s, now);

  const ev: Ev[] = [];
  for (const s of sessionsOf(bags.filter((b) => b.pumpedAt >= since && b.pumpedAt <= now + 5 * 60e3))) ev.push({ type: "pump", t: s.t, s });
  for (const b of bags) {
    if (((b.place === "used" && !b.direct) || b.place === "discarded") && b.doneAt && b.doneAt >= since) {
      ev.push({ type: b.place, t: b.doneAt, b });
    }
  }
  ev.sort((a, b) => b.t - a.t);
  const groups = new Map<string, Ev[]>();
  for (const e of ev) { const k = dayKey(e.t); groups.set(k, [...(groups.get(k) ?? []), e]); }

  return (
    <>
      <section className="chart-card">
        <div>
          <h2>ปริมาณที่ปั๊มได้ต่อวัน ({fmt.unitName})</h2>
          <div className="hint">14 วันล่าสุด{avg ? ` · เฉลี่ย ${fmt.amt(avg)}/วัน` : ""} · แตะแท่งเพื่อดูรายละเอียด</div>
        </div>
        <Chart days={days} sel={sel} onSel={setSel} fmt={fmt} now={now} />
        <div className="read">
          {selName}{selName === "วันนี้" || selName === "เมื่อวาน" ? ` (${day(d.s)})` : ""} · ปั๊มได้ <b>{fmt.amt(d.ml)}</b>
          {d.n > 0 && <span className="muted"> จาก {d.n} ครั้ง · ≈ {fmt.alt(d.ml)}</span>}
        </div>
      </section>

      {!ev.length ? (
        <div className="empty"><h2>ยังไม่มีประวัติ</h2><p>เมื่อบันทึกการปั๊มหรือป้อนนม รายการจะขึ้นที่นี่ เรียงตามวัน</p></div>
      ) : (
        <>
          <section className="list-head"><h2>บันทึกรายวัน</h2><div className="hint">{HISTORY_DAYS} วันล่าสุด</div></section>
          {[...groups.values()].map((list) => {
            const t = list[0].t, nm = dayName(t, now);
            const pumped = list.reduce((a, e) => a + (e.type === "pump" ? e.s.ml : 0), 0);
            const fed = list.reduce((a, e) => a + (e.type === "used" ? e.b.ml : e.type === "pump" ? sumMl(e.s.bags.filter((b) => b.direct)) : 0), 0);
            return (
              <div className="day" key={dayKey(t)}>
                <div className="day-h">
                  <h2>{nm}{(nm === "วันนี้" || nm === "เมื่อวาน") && <span className="muted" style={{ fontSize: ".85rem" }}> {day(t)}</span>}</h2>
                  <span className="tot">ปั๊ม {fmt.amt(pumped)}{fed ? ` · ป้อน ${fmt.amt(fed)}` : ""}</span>
                </div>
                {list.map((e) => (e.type === "pump" ? (
                  <button key={"p" + e.s.key} className="ev"
                    onClick={() => (e.s.bags.length > 1 ? open({ type: "session", key: e.s.key }) : open({ type: "bag", id: e.s.bags[0].id }))}>
                    <span className="ic pump">
                      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5c-.3 0-.6.2-.8.4C9.6 5 6 9.8 6 14a6 6 0 0 0 12 0c0-4.2-3.6-9-5.2-11.1-.2-.2-.5-.4-.8-.4z" /></svg>
                    </span>
                    <span>
                      <span className="t">ปั๊มนม {fmt.amt(e.s.ml)}</span><br />
                      <span className="meta">
                        {[
                          e.s.side ? SIDES[e.s.side] : "",
                          e.s.bags.length > 1 ? `แบ่ง ${e.s.bags.length} ถุง` : "",
                          `ตอนนี้: ${[...new Set(e.s.bags.map((b) => (b.direct ? "ป้อนทันที" : PLACES[b.place].short)))].join(", ")}`,
                          nameOf(e.s.by) ? `โดย ${nameOf(e.s.by)}` : "",
                        ].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="tm">{time(e.s.t)}</span>
                  </button>
                ) : (
                  <button key={e.type + e.b.id} className="ev" onClick={() => open({ type: "bag", id: e.b.id })}>
                    <span className="ic">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
                        {e.type === "used"
                          ? <><path d="M10 2h4v3h-4zM9 5h6l1 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z" /><path d="M8 12h8" opacity=".6" /></>
                          : <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />}
                      </svg>
                    </span>
                    <span>
                      <span className="t">{e.type === "used" ? "ป้อนลูก" : "ทิ้ง"} {fmt.amt(e.b.ml)}</span><br />
                      <span className="meta">
                        จากถุง {bagName(e.b.pumpedAt)}
                        {e.b.prevPlace ? ` · เดิมอยู่${PLACES[e.b.prevPlace].short}` : ""}
                        {e.b.note ? ` · ${e.b.note}` : ""}
                      </span>
                    </span>
                    <span className="tm">{time(e.t)}</span>
                  </button>
                )))}
              </div>
            );
          })}
        </>
      )}
    </>
  );
}
