"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMilk } from "@/components/milk-provider";
import { day, weekday } from "@/lib/milk";

export function TopBar() {
  const { household, now } = useMilk();
  const pathname = usePathname();
  const title = pathname === "/history" ? "ประวัติ" : pathname === "/settings" ? "ตั้งค่า" : "สต็อกนมแม่";
  return (
    <header className="top">
      <div>
        <h1>{title}</h1>
        <div className="who">
          {household.babyName ? `ของน้อง${household.babyName}` : "คลังนมแม่"}
          {now ? ` · ${weekday(now)} ${day(now)}` : ""}
        </div>
      </div>
      {!household.isPremium && pathname !== "/settings" && (
        <Link className="pill expired" href="/settings#plan">แพ็กเกจหมดอายุ</Link>
      )}
    </header>
  );
}

export function LoadNote() {
  const { loadError } = useMilk();
  return <div className="notice">{loadError ? "โหลดข้อมูลไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วเปิดหน้านี้ใหม่" : "กำลังโหลดสต็อกนม…"}</div>;
}

const TABS = [
  {
    href: "/", label: "สต็อก",
    icon: <><path d="M7 3h10v4H7z" /><path d="M6 9h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" /><path d="M6 14h12" opacity=".6" /></>,
  },
  { href: "/history", label: "ประวัติ", icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" strokeLinecap="round" /> },
  {
    href: "/settings", label: "ตั้งค่า",
    icon: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" strokeLinecap="round" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  },
];

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="เมนู">
      <div className="tabbar-in">
        {TABS.map((t) => (
          <Link key={t.href} className="tab" href={t.href} aria-current={pathname === t.href ? "page" : undefined}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">{t.icon}</svg>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
