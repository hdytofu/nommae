"use client";

import type { CSSProperties } from "react";
import { BagIcon } from "@/components/bag-icon";
import { useMilk } from "@/components/milk-provider";
import { PLACES, SIDES, bagName, expiry, remainText, startOf, status, type Bag } from "@/lib/milk";

export const dotStyle = (color: string) => ({ "--c": color }) as CSSProperties;

export function BagRow({ bag }: { bag: Bag }) {
  const { household, fmt, now, open } = useMilk();
  const st = status(bag, household, now);
  const e = expiry(bag, household), s = startOf(bag);
  const pct = e ? Math.min(100, Math.max(2, ((now - s) / (e - s)) * 100)) : 100;
  return (
    <li>
      <button className="bagrow" onClick={() => open({ type: "bag", id: bag.id })}>
        <BagIcon ml={bag.ml} place={bag.place} />
        <span className="main">
          <span className="lbl">{bagName(bag.pumpedAt)}</span>
          <span className="meta">
            <span className="dot" style={dotStyle(PLACES[bag.place].color)} />
            {bag.direct ? "ป้อนทันที" : PLACES[bag.place].short}
            {bag.side && ` · ${SIDES[bag.side]}`}
            {bag.note && ` · ${bag.note}`}
          </span>
        </span>
        <span className="right">
          <span className="ml">{fmt.amt(bag.ml)}</span>
          {st !== "done" && <span className={`pill ${st}`}>{remainText(bag, household, now)}</span>}
        </span>
        {st !== "done" && (
          <span className={`prog ${st}`} aria-hidden="true"><i style={{ width: `${pct.toFixed(1)}%` }} /></span>
        )}
      </button>
    </li>
  );
}
