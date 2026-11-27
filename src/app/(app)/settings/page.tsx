import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site";
import { SettingsView } from "./settings-view";

export const metadata = { title: "ตั้งค่า" };

export default async function SettingsPage() {
  const ctx = await getAppContext();
  if (!ctx?.household) redirect("/welcome");
  const supabase = await createClient();
  const { data: invites } = await supabase
    .from("invites")
    .select("code, expires_at")
    .eq("household_id", ctx.household.id)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  return (
    <SettingsView
      households={ctx.households}
      myName={ctx.profile.name}
      invites={(invites ?? []).map((i) => ({ code: i.code, expiresAt: i.expires_at }))}
      support={process.env.NEXT_PUBLIC_SUPPORT_CONTACT ?? ""}
      site={await getSiteUrl()}
    />
  );
}
