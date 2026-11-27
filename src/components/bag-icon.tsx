import { PLACES, type Place } from "@/lib/milk";

// ถุงเก็บน้ำนม — สีน้ำนมบอกที่เก็บ ระดับบอกปริมาณ (เต็มที่ 240 ml ≈ 8 oz)
export function BagIcon({ ml, place, scale = 1 }: { ml: number; place: Place; scale?: number }) {
  const fill = ml > 0 ? Math.max(0.2, Math.min(1, ml / 240)) : 0;
  const h = 23 * fill, y = 36 - h;
  const body = "M5 11 H23 V33 a3 3 0 0 1 -3 3 H8 a3 3 0 0 1 -3 -3 Z";
  return (
    <svg className="bag" viewBox="0 0 28 40" width={28 * scale} height={40 * scale} aria-hidden="true">
      <rect x="4" y="3" width="20" height="5" rx="1.5" fill="var(--surface-2)" stroke="currentColor" strokeWidth="1.4" />
      <path d={body} fill="var(--surface-2)" />
      {fill > 0 && <path d={`M5 ${y.toFixed(1)} H23 V33 a3 3 0 0 1 -3 3 H8 a3 3 0 0 1 -3 -3 Z`} fill={PLACES[place].color} />}
      <path d={body} fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M19 17h4M20 22h3M19 27h4" stroke="currentColor" strokeWidth="1" opacity=".7" />
    </svg>
  );
}
