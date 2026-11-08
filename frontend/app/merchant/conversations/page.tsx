import { fetchConversationsAction, type ConversationRecord } from "@/app/merchant/actions";
import { ConversationsClient } from "./conversations-client";
import { getCurrentMerchant } from "@/lib/dal";

function isRedirect(error: unknown): boolean {
  return (
    typeof (error as { digest?: unknown })?.digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export default async function ConversationsPage() {
  const { merchantId } = await getCurrentMerchant();

  let conversations: ConversationRecord[] = [];
  try {
    conversations = await fetchConversationsAction();
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load conversations on server:", err);
  }

  return <ConversationsClient merchantId={merchantId} conversations={conversations} />;
}
