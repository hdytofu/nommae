import { redirect } from "next/navigation";
import { getAppContext } from "@/lib/app-context";
import { MilkProvider } from "@/components/milk-provider";
import { TabBar, TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAppContext();
  if (!ctx) redirect("/login");
  if (!ctx.household) redirect("/welcome");
  return (
    <MilkProvider key={ctx.household.id} household={ctx.household} members={ctx.members} meId={ctx.userId}>
      <div className="app">
        <TopBar />
        <main className="stack-main">{children}</main>
      </div>
      <TabBar />
    </MilkProvider>
  );
}
