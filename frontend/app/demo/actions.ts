"use server";

import { cookies } from "next/headers";
import { COOKIES, LOGIN_MARKER } from "@/lib/constants";
import { getBaseUrl } from "@/lib/api";
import type { MessageIngestResponse } from "@/lib/messages";
import type { Product } from "@/lib/products";
import type { StoreKnowledge } from "@/lib/knowledge";
import type { Order } from "@/lib/orders";
import type { LabeledExample } from "@/lib/training";

export type IngestState =
  | { status: "idle" }
  | { status: "success"; data: MessageIngestResponse }
  | { status: "error"; message: string };

export async function checkResponse(res: Response, errorPrefix: string = "Request failed") {
  if (res.status === 401 || res.status === 403) {
    // Proxy clears session cookies when it sees the marker on /login.
    const { redirect } = await import("next/navigation");
    redirect(`/login?${LOGIN_MARKER}=1`);
  }
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`${errorPrefix}: ${res.status} ${err}`);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIES.TOKEN)?.value;

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function sendMessage(
  conversationId: string,
  _prevState: IngestState,
  formData: FormData,
): Promise<IngestState> {
  const text = String(formData.get("text") ?? "");
  const baseUrl = getBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/messages/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        raw_text: text,
        normalized_text: text,
      }),
      cache: "no-store",
    });
  } catch {
    return {
      status: "error",
      message: `Could not reach backend at ${baseUrl}`,
    };
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      // Proxy clears session cookies when it sees the marker on /login.
      const { redirect } = await import("next/navigation");
      redirect(`/login?${LOGIN_MARKER}=1`);
    }
    const detail = await response.text();
    return { status: "error", message: `${response.status}: ${detail}` };
  }

  const data = (await response.json()) as MessageIngestResponse;
  return { status: "success", data };
}

// ---------------- PRODUCTS ACTIONS ----------------

export async function fetchProductsAction(merchantId?: string): Promise<Product[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/products/`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch products");
  return res.json();
}

export async function createProductAction(
  data: {
    name: string;
    aliases: string[];
    price?: number | null;
    variants?: Array<{ label: string; sku?: string; price?: number; stock?: number }>;
  },
  merchantId?: string,
): Promise<Product> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/products/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to create product");
  return res.json();
}

export async function updateProductAction(
  productId: string,
  data: { name?: string; aliases?: string[]; price?: number | null },
  merchantId?: string,
): Promise<Product> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/products/${productId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to update product");
  return res.json();
}

export async function deleteProductAction(productId: string, merchantId?: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/products/${productId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to delete product");
}

// ---------------- STORE KNOWLEDGE ACTIONS ----------------

export async function fetchKnowledgeAction(merchantId?: string): Promise<StoreKnowledge[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/store-knowledge/`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch knowledge");
  return res.json();
}

export async function createKnowledgeAction(
  data: {
    knowledge_type: string;
    title: string;
    content: string;
    keywords: string[];
  },
  merchantId?: string,
): Promise<StoreKnowledge> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/store-knowledge/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to create knowledge");
  return res.json();
}

export async function updateKnowledgeAction(
  knowledgeId: string,
  data: {
    knowledge_type?: string;
    title?: string;
    content?: string;
    keywords?: string[];
  },
  merchantId?: string,
): Promise<StoreKnowledge> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/store-knowledge/${knowledgeId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to update knowledge");
  return res.json();
}

export async function deleteKnowledgeAction(knowledgeId: string, merchantId?: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/store-knowledge/${knowledgeId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to delete knowledge");
}

// ---------------- MANUAL ORDERS ACTIONS ----------------

export interface ManualOrderResult {
  id: string;
  order_number: number | null;
  status: string;
  subtotal: number | null;
  total: number | null;
}

export async function createManualOrderAction(
  data: {
    conversation_id: string;
    line_items: Array<{ product_id: string; variant_id?: string; quantity: number }>;
    customer_name?: string;
    customer_phone?: string;
    delivery_address?: string;
  },
  merchantId?: string,
): Promise<ManualOrderResult> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/orders/manual`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to create manual order");
  return res.json();
}

// ---------------- ORDER STATUS ACTIONS ----------------

export async function updateOrderStatusAction(
  orderId: string,
  status: string,
  merchantId?: string,
): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/orders/${orderId}/status`, {
    method: "PATCH",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status }),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to update order status");
}

// ---------------- HUMAN TAKEOVER & REPLIES ACTIONS ----------------

export async function takeoverConversationAction(
  conversationId: string,
  reason: string = "MERCHANT_TAKEOVER",
  notes?: string,
  merchantId?: string,
): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/conversations/${conversationId}/takeover`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ reason, notes }),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to take over conversation");
}

export async function returnToAiAction(
  conversationId: string,
  notes?: string,
  merchantId?: string,
): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/conversations/${conversationId}/return-to-ai`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ notes }),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to return to AI");
}

export async function sendManualReplyAction(
  conversationId: string,
  text: string,
  merchantId?: string,
): Promise<{ message_id: string; sent: boolean }> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/conversations/${conversationId}/reply`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ text }),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to send reply");
  return res.json();
}

export interface MessageRecord {
  id: string;
  conversation_id: string;
  direction: string;
  raw_text: string | null;
  intent: string | null;
  intent_confidence: number | null;
  created_at: string;
}

export interface ConversationRecord {
  id: string;
  merchant_id: string;
  customer_ref: string;
  channel: string;
  status: string;
  is_human_takeover: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchConversationsAction(merchantId?: string): Promise<ConversationRecord[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/conversations/`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch conversations");
  return res.json();
}

export async function fetchOrdersAction(merchantId?: string): Promise<Order[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/orders/`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch orders");
  return res.json();
}

export async function fetchMessagesAction(
  conversationId: string,
  merchantId?: string,
): Promise<MessageRecord[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/conversations/${conversationId}/messages`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch messages");
  return res.json();
}

// ---------------- AI TRAINING (LABELED EXAMPLES) ACTIONS ----------------

export async function fetchExamplesAction(merchantId?: string): Promise<LabeledExample[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/labeled-examples/`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch training examples");
  return res.json();
}

export async function createExampleAction(data: {
  normalized_text: string;
  intent: string;
  extraction?: Record<string, unknown> | null;
}): Promise<LabeledExample> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/labeled-examples/`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to create training example");
  return res.json();
}

export async function updateExampleAction(
  exampleId: string,
  data: { normalized_text?: string; intent?: string; extraction?: Record<string, unknown> | null },
): Promise<LabeledExample> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/labeled-examples/${exampleId}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(data),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to update training example");
  return res.json();
}

export async function deleteExampleAction(exampleId: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/labeled-examples/${exampleId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to delete training example");
}

export async function updateAutoLearningAction(
  enabled: boolean,
): Promise<{ auto_learning_enabled: boolean }> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/merchants/me/settings`, {
    method: "PATCH",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ auto_learning_enabled: enabled }),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to update settings");
  return res.json();
}
