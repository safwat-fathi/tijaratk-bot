import {
  fetchConversationsAction,
  getPages,
  type ConversationRecord,
} from "@/app/merchant/actions";
import { getCurrentMerchant } from "@/lib/dal";
import {
  ConversationsClient,
  type ConversationPageChip,
} from "./conversations-client";

function isRedirect(error: unknown): boolean {
  return (
    typeof (error as { digest?: unknown })?.digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { merchantId } = await getCurrentMerchant();
  const { page: activePageId } = await searchParams;

  let conversations: ConversationRecord[] = [];
  let pageChips: ConversationPageChip[] = [];

  try {
    const [convRows, pagesData] = await Promise.all([
      fetchConversationsAction(merchantId, activePageId),
      getPages("7d").catch(() => null),
    ]);
    conversations = convRows;
    if (pagesData) {
      pageChips = [
        ...pagesData.pages.map((p) => ({
          id: p.id,
          name: p.account_name || "صفحة",
          channel: p.channel,
          is_active: true,
        })),
        ...pagesData.disconnected.map((d) => ({
          id: d.id,
          name: d.account_name || "صفحة مفصولة",
          channel: d.channel,
          is_active: false,
        })),
      ];
    }
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load conversations on server:", err);
  }

  return (
    <ConversationsClient
      merchantId={merchantId}
      conversations={conversations}
      pages={pageChips}
      activePageId={activePageId}
    />
  );
}
