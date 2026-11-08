"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIES, LOGIN_MARKER } from "@/lib/constants";
import { getBaseUrl } from "@/lib/api";
import { getAuthToken } from "@/lib/dal";
import type { Product } from "@/lib/products";
import type { StoreKnowledge } from "@/lib/knowledge";
import type { Order } from "@/lib/orders";
import type { LabeledExample } from "@/lib/training";

export async function checkResponse(res: Response, errorPrefix: string = "Request failed") {
  if (res.status === 401 || res.status === 403) {
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

/** Starts the Facebook page connect flow and sends the browser to consent; the API brings it back to /merchant/settings. */
export async function connectFacebookAction() {
  const token = await getAuthToken();
  const res = await fetch(`${getBaseUrl()}/merchants/me/connect/facebook`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  }).catch(() => null);
  if (res?.status === 401) redirect(`/login?${LOGIN_MARKER}=1`);
  if (res?.status === 402) redirect("/merchant/settings?error=billing_required");
  const body = res?.ok ? ((await res.json()) as { auth_url?: string; connected?: string }) : null;
  if (body?.auth_url) redirect(body.auth_url);
  redirect(`/merchant/settings?${body?.connected ? `connected=${body.connected}` : "error=connect_failed"}`);
}

// ---------------- PRODUCTS ACTIONS ----------------

export async function fetchProductsAction(_merchantId?: string): Promise<Product[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/products`, {
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
    offer_price?: number | null;
    offer_ends_at?: string | null;
    variants?: Array<{ label: string; sku?: string; price?: number; stock?: number }>;
  },
  _merchantId?: string,
): Promise<Product> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/products`, {
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
  data: { name?: string; aliases?: string[]; price?: number | null; offer_price?: number | null; offer_ends_at?: string | null },
  _merchantId?: string,
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

export async function uploadProductImageAction(productId: string, formData: FormData): Promise<Product> {
  const file = formData.get("image");
  if (!(file instanceof File)) throw new Error("No image selected");
  const headers = await getAuthHeaders();
  headers["Content-Type"] = file.type;
  const res = await fetch(`${getBaseUrl()}/products/${productId}/image`, {
    method: "PUT",
    headers,
    body: Buffer.from(await file.arrayBuffer()),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to upload image");
  return res.json();
}

export async function deleteProductImageAction(productId: string): Promise<Product> {
  const res = await fetch(`${getBaseUrl()}/products/${productId}/image`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to remove image");
  return res.json();
}

export async function deleteProductAction(productId: string, _merchantId?: string): Promise<void> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/products/${productId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to delete product");
}

// ---------------- STORE KNOWLEDGE ACTIONS ----------------

export async function fetchKnowledgeAction(_merchantId?: string): Promise<StoreKnowledge[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/store-knowledge`, {
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
  _merchantId?: string,
): Promise<StoreKnowledge> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/store-knowledge`, {
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
  _merchantId?: string,
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

export async function deleteKnowledgeAction(knowledgeId: string, _merchantId?: string): Promise<void> {
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
  _merchantId?: string,
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
  _merchantId?: string,
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
  _merchantId?: string,
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
  _merchantId?: string,
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
  _merchantId?: string,
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

export async function fetchConversationsAction(_merchantId?: string): Promise<ConversationRecord[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/conversations`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch conversations");
  return res.json();
}

export async function fetchOrdersAction(_merchantId?: string): Promise<Order[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/orders`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to fetch orders");
  return res.json();
}

export async function fetchMessagesAction(
  conversationId: string,
  _merchantId?: string,
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

export async function fetchExamplesAction(_merchantId?: string): Promise<LabeledExample[]> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/labeled-examples`, {
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
  const res = await fetch(`${baseUrl}/labeled-examples`, {
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

export async function updateAiEnabledAction(
  enabled: boolean,
): Promise<{ ai_enabled: boolean }> {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/merchants/me/settings`, {
    method: "PATCH",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ ai_enabled: enabled }),
    cache: "no-store",
  });
  await checkResponse(res, "Failed to update settings");
  return res.json();
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
