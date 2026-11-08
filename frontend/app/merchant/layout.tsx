import { getPages } from "./actions";
import { SidebarClient, type SidebarPageItem } from "./sidebar-client";

export default async function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pagesData = await getPages("7d").catch(() => null);
  const pages: SidebarPageItem[] =
    pagesData?.pages.map((p) => ({
      id: p.id,
      name: p.account_name || "صفحة بدون اسم",
      channel: p.channel,
      ai_state: p.ai_state,
    })) ?? [];

  return <SidebarClient pages={pages}>{children}</SidebarClient>;
}
