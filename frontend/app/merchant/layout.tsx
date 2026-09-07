import { SidebarClient } from "./sidebar-client";
import { TokenVerifier } from "@/components/token-verifier";

export default function MerchantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarClient>
      <TokenVerifier />
      {children}
    </SidebarClient>
  );
}
