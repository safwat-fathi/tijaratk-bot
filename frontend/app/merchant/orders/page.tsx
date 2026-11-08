import { fetchProductsAction, fetchOrdersAction } from "@/app/merchant/actions";
import { OrdersClient } from "./orders-client";
import { getCurrentMerchant } from "@/lib/dal";

export default async function OrdersPage() {
  const { merchantId } = await getCurrentMerchant();

  // Fetch actual products list from backend for the manual order form
  const products = await fetchProductsAction();
  // Fetch actual orders list
  const orders = await fetchOrdersAction();

  return (
    <OrdersClient
      merchantId={merchantId}
      products={products}
      initialOrders={orders}
    />
  );
}
