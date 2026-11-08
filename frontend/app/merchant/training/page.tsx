import { getCurrentMerchant } from "@/lib/dal";
import { getBaseUrl } from "@/lib/api";
import { getAuthToken } from "@/lib/dal";
import type { LabeledExample } from "@/lib/training";
import { TrainingClient } from "./training-client";

function isRedirect(error: unknown): boolean {
  return (
    typeof (error as { digest?: unknown })?.digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

async function getLabeledExamples(token: string): Promise<LabeledExample[]> {
  const res = await fetch(`${getBaseUrl()}/labeled-examples`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch training examples: ${res.status}`);
  }
  return (await res.json()) as LabeledExample[];
}

async function getIntents(token: string): Promise<string[]> {
  const res = await fetch(`${getBaseUrl()}/labeled-examples/intents`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as string[];
}

export default async function TrainingPage() {
  const { merchantId } = await getCurrentMerchant();
  const token = await getAuthToken();

  let examples: LabeledExample[] = [];
  try {
    examples = await getLabeledExamples(token);
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load training examples on server:", err);
  }

  let intents: string[] = [];
  try {
    intents = await getIntents(token);
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load intents on server:", err);
  }

  return <TrainingClient merchantId={merchantId} initialExamples={examples} intents={intents} />;
}
