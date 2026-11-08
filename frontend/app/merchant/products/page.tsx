import { fetchProductsAction } from "@/app/merchant/actions";
import { ProductsClient } from "./products-client";
import { getCurrentMerchant } from "@/lib/dal";

export default async function ProductsPage() {
  const { merchantId } = await getCurrentMerchant();

  // Fetch actual products list from backend
  const products = await fetchProductsAction();

  return <ProductsClient merchantId={merchantId} initialProducts={products} />;
}
