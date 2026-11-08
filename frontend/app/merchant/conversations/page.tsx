import { fetchConversationsAction } from "@/app/merchant/actions";
import { ConversationsClient } from "./conversations-client";

export default async function ConversationsPage() {
  // Fetch actual conversations list from backend
  const conversations = await fetchConversationsAction();

  return (
    <ConversationsClient 
      merchantId="" 
      conversations={conversations} 
    />
  );
}
