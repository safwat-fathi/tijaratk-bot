import { fetchKnowledgeAction } from "@/app/merchant/actions";
import { PoliciesClient } from "./policies-client";
import { getCurrentMerchant } from "@/lib/dal";
import type { StoreKnowledge } from "@/lib/knowledge";

function isRedirect(error: unknown): boolean {
  return (
    typeof (error as { digest?: unknown })?.digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export default async function PoliciesPage() {
  const { merchantId } = await getCurrentMerchant();

  let knowledge: StoreKnowledge[] = [];
  try {
    knowledge = await fetchKnowledgeAction();
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load policies on server:", err);
  }

  return (
    <PoliciesClient merchantId={merchantId} initialKnowledge={knowledge} />
  );
}
