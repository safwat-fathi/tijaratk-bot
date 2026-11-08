import { fetchProductsAction, fetchOrdersAction } from "@/app/merchant/actions";
import { OrdersClient } from "./orders-client";
import { getCurrentMerchant } from "@/lib/dal";
import type { Product } from "@/lib/products";
import type { Order } from "@/lib/orders";

function isRedirect(error: unknown): boolean {
  return (
    typeof (error as { digest?: unknown })?.digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export default async function OrdersPage() {
  const { merchantId } = await getCurrentMerchant();

  let products: Product[] = [];
  let orders: Order[] = [];
  try {
    products = await fetchProductsAction();
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load products for orders on server:", err);
  }

  try {
    orders = await fetchOrdersAction();
  } catch (err) {
    if (isRedirect(err)) throw err;
    console.error("Failed to load orders on server:", err);
  }

  return (
    <OrdersClient
      merchantId={merchantId}
      products={products}
      initialOrders={orders}
    />
  );
}
