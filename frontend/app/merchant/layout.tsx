import { SidebarClient } from "./sidebar-client";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarClient>
      {children}
    </SidebarClient>
  );
}
