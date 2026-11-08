import { fetchKnowledgeAction } from "@/app/merchant/actions";
import { PoliciesClient } from "./policies-client";
import { getCurrentMerchant } from "@/lib/dal";

export default async function PoliciesPage() {
  const { merchantId } = await getCurrentMerchant();

  // Fetch actual policies list from backend
  const knowledge = await fetchKnowledgeAction();

  return (
    <PoliciesClient merchantId={merchantId} initialKnowledge={knowledge} />
  );
}
