import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai_Looped, Mitr } from "next/font/google";
import "./globals.css";

const display = Mitr({ weight: ["400", "500"], subsets: ["thai", "latin"], variable: "--font-mitr", display: "swap" });
const body = IBM_Plex_Sans_Thai_Looped({
  weight: ["400", "500", "600"],
  subsets: ["thai", "latin"],
  variable: "--font-plex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "คลังนมแม่", template: "%s · คลังนมแม่" },
  description: "บันทึกการปั๊มนมและสต็อกนมแม่ร่วมกันทั้งครอบครัว รู้ว่าถุงไหนควรใช้ก่อนและหมดอายุเมื่อไร",
  applicationName: "คลังนมแม่",
  appleWebApp: { capable: true, title: "คลังนมแม่", statusBarStyle: "default" },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2F4F7" },
    { media: "(prefers-color-scheme: dark)", color: "#0F131A" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
