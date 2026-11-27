// ตรรกะเรื่องถุงนม — ใช้ได้ทั้งฝั่ง server และหน้าเว็บ (ไม่มี import ฝั่ง server)
// ปริมาณเก็บเป็น ml เสมอ แสดงผล/รับค่าเป็นออนซ์หรือ ml ตามที่ครอบครัวเลือก

export const H = 3600e3;
export const D = 24 * H;
export const OZ = 29.5735;
export const HISTORY_DAYS = 30;

export type Place = "room" | "cooler" | "fridge" | "freezer" | "thawed" | "used" | "discarded";
export type ActivePlace = "room" | "cooler" | "fridge" | "freezer" | "thawed";
export type Side = "L" | "R" | "B";
export type Unit = "oz" | "ml";

export type Bag = {
  id: string;
  sessionId: string;
  pumpedAt: number;
  ml: number;
  side: Side | null;
  place: Place;
  active: boolean;
  direct: boolean;
  thawedAt: number | null;
  doneAt: number | null;
  prevPlace: ActivePlace | null;
  note: string;
  createdBy: string | null;
  updatedAt: number;
};

export type Household = {
  id: string;
  babyName: string;
  unit: Unit;
  roomHours: number;
  coolerHours: number;
  fridgeDays: number;
  freezerDays: number;
  thawedHours: number;
  trialEndsAt: string;
  paidUntil: string | null;
  isPremium: boolean;
  role: "owner" | "member";
};

export type Member = { id: string; name: string; picture: string | null; role: "owner" | "member" };

export const PLACES: Record<Place, { label: string; short: string; color: string }> = {
  fridge: { label: "ตู้เย็นช่องธรรมดา", short: "ตู้เย็น", color: "var(--z-fridge)" },
  freezer: { label: "ช่องแช่แข็ง", short: "ช่องแข็ง", color: "var(--z-freezer)" },
  room: { label: "อุณหภูมิห้อง", short: "อุณหภูมิห้อง", color: "var(--z-room)" },
  cooler: { label: "กระติกน้ำแข็ง / ไอซ์แพ็ก", short: "กระติก", color: "var(--z-cooler)" },
  thawed: { label: "ละลายแล้ว (ในตู้เย็น)", short: "ละลายแล้ว", color: "var(--z-thawed)" },
  used: { label: "ป้อนลูกแล้ว", short: "ป้อนแล้ว", color: "var(--z-done)" },
  discarded: { label: "ทิ้งแล้ว", short: "ทิ้งแล้ว", color: "var(--z-done)" },
};
export const ACTIVE: ActivePlace[] = ["thawed", "room", "cooler", "fridge", "freezer"];
export const SIDES: Record<Side, string> = { L: "ซ้าย", R: "ขวา", B: "สองข้าง" };
export const FREEZER_PRESETS = [
  { days: 14, label: "ช่องแช่แข็งตู้เย็นประตูเดียว", sub: "2 สัปดาห์" },
  { days: 90, label: "ช่องแช่แข็งตู้เย็น 2 ประตู", sub: "3 เดือน" },
  { days: 180, label: "ตู้แช่แข็งแยก −18°C", sub: "6 เดือน" },
];

export const BAG_COLUMNS =
  "id, session_id, pumped_at, ml, side, place, active, direct, thawed_at, done_at, prev_place, note, created_by, updated_at";

const ts = (v: unknown) => (v ? Date.parse(String(v)) : null);
export function rowToBag(r: any): Bag {
  return {
    id: r.id,
    sessionId: r.session_id,
    pumpedAt: ts(r.pumped_at) ?? 0,
    ml: Number(r.ml) || 0,
    side: r.side in SIDES ? r.side : null,
    place: r.place in PLACES ? r.place : "fridge",
    active: r.active === true,
    direct: r.direct === true,
    thawedAt: ts(r.thawed_at),
    doneAt: ts(r.done_at),
    prevPlace: ACTIVE.includes(r.prev_place) ? r.prev_place : null,
    note: r.note ?? "",
    createdBy: r.created_by ?? null,
    updatedAt: ts(r.updated_at) ?? 0,
  };
}

// ---------------------------------------------------------------- อายุการเก็บ
export function spanMs(place: Place, st: Household): number | null {
  switch (place) {
    case "room": return st.roomHours * H;
    case "cooler": return st.coolerHours * H;
    case "fridge": return st.fridgeDays * D;
    case "freezer": return st.freezerDays * D;
    case "thawed": return st.thawedHours * H;
  }
  return null;
}
export const startOf = (b: Bag) => (b.place === "thawed" ? b.thawedAt || b.pumpedAt : b.pumpedAt);
export function expiry(b: Bag, st: Household): number | null {
  const s = spanMs(b.place, st);
  return s == null ? null : startOf(b) + s;
}
export type Status = "ok" | "soon" | "expired" | "done";
export function status(b: Bag, st: Household, now: number): Status {
  const e = expiry(b, st);
  if (e == null) return "done";
  const rem = e - now;
  if (rem <= 0) return "expired";
  if (rem < (spanMs(b.place, st) ?? 0) * 0.25) return "soon";
  return "ok";
}
export function remainText(b: Bag, st: Household, now: number): string {
  const e = expiry(b, st);
  if (e == null) return "";
  const rem = e - now;
  return rem <= 0 ? `เกินมา ${dur(-rem)}` : `เหลือ ${dur(rem)}`;
}
export const byExpiry = (st: Household) => (a: Bag, b: Bag) =>
  (expiry(a, st) ?? Infinity) - (expiry(b, st) ?? Infinity) || a.pumpedAt - b.pumpedAt;

// ---------------------------------------------------------------- ตัวเลข/หน่วย
export const fmtInt = (n: number) => Math.round(n).toLocaleString("th-TH");
export const fmtNum = (n: number, d = 1) =>
  (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("th-TH", { maximumFractionDigits: d });

export function makeFmt(unit: Unit) {
  const isOz = unit !== "ml";
  const unitName = isOz ? "oz" : "ml";
  const toUnit = (m: number) => (isOz ? m / OZ : m);
  const amtNum = (m: number) => (isOz ? fmtNum(m / OZ) : fmtInt(m));
  const amt = (m: number) => `${amtNum(m)} ${unitName}`;
  const alt = (m: number) => (isOz ? `${fmtInt(m)} ml` : `${fmtNum(m / OZ)} oz`);
  const fromInput = (v: number) => (isOz ? Math.round(v * OZ * 100) / 100 : Math.round(v));
  // แบ่งปริมาณ (หน่วยที่พิมพ์) เป็น n ถุงเท่า ๆ กัน ทีละ 0.1 oz หรือ 1 ml ให้รวมแล้วเท่ายอดเดิมพอดี
  const splitInput = (v: number, n: number) => {
    const q = isOz ? 10 : 1;
    const units = Math.round(v * q), base = Math.floor(units / n), rem = units - base * n;
    return Array.from({ length: n }, (_, i) => fromInput((base + (i < rem ? 1 : 0)) / q));
  };
  return { isOz, unitName, unitThai: isOz ? "ออนซ์" : "มิลลิลิตร", toUnit, amtNum, amt, alt, fromInput, splitInput };
}
export type Fmt = ReturnType<typeof makeFmt>;

export const sumMl = (bags: Bag[]) => bags.reduce((a, b) => a + b.ml, 0);

// ---------------------------------------------------------------- วันเวลา (เวลาเครื่องผู้ใช้)
const fDay = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });
const fWk = new Intl.DateTimeFormat("th-TH", { weekday: "short" });
const fTime = new Intl.DateTimeFormat("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false });
const fLabel = new Intl.DateTimeFormat("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" });
const fDate = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" });
export const day = (t: number) => fDay.format(t);
export const weekday = (t: number) => fWk.format(t);
export const time = (t: number) => fTime.format(t);
export const longDate = (t: number) => fDate.format(t);
export const bagName = (t: number) => `${fDay.format(t)} ${fTime.format(t)}`;
export const bagLabel = (t: number) => `${fLabel.format(t)} ${fTime.format(t)}`;
export const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const addDays = (t: number, n: number) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function dayName(t: number, now: number) {
  const today = startOfDay(now), s = startOfDay(t);
  if (s === today) return "วันนี้";
  if (s === addDays(today, -1)) return "เมื่อวาน";
  return `${fWk.format(t)} ${fDay.format(t)}`;
}
export function dur(ms: number) {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(m, 1)} นาที`;
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 3) return mm ? `${h} ชม. ${mm} นาที` : `${h} ชม.`;
  if (h < 48) return `${h} ชม.`;
  const d = Math.floor(h / 24);
  if (d < 60) return `${d} วัน`;
  return `${Math.round(d / 30)} เดือน`;
}
export function spanText(hours: number) {
  if (hours < 48) return `${+hours.toFixed(1)} ชม.`;
  const d = Math.round(hours / 24);
  if (d >= 60) return `${Math.round(d / 30)} เดือน`;
  if (d >= 14 && d % 7 === 0) return `${d / 7} สัปดาห์`;
  return `${d} วัน`;
}
const pad = (n: number) => String(n).padStart(2, "0");
export const toLocalInput = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fileDate = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

// ---------------------------------------------------------------- สรุปข้อมูล
export type PumpSession = { key: string; t: number; ml: number; bags: Bag[]; side: Side | null; by: string | null };
export function sessionsOf(bags: Bag[]): PumpSession[] {
  const m = new Map<string, PumpSession>();
  for (const b of bags) {
    const k = b.sessionId || b.id;
    const s = m.get(k) ?? { key: k, t: b.pumpedAt, ml: 0, bags: [], side: b.side, by: b.createdBy };
    s.ml += b.ml; s.bags.push(b); s.t = Math.min(s.t, b.pumpedAt);
    m.set(k, s);
  }
  return [...m.values()].sort((a, b) => b.t - a.t);
}

export function avgDailyUse(bags: Bag[], now: number) {
  const from = now - 7 * D;
  const used = bags.filter((b) => b.place === "used" && b.doneAt && b.doneAt >= from);
  if (!used.length) return 0;
  const first = Math.min(...used.map((b) => b.doneAt as number));
  const days = Math.min(7, Math.max(1, Math.ceil((now - first) / D)));
  return sumMl(used) / days;
}

export function planText(h: Household, now: number) {
  const paid = h.paidUntil ? Date.parse(h.paidUntil) : 0;
  const trial = Date.parse(h.trialEndsAt);
  if (paid > now) return { active: true, label: `สมาชิกพรีเมียมถึง ${longDate(paid)}` };
  if (trial > now) return { active: true, label: `ทดลองใช้ฟรีถึง ${longDate(trial)} (อีก ${dur(trial - now)})` };
  return { active: false, label: "แพ็กเกจหมดอายุแล้ว ยังบันทึกได้ตามปกติ แต่เชิญคนเพิ่มและส่งออกไฟล์ไม่ได้" };
}
