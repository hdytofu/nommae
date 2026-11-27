"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  BAG_COLUMNS, D, HISTORY_DAYS, PLACES, SIDES, bagLabel, bagName, expiry, fileDate, makeFmt, rowToBag, spanText,
  type ActivePlace, type Bag, type Fmt, type Household, type Member,
} from "@/lib/milk";
import { BagSheet, PumpForm, SessionSheet } from "@/components/sheets";

export type MoveKind = "use" | "discard" | "thaw" | "fridge" | "freezer" | "restore";
export type NewBag = { pumpedAt: number; side: string | null; place: ActivePlace | "feed"; note: string };
type Sheet = { type: "add" } | { type: "edit"; id: string } | { type: "bag"; id: string } | { type: "session"; key: string } | null;

type Ctx = {
  household: Household;
  members: Member[];
  meId: string;
  fmt: Fmt;
  bags: Bag[];
  byId: Map<string, Bag>;
  loaded: boolean;
  loadError: boolean;
  now: number; // 0 จนกว่าหน้าเว็บจะโหลดเสร็จ (กันเวลาฝั่ง server กับเครื่องผู้ใช้ไม่ตรงกัน)
  since: number;
  open: (s: Sheet) => void;
  close: () => void;
  addPump: (b: NewBag, parts: number[]) => Promise<boolean>;
  editBag: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  move: (id: string, kind: MoveKind) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  exportCsv: () => Promise<void>;
  nameOf: (userId: string | null) => string;
  toast: (msg: string, undo?: () => void) => void;
};

const MilkCtx = createContext<Ctx | null>(null);
export function useMilk() {
  const c = useContext(MilkCtx);
  if (!c) throw new Error("useMilk ต้องอยู่ใน MilkProvider");
  return c;
}

const iso = (t: number | null) => (t ? new Date(t).toISOString() : null);

export function MilkProvider({
  household, members, meId, children,
}: { household: Household; members: Member[]; meId: string; children: React.ReactNode }) {
  const sb = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const [byId, setById] = useState<Map<string, Bag>>(() => new Map());
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [now, setNow] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toastState, setToast] = useState<{ msg: string; undo?: () => void; key: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const fmt = useMemo(() => makeFmt(household.unit), [household.unit]);
  const since = now ? now - HISTORY_DAYS * D : 0;

  const toast = useCallback((msg: string, undo?: () => void) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undo, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), undo ? 6000 : 3500);
  }, []);

  const upsert = useCallback((rows: any[]) => {
    setById((prev) => {
      const m = new Map(prev);
      for (const r of rows) {
        const b = rowToBag(r);
        const cur = m.get(b.id);
        if (!cur || b.updatedAt >= cur.updatedAt) m.set(b.id, b);
      }
      return m;
    });
  }, []);

  // โหลดถุงที่ยังอยู่ในสต็อก + ทุกถุงที่มีความเคลื่อนไหวใน 30 วันล่าสุด
  const load = useCallback(async () => {
    const sinceIso = new Date(Date.now() - HISTORY_DAYS * D).toISOString();
    const [a, r] = await Promise.all([
      sb.from("bags").select(BAG_COLUMNS).eq("household_id", household.id).eq("active", true).limit(1000),
      sb.from("bags").select(BAG_COLUMNS).eq("household_id", household.id).gte("updated_at", sinceIso)
        .order("updated_at", { ascending: false }).limit(3000),
    ]);
    if (a.error || r.error) { setLoadError(true); return; }
    const m = new Map<string, Bag>();
    for (const row of [...(r.data ?? []), ...(a.data ?? [])]) m.set(row.id, rowToBag(row));
    setById(m);
    setLoaded(true);
    setLoadError(false);
  }, [sb, household.id]);

  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(tick);
  }, []);

  // ข้อมูล + อัปเดตสดเมื่อคนอื่นในบ้านบันทึก
  useEffect(() => {
    load(); // provider ถูก key ด้วย household.id — เปลี่ยนครอบครัวแล้วเริ่มใหม่ทั้งก้อน
    const channel = sb
      .channel(`bags:${household.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bags", filter: `household_id=eq.${household.id}` }, (p: any) => {
        if (p.eventType !== "DELETE" && p.new?.id) upsert([p.new]);
      })
      // การลบส่งมาแค่ id และกรองตามครอบครัวไม่ได้ — ลบออกถ้าเป็นถุงที่เรามีอยู่
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "bags" }, (p: any) => {
        const id = p.old?.id;
        if (id) setById((prev) => { if (!prev.has(id)) return prev; const m = new Map(prev); m.delete(id); return m; });
      })
      .subscribe();
    const onVisible = () => { if (!document.hidden) { setNow(Date.now()); load(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sb.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [sb, household.id, load, upsert]);

  const fail = useCallback((error: { message?: string; code?: string } | null) => {
    console.error(error);
    toast(error?.message?.includes("Failed to fetch") ? "ไม่มีอินเทอร์เน็ต ลองใหม่เมื่อออนไลน์" : "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    return false;
  }, [toast]);

  const addPump = useCallback(async (b: NewBag, parts: number[]) => {
    const session = crypto.randomUUID();
    const direct = b.place === "feed";
    const rows = parts.map((ml) => ({
      id: crypto.randomUUID(),
      household_id: household.id,
      session_id: session,
      pumped_at: new Date(b.pumpedAt).toISOString(),
      ml,
      side: b.side && b.side in SIDES ? b.side : null,
      place: direct ? "used" : b.place,
      active: !direct,
      direct,
      done_at: direct ? new Date(b.pumpedAt).toISOString() : null,
      note: b.note,
    }));
    const { data, error } = await sb.from("bags").insert(rows).select(BAG_COLUMNS);
    if (error) return fail(error);
    upsert(data ?? []);
    toast(direct ? `บันทึกแล้ว ป้อนลูก ${fmt.amt(parts.reduce((x, y) => x + y, 0))}` : `บันทึกแล้ว · เขียนบนถุง ${bagLabel(b.pumpedAt)}`);
    return true;
  }, [sb, household.id, upsert, fail, toast, fmt]);

  const editBag = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const { data, error } = await sb.from("bags").update(patch).eq("id", id).select(BAG_COLUMNS).maybeSingle();
    if (error || !data) return fail(error);
    upsert([data]);
    return true;
  }, [sb, upsert, fail]);

  const move = useCallback(async (id: string, kind: MoveKind) => {
    const b = byId.get(id);
    if (!b) return false;
    const at = new Date().toISOString();
    const patches: Record<MoveKind, Record<string, unknown>> = {
      use: { place: "used", active: false, done_at: at, prev_place: b.place },
      discard: { place: "discarded", active: false, done_at: at, prev_place: b.place },
      thaw: { place: "thawed", thawed_at: at },
      fridge: { place: "fridge" },
      freezer: { place: "freezer" },
      restore: { place: b.prevPlace ?? "fridge", active: true, done_at: null, prev_place: null, direct: false },
    };
    const before = { place: b.place, active: b.active, done_at: iso(b.doneAt), prev_place: b.prevPlace, thawed_at: iso(b.thawedAt), direct: b.direct };
    const ok = await editBag(id, patches[kind]);
    if (!ok) return false;
    const msgs: Record<MoveKind, string> = {
      use: `ป้อนลูกแล้ว ${fmt.amt(b.ml)}`,
      discard: `ทิ้งถุง ${bagName(b.pumpedAt)} แล้ว`,
      thaw: `นำออกมาละลายแล้ว ใช้ภายใน ${spanText(household.thawedHours)}`,
      fridge: "ย้ายเข้าตู้เย็นแล้ว",
      freezer: "ย้ายเข้าช่องแช่แข็งแล้ว",
      restore: "ย้อนกลับเข้าสต็อกแล้ว",
    };
    toast(msgs[kind], kind === "restore" ? undefined : () => { void editBag(id, before); });
    return true;
  }, [byId, editBag, fmt, household.thawedHours, toast]);

  const remove = useCallback(async (id: string) => {
    const { error } = await sb.from("bags").delete().eq("id", id);
    if (error) return fail(error);
    setById((prev) => { const m = new Map(prev); m.delete(id); return m; });
    toast("ลบรายการแล้ว");
    return true;
  }, [sb, fail, toast]);

  const exportCsv = useCallback(async () => {
    const all: Bag[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from("bags").select(BAG_COLUMNS).eq("household_id", household.id)
        .order("pumped_at").range(from, from + 999);
      if (error) { fail(error); return; }
      all.push(...(data ?? []).map(rowToBag));
      if (!data || data.length < 1000) break;
    }
    const d2 = (t: number | null) => (t ? bagLabel(t) : "");
    const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["วันเวลาที่ปั๊ม", "ปริมาณ (oz)", "ปริมาณ (ml)", "ข้าง", "สถานะ / ที่เก็บ", "ควรใช้ภายใน", "วันเวลาที่ละลาย", "วันเวลาที่ป้อนหรือทิ้ง", "หมายเหตุ"].map(q).join(",")];
    for (const b of all) {
      lines.push([d2(b.pumpedAt), (b.ml / 29.5735).toFixed(1), Math.round(b.ml), b.side ? SIDES[b.side] : "",
        b.direct ? "ป้อนทันที" : PLACES[b.place].label, b.active ? d2(expiry(b, household)) : "", d2(b.thawedAt), d2(b.doneAt), b.note].map(q).join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nommae-${fileDate(Date.now())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, [sb, household, fail]);

  const nameOf = useCallback((userId: string | null) => {
    if (!userId) return "";
    if (userId === meId) return "คุณ";
    return members.find((m) => m.id === userId)?.name || "";
  }, [members, meId]);

  const open = useCallback((s: Sheet) => {
    if (!sheet) lastFocus.current = document.activeElement as HTMLElement | null;
    setSheet(s);
  }, [sheet]);
  const close = useCallback(() => {
    setSheet(null);
    requestAnimationFrame(() => lastFocus.current?.focus?.());
  }, []);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheet, close]);

  const bags = useMemo(() => [...byId.values()], [byId]);
  const value: Ctx = {
    household, members, meId, fmt, bags, byId, loaded, loadError, now, since,
    open, close, addPump, editBag, move, remove, exportCsv, nameOf, toast,
  };
  const showFab = pathname === "/" || pathname === "/history";

  return (
    <MilkCtx.Provider value={value}>
      {children}
      {showFab && (
        <button className="fab" onClick={() => open({ type: "add" })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          บันทึกปั๊มนม
        </button>
      )}
      {sheet && (
        <div className="sheet-wrap">
          <button className="sheet-bg" aria-label="ปิด" tabIndex={-1} onClick={close} />
          <div className="sheet" role="dialog" aria-modal="true">
            <div className="grab" />
            {sheet.type === "add" && <PumpForm key="add" />}
            {sheet.type === "edit" && byId.get(sheet.id) && <PumpForm key={sheet.id} bag={byId.get(sheet.id)} />}
            {sheet.type === "bag" && byId.get(sheet.id) && <BagSheet bag={byId.get(sheet.id)!} />}
            {sheet.type === "session" && <SessionSheet sessionKey={sheet.key} />}
          </div>
        </div>
      )}
      {toastState && (
        <div className="toast" role="status" key={toastState.key}>
          <span>{toastState.msg}</span>
          {toastState.undo && (
            <button type="button" onClick={() => { const u = toastState.undo; setToast(null); u?.(); }}>เลิกทำ</button>
          )}
        </div>
      )}
    </MilkCtx.Provider>
  );
}
