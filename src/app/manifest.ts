import type { MetadataRoute } from "next";

// PWA: แม่ ๆ กด "เพิ่มไปหน้าจอหลัก" แล้วเปิดเต็มจอเหมือนแอพ
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "คลังนมแม่",
    short_name: "คลังนมแม่",
    description: "บันทึกการปั๊มนมและสต็อกนมแม่ร่วมกันทั้งครอบครัว",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F4F7",
    theme_color: "#B0305D",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
